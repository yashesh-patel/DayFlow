import jwt from "jsonwebtoken";
import { pool } from "../lib/db.js";

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

export const protectRoute = async (req, res, next) => {
  try {
    const token = req.cookies.jwt;
    if (!token) {
      return res
        .status(401)
        .json({ message: "Unauthorized - No Token Provided" });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded) {
      return res.status(401).json({ message: "Unauthorized - Invalid Token" });
    }

    const id = decoded.userid;

    // Try HR first
    let result = await pool.query(
      "SELECT *, 'hr' as role FROM hr WHERE hr_id = $1",
      [id],
    );
    let user = result.rows[0];

    // If not HR, try employee
    if (!user) {
      result = await pool.query(
        `${getEmployeeAuthSelect()} WHERE e.emp_id = $1`,
        [id],
      );
      user = result.rows[0];
    }

    if (!user) {
      return res.status(404).json({ message: "User Not Found" });
    }

    // remove password_hash before attaching
    const { password_hash, ...userWithoutPass } = user;
    req.user = userWithoutPass;
    next();
  } catch (error) {
    console.log("Error in protectRoute middleware:", error.message);

    if (
      error.name === "JsonWebTokenError" ||
      error.name === "TokenExpiredError"
    ) {
      return res
        .status(401)
        .json({ message: "Unauthorized - Invalid or Expired Token" });
    }

    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const checkRole = (roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Access denied" });
    }
    next();
  };
};
