import bcrypt from "bcryptjs";
import { pool } from "../lib/db.js";
import { generateToken } from "../lib/utils.js";
import { getPasswordError } from "../lib/validators.js";
import { logAudit } from "../lib/audit.js";

const sanitizeUser = (user) => {
  const { password_hash, ...userWithoutPass } = user;
  return userWithoutPass;
};

// Employees inherit their company's branding from the HR that owns them, so the
// sidebar can show the company logo for both roles.
const getEmployeeAuthSelect = () => `
  SELECT
    e.emp_id,
    e.hr_id,
    e.name,
    e.phone,
    e.email,
    e.password_hash,
    e.profile_picture,
    e.role AS employee_role,
    e.experience,
    e.created_at,
    e.updated_at,
    h.company_name,
    h.logo,
    'employee' AS role
  FROM employee e
  LEFT JOIN hr h ON h.hr_id = e.hr_id
`;

export const registerHr = async (req, res) => {
  const { name, phone, email, password, company_name } = req.body;
  const files = req.files || {};

  // Handle Files
  // req.files is an object because we use upload.fields() in the route
  const logoPath = files["logo"] ? files["logo"][0].path : null;
  const profilePicPath = files["profile_picture"]
    ? files["profile_picture"][0].path
    : null;

  if (!logoPath) {
    return res.status(400).json({ message: "Company Logo is required" });
  }

  const passwordError = getPasswordError(password);
  if (passwordError) {
    return res.status(400).json({ message: passwordError });
  }

  try {
    const existingHr = await pool.query("SELECT * FROM hr WHERE email = $1", [
      email,
    ]);
    if (existingHr.rows.length > 0)
      return res.status(400).json({ message: "Email already exists" });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const result = await pool.query(
      `INSERT INTO hr (name, phone, email, password_hash, company_name, logo, profile_picture) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        name,
        phone,
        email,
        hashedPassword,
        company_name,
        logoPath,
        profilePicPath,
      ],
    );

    // Create empty profile_info for HR
    await pool.query(`INSERT INTO profile_info (hr_id) VALUES ($1)`, [
      result.rows[0].hr_id,
    ]);

    generateToken(result.rows[0].hr_id, res);

    res.status(201).json({ user: sanitizeUser(result.rows[0]), role: "hr" });
  } catch (error) {
    console.log("Error in registerHr:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const login = async (req, res) => {
  const { email, password } = req.body;
  const identifier = (email || "").trim();

  if (!identifier || !password) {
    return res
      .status(400)
      .json({ message: "Email or employee code and password are required" });
  }

  const normalizedIdentifier = identifier.toLowerCase();
  const isEmailLogin = normalizedIdentifier.includes("@");

  try {
    // 1. Check HR
    let result = await pool.query(
      "SELECT *, 'hr' as role FROM hr WHERE LOWER(email) = $1",
      [normalizedIdentifier],
    );
    let user = result.rows[0];
    let idField = "hr_id";

    // 2. If not HR, Check Employee
    if (!user) {
      if (isEmailLogin) {
        result = await pool.query(
          `${getEmployeeAuthSelect()} WHERE LOWER(e.email) = $1`,
          [normalizedIdentifier],
        );
      } else {
        result = await pool.query(
          `${getEmployeeAuthSelect()}
          JOIN profile_info p ON p.emp_id = e.emp_id
          WHERE LOWER(p.emp_code) = $1`,
          [normalizedIdentifier],
        );
      }
      user = result.rows[0];
      idField = "emp_id";
    }

    if (!user) {
      await logAudit({
        actorRole: "unknown",
        actorId: null,
        action: "login_failed",
        metadata: { identifier, reason: "no_such_user" },
      });
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      await logAudit({
        actorRole: user.role,
        actorId: user[idField],
        action: "login_failed",
        metadata: { identifier, reason: "bad_password" },
      });
      return res.status(400).json({ message: "Invalid credentials" });
    }

    generateToken(user[idField], res);

    await logAudit({
      actorRole: user.role,
      actorId: user[idField],
      action: "login_success",
    });

    res.status(200).json({ user: sanitizeUser(user), role: user.role });
  } catch (error) {
    console.log("Error login:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const logout = (req, res) => {
  res.cookie("jwt", "", { maxAge: 0 });
  res.status(200).json({ message: "Logged out successfully" });
};

export const getMe = (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    res.status(200).json({ user: req.user });
  } catch (error) {
    console.log("Error in getMe:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
