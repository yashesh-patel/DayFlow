import { pool } from "../lib/db.js";
import { logAudit } from "../lib/audit.js";

// Explicit column list for profile_info reads: account_number/ifsc_code/pan_no are
// stored encrypted (pgcrypto) and must be decrypted, so a bare "p.*" can't be used.
const PROFILE_INFO_COLUMNS = `
  p.id,
  p.hr_id,
  p.emp_id,
  p.department,
  p.location,
  p.summary,
  p.skills,
  p.certificates,
  p.salary,
  p.date_of_birth,
  p.address,
  p.nationality,
  p.personal_email,
  p.gender,
  p.marital_status,
  p.date_of_joining,
  p.bank_name,
  pgp_sym_decrypt(p.account_number, current_setting('app.pii_key')) AS account_number,
  pgp_sym_decrypt(p.ifsc_code, current_setting('app.pii_key')) AS ifsc_code,
  pgp_sym_decrypt(p.pan_no, current_setting('app.pii_key')) AS pan_no,
  p.emp_code,
  p.created_at,
  p.updated_at
`;

const SENSITIVE_PROFILE_FIELDS = [
  "salary",
  "bank_name",
  "account_number",
  "ifsc_code",
  "pan_no",
];

/**
 * 1️⃣ Update Image (Logo or Profile Picture)
 */
export const updateImage = async (req, res) => {
  try {
    const { role } = req.user;
    const userId = req.user.hr_id || req.user.emp_id || req.user.client_id;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const type = file.fieldname; // logo | profile_picture

    if (role === "employee" && type === "logo") {
      return res
        .status(403)
        .json({ message: "Employees cannot update company logo" });
    }

    if (type === "logo" && role === "hr") {
      await pool.query(`UPDATE hr SET logo = $1 WHERE hr_id = $2`, [
        file.path,
        userId,
      ]);
      return res.json({ message: "Company logo updated", imageUrl: file.path });
    }

    const table =
      role === "hr" ? "hr" : role === "client" ? "client" : "employee";
    const idCol =
      role === "hr" ? "hr_id" : role === "client" ? "client_id" : "emp_id";

    await pool.query(
      `UPDATE ${table} SET profile_picture = $1 WHERE ${idCol} = $2`,
      [file.path, userId],
    );

    return res.json({
      message: "Profile picture updated",
      imageUrl: file.path,
    });
  } catch (error) {
    console.error("Error updateImage:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

/**
 * 2️⃣ Update Profile
 */
export const updateProfile = async (req, res) => {
  const { role } = req.user;
  const requesterId = req.user.hr_id || req.user.emp_id || req.user.client_id;

  const targetId =
    role === "hr" && req.body.target_id ? req.body.target_id : requesterId;

  try {
    if (role === "client") {
      const { name, phone, address, company_name } = req.body;

      const result = await pool.query(
        `UPDATE client
         SET
          name = COALESCE($1, name),
          phone = COALESCE($2, phone),
          address = COALESCE($3, address),
          company_name = COALESCE($4, company_name),
          updated_at = NOW()
         WHERE client_id = $5
         RETURNING
          client_id,
          name,
          phone,
          email,
          company_name,
          profile_picture,
          address,
          created_at,
          updated_at,
          'client' AS role`,
        [name, phone, address, company_name, requesterId],
      );

      return res.json({
        user: result.rows[0] || {},
        message: "Client profile updated successfully",
      });
    }

    // ===========================
    // HR UPDATE
    // ===========================
    if (role === "hr") {
      // Two distinct cases share this branch: HR editing their own profile
      // (no target_id -- emp_id must stay NULL), and HR editing an employee's
      // profile (target_id present -- must belong to this HR).
      const isEditingEmployee = Boolean(req.body.target_id);
      const targetEmpId = isEditingEmployee ? req.body.target_id : null;

      if (isEditingEmployee) {
        const ownershipCheck = await pool.query(
          `SELECT emp_id FROM employee WHERE emp_id = $1 AND hr_id = $2`,
          [targetEmpId, requesterId],
        );
        if (!ownershipCheck.rows.length) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const {
        department,
        location,
        summary,
        skills,
        salary,
        date_of_birth,
        address,
        nationality,
        gender,
        marital_status,
        bank_name,
        account_number,
        ifsc_code,
        pan_no,
        emp_code,
        name,
        phone,
        company_name,
      } = req.body;

      const conflictClause = isEditingEmployee
        ? "ON CONFLICT (emp_id) WHERE emp_id IS NOT NULL"
        : "ON CONFLICT (hr_id) WHERE emp_id IS NULL";

      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        await client.query(
          `
          INSERT INTO profile_info (
            hr_id, emp_id, department, location, summary, skills, salary,
            date_of_birth, address, nationality, gender, marital_status,
            bank_name, account_number, ifsc_code, pan_no, emp_code, updated_at
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7,
            $8, $9, $10, $11, $12,
            $13,
            pgp_sym_encrypt($14::text, current_setting('app.pii_key')),
            pgp_sym_encrypt($15::text, current_setting('app.pii_key')),
            pgp_sym_encrypt($16::text, current_setting('app.pii_key')),
            $17, NOW()
          )
          ${conflictClause}
          DO UPDATE SET
            department = EXCLUDED.department,
            location = EXCLUDED.location,
            summary = EXCLUDED.summary,
            skills = EXCLUDED.skills,
            salary = EXCLUDED.salary,
            date_of_birth = EXCLUDED.date_of_birth,
            address = EXCLUDED.address,
            nationality = EXCLUDED.nationality,
            gender = EXCLUDED.gender,
            marital_status = EXCLUDED.marital_status,
            bank_name = EXCLUDED.bank_name,
            account_number = EXCLUDED.account_number,
            ifsc_code = EXCLUDED.ifsc_code,
            pan_no = EXCLUDED.pan_no,
            emp_code = EXCLUDED.emp_code,
            updated_at = NOW()
        `,
          [
            requesterId,
            targetEmpId,
            department,
            location,
            summary,
            skills,
            salary,
            date_of_birth,
            address,
            nationality,
            gender,
            marital_status,
            bank_name,
            account_number,
            ifsc_code,
            pan_no,
            emp_code,
          ],
        );

        if (!isEditingEmployee && (name || phone || company_name)) {
          await client.query(
            `UPDATE hr SET
              name = COALESCE($1, name),
              phone = COALESCE($2, phone),
              company_name = COALESCE($3, company_name),
              updated_at = NOW()
             WHERE hr_id = $4`,
            [name, phone, company_name, requesterId],
          );
        }

        if (isEditingEmployee && (name || phone)) {
          await client.query(
            `UPDATE employee SET
              name = COALESCE($1, name),
              phone = COALESCE($2, phone)
             WHERE emp_id = $3`,
            [name, phone, targetEmpId],
          );
        }

        await client.query("COMMIT");
        client.release();

        const touchedSensitiveFields = SENSITIVE_PROFILE_FIELDS.filter(
          (field) => req.body[field] !== undefined,
        );
        if (touchedSensitiveFields.length > 0) {
          await logAudit({
            actorRole: "hr",
            actorId: requesterId,
            action: "profile_sensitive_update",
            targetTable: "profile_info",
            targetId: targetEmpId || requesterId,
            metadata: { fields: touchedSensitiveFields },
          });
        }

        // Fetch and return the updated profile
        const profileResult = isEditingEmployee
          ? await pool.query(
              `SELECT
                e.name,
                e.phone,
                e.email,
                e.profile_picture,
                e.role AS employee_role,
                e.experience,
                ${PROFILE_INFO_COLUMNS}
               FROM employee e
               LEFT JOIN profile_info p ON e.emp_id = p.emp_id
               WHERE e.emp_id = $1`,
              [targetEmpId],
            )
          : await pool.query(
              `SELECT h.name, h.phone, h.email, h.profile_picture, h.logo, h.company_name,
                ${PROFILE_INFO_COLUMNS}
               FROM hr h
               LEFT JOIN profile_info p ON h.hr_id = p.hr_id AND p.emp_id IS NULL
               WHERE h.hr_id = $1`,
              [requesterId],
            );

        return res.json({
          user: profileResult.rows[0] || {},
          message: "Profile updated successfully",
        });
      } catch (err) {
        await client.query("ROLLBACK");
        client.release();
        throw err;
      }
    }

    // ===========================
    // EMPLOYEE UPDATE
    // ===========================
    const forbiddenFields = [
      "salary",
      "department",
      "bank_name",
      "account_number",
      "ifsc_code",
      "pan_no",
      "emp_code",
      "gender",
      "marital_status",
      "nationality",
      "date_of_birth",
    ];

    const forbiddenUsed = forbiddenFields.filter(
      (field) => req.body[field] !== undefined,
    );

    if (forbiddenUsed.length > 0) {
      return res.status(403).json({
        message: "You are not allowed to update these fields",
        fields: forbiddenUsed,
      });
    }

    const allowedFields = ["address", "phone"];
    const updates = [];
    const values = [];
    let idx = 1;

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = $${idx}`);
        values.push(req.body[field]);
        idx++;
      }
    });

    if (updates.length === 0) {
      return res.status(400).json({
        message: "No updatable fields provided",
      });
    }

    values.push(targetId);

    await pool.query(
      `UPDATE profile_info 
       SET ${updates.join(", ")}, updated_at = NOW() 
       WHERE emp_id = $${idx}`,
      values,
    );

    if (req.body.phone) {
      await pool.query(`UPDATE employee SET phone = $1 WHERE emp_id = $2`, [
        req.body.phone,
        targetId,
      ]);
    }

    // Fetch and return the updated profile
    const profileResult = await pool.query(
      `SELECT
        e.name,
        e.phone,
        e.email,
        e.profile_picture,
        e.role AS employee_role,
        e.experience,
        ${PROFILE_INFO_COLUMNS}
       FROM employee e
       LEFT JOIN profile_info p ON e.emp_id = p.emp_id
       WHERE e.emp_id = $1`,
      [targetId],
    );

    return res.json({
      user: profileResult.rows[0] || {},
      message: "Personal details updated successfully",
    });
  } catch (error) {
    console.error("Error updateProfile:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

/**
 * 3️⃣ Get Profile
 */
export const getProfile = async (req, res) => {
  const requesterId = req.user.hr_id || req.user.emp_id || req.user.client_id;
  const id = req.params.id || requesterId;
  const isOwnProfile = id === requesterId;

  // Employees and clients may only ever view their own profile. HR may view
  // their own profile, or any employee that reports to them.
  if (!isOwnProfile) {
    if (req.user.role === "employee" || req.user.role === "client") {
      return res.status(403).json({ message: "Access denied" });
    }
    if (req.user.role === "hr") {
      const ownershipCheck = await pool.query(
        `SELECT emp_id FROM employee WHERE emp_id = $1 AND hr_id = $2`,
        [id, requesterId],
      );
      if (!ownershipCheck.rows.length) {
        return res.status(403).json({ message: "Access denied" });
      }
    }
  }

  try {
    let result = await pool.query(
      `SELECT
        e.name,
        e.phone,
        e.email,
        e.profile_picture,
        e.role AS employee_role,
        e.experience,
        ${PROFILE_INFO_COLUMNS}
       FROM employee e
       LEFT JOIN profile_info p ON e.emp_id = p.emp_id
       WHERE e.emp_id = $1`,
      [id],
    );

    if (result.rows.length === 0) {
      result = await pool.query(
        `SELECT h.name, h.phone, h.email, h.profile_picture, h.logo, h.company_name,
          ${PROFILE_INFO_COLUMNS}
         FROM hr h
         LEFT JOIN profile_info p ON h.hr_id = p.hr_id
          AND p.emp_id IS NULL
         WHERE h.hr_id = $1`,
        [id],
      );
    }

    if (result.rows.length === 0) {
      result = await pool.query(
        `SELECT
          client_id,
          name,
          phone,
          email,
          company_name,
          profile_picture,
          address,
          created_at,
          updated_at,
          'client' AS role
         FROM client
         WHERE client_id = $1`,
        [id],
      );
    }

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Profile not found" });
    }

    const user = result.rows[0];

    // Filter out sensitive fields (like salary) for non-HR users
    if (req.user.role !== "hr") {
      const sensitiveFields = [
        "salary",
        "bank_name",
        "account_number",
        "ifsc_code",
        "pan_no",
      ];
      sensitiveFields.forEach((field) => {
        delete user[field];
      });
    }

    res.json({ user });
  } catch (error) {
    console.error("Error getProfile:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
