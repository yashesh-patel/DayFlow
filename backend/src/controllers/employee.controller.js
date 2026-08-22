import bcrypt from "bcryptjs";
import { pool } from "../lib/db.js";
import { getPasswordError } from "../lib/validators.js";
import { sendWelcomeEmployeeEmail, isMailConfigured } from "../lib/mailer.js";

const generateEmployeeCode = async (
  clientDb,
  hrId,
  companyName = "",
  fullName = "",
) => {
  const companyPrefix =
    (companyName || "Odoo India")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word.charAt(0).toUpperCase())
      .join("") || "OI";

  const nameParts = (fullName || "").trim().split(/\s+/).filter(Boolean);
  const firstName = nameParts[0] || "";
  const lastName = nameParts.slice(1).join(" ") || nameParts[0] || "";
  const nameCode =
    `${firstName.slice(0, 2).toUpperCase()}${lastName.slice(0, 2).toUpperCase()}` ||
    "EM";

  const year = new Date().getFullYear();
  const sequenceResult = await clientDb.query(
    `SELECT COUNT(*)::int AS joined_count
     FROM employee
     WHERE hr_id = $1 AND created_at >= $2 AND created_at < $3`,
    [hrId, `${year}-01-01`, `${year + 1}-01-01`],
  );
  const serial = String(
    (sequenceResult.rows[0]?.joined_count || 0) + 1,
  ).padStart(4, "0");
  return `${companyPrefix}${nameCode}${year}${serial}`;
};

export const addEmployee = async (req, res) => {
  const { name, phone, email, password, role, experience, salary } = req.body;
  const hr_id = req.user.hr_id;
  const profilePicPath = req.file ? req.file.path : null; // Handle uploaded file
  const parsedExperience =
    experience === undefined || experience === null || experience === ""
      ? 0
      : Number.parseInt(experience, 10);
  const parsedSalary =
    salary === undefined || salary === null || salary === ""
      ? 0
      : Number.parseFloat(salary);

  if (Number.isNaN(parsedExperience) || parsedExperience < 0) {
    return res
      .status(400)
      .json({ message: "Experience must be a positive number" });
  }

  if (Number.isNaN(parsedSalary) || parsedSalary < 0) {
    return res.status(400).json({ message: "Salary must be a valid number" });
  }

  const passwordError = getPasswordError(password);
  if (passwordError) {
    return res.status(400).json({ message: passwordError });
  }

  try {
    const existingEmp = await pool.query(
      "SELECT * FROM employee WHERE email = $1",
      [email],
    );
    if (existingEmp.rows.length > 0)
      return res.status(400).json({ message: "Email already exists" });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const hrResult = await client.query(
        "SELECT company_name FROM hr WHERE hr_id = $1",
        [hr_id],
      );
      const generatedCode = await generateEmployeeCode(
        client,
        hr_id,
        hrResult.rows[0]?.company_name,
        name,
      );

      const empResult = await client.query(
        `INSERT INTO employee (
          hr_id,
          name,
          phone,
          email,
          password_hash,
          profile_picture,
          role,
          experience
        )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING
          emp_id,
          hr_id,
          name,
          phone,
          email,
          profile_picture,
          role AS employee_role,
          experience,
          created_at,
          updated_at`,
        [
          hr_id,
          name,
          phone,
          email,
          hashedPassword,
          profilePicPath,
          role || null,
          parsedExperience,
        ],
      );

      await client.query(
        `INSERT INTO profile_info (emp_id, hr_id, salary, emp_code) VALUES ($1, $2, $3, $4)`,
        [empResult.rows[0].emp_id, hr_id, parsedSalary, generatedCode],
      );

      await client.query("COMMIT");

      // Send welcome email if configured
      if (isMailConfigured()) {
        const hrResult = await pool.query(
          "SELECT name, company_name FROM hr WHERE hr_id = $1",
          [hr_id],
        );
        const hr = hrResult.rows[0];
        try {
          await sendWelcomeEmployeeEmail({
            to: email,
            employeeName: name,
            hrName: hr?.name || "HR Administrator",
            companyName: hr?.company_name || "Company",
          });
        } catch (emailError) {
          console.log(
            "Warning: Failed to send welcome email:",
            emailError.message,
          );
          // Don't fail the employee creation if email fails
        }
      }

      res.status(201).json({ employee: empResult.rows[0] });
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  } catch (error) {
    console.log("Error addEmployee:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getAllEmployees = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
        e.emp_id,
        e.name,
        e.email,
        e.phone,
        e.profile_picture,
        e.role AS employee_role,
        e.experience,
        e.created_at,
        p.department
       FROM employee e 
       LEFT JOIN profile_info p ON e.emp_id = p.emp_id 
       WHERE e.hr_id = $1`,
      [req.user.hr_id],
    );
    res.status(200).json({ employees: result.rows });
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error" });
  }
};
