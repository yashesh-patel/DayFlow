import { pool } from "../lib/db.js";
import { logAudit } from "../lib/audit.js";
import { sendLeaveApprovalEmail, isMailConfigured } from "../lib/mailer.js";

// Default annual entitlements -- placeholders. Confirm the real policy with
// HR/product; these currently just seed a new employee's first leave_balances row.
const DEFAULT_PAID_DAYS = 18;
const DEFAULT_SICK_DAYS = 12;

const getOrCreateBalance = async (empId, year) => {
  const result = await pool.query(
    `INSERT INTO leave_balances (emp_id, leave_year, paid_total, sick_total)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (emp_id, leave_year) DO UPDATE SET updated_at = leave_balances.updated_at
     RETURNING *`,
    [empId, year, DEFAULT_PAID_DAYS, DEFAULT_SICK_DAYS]
  );
  return result.rows[0];
};

const daysRequested = (startDate, endDate, leaveType) => {
  if (leaveType === "Half-Day") return 0.5;
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diff = Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(diff, 1);
};

// Create leave request
export const createLeaveRequest = async (req, res) => {
  const empId = req.user.emp_id;
  const { type, startDate, endDate, remarks } = req.body;
  // Capitalize to match DB CHECK constraint: 'Paid', 'Sick', 'Unpaid', 'Half-Day'
  const leaveType = type ? type.charAt(0).toUpperCase() + type.slice(1) : type;

  if (!startDate || !endDate || new Date(endDate) < new Date(startDate)) {
    return res.status(400).json({ error: "Invalid date range" });
  }

  try {
    const result = await pool.query(
      `INSERT INTO time_off(emp_id, leave_type, start_date, end_date, admin_comment)
       VALUES($1, $2, $3, $4, $5) RETURNING *`,
      [empId, leaveType, startDate, endDate, remarks || null]
    );
    res.status(201).json({ leave: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create leave request" });
  }
};

// Get own leaves
export const getMyLeaves = async (req, res) => {
  const empId = req.user.emp_id;

  try {
    const result = await pool.query(
      `SELECT * FROM time_off WHERE emp_id = $1 ORDER BY created_at DESC`,
      [empId]
    );
    res.json({ leaves: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch leaves" });
  }
};

// Get own leave balance for the current year (lazily created with default entitlement)
export const getMyLeaveBalance = async (req, res) => {
  const empId = req.user.emp_id;
  const year = new Date().getFullYear();

  try {
    const balance = await getOrCreateBalance(empId, year);
    res.json({
      balance: {
        ...balance,
        paid_remaining: Number(balance.paid_total) - Number(balance.paid_used),
        sick_remaining: Number(balance.sick_total) - Number(balance.sick_used),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch leave balance" });
  }
};

// Admin: get all leave requests for employees under this HR
export const getAllLeaves = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT t.*, e.name AS user_name
       FROM time_off t
       JOIN employee e ON t.emp_id = e.emp_id
       WHERE e.hr_id = $1
       ORDER BY t.created_at DESC`,
      [req.user.hr_id]
    );
    res.json({ leaves: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch all leave requests" });
  }
};

// Approve leave
export const approveLeave = async (req, res) => {
  const { id } = req.params;
  const { comment, force } = req.body;

  try {
    const leaveResult = await pool.query(
      `SELECT t.*, e.hr_id
       FROM time_off t
       JOIN employee e ON t.emp_id = e.emp_id
       WHERE t.request_id = $1`,
      [id]
    );

    if (!leaveResult.rows.length) {
      return res.status(404).json({ error: "Leave request not found" });
    }

    const leave = leaveResult.rows[0];
    if (leave.hr_id !== req.user.hr_id) {
      return res.status(403).json({ error: "Access denied" });
    }
    if (leave.status !== "Pending") {
      return res.status(400).json({ error: "Leave request already decided" });
    }

    const year = new Date(leave.start_date).getFullYear();
    const requested = daysRequested(leave.start_date, leave.end_date, leave.leave_type);
    const isPaidType = leave.leave_type === "Paid" || leave.leave_type === "Half-Day";
    const isSickType = leave.leave_type === "Sick";

    if (isPaidType || isSickType) {
      const balance = await getOrCreateBalance(leave.emp_id, year);
      const remaining = isPaidType
        ? Number(balance.paid_total) - Number(balance.paid_used)
        : Number(balance.sick_total) - Number(balance.sick_used);

      if (requested > remaining && !force) {
        return res.status(400).json({
          error: `Insufficient ${isPaidType ? "paid" : "sick"} leave balance (${remaining} remaining, ${requested} requested). Pass force:true to override.`,
        });
      }

      await pool.query(
        `UPDATE leave_balances
         SET ${isPaidType ? "paid_used" : "sick_used"} = ${isPaidType ? "paid_used" : "sick_used"} + $1,
             updated_at = NOW()
         WHERE emp_id = $2 AND leave_year = $3`,
        [requested, leave.emp_id, year]
      );
    }

    const result = await pool.query(
      `UPDATE time_off SET status='Approved', admin_comment=$1
       WHERE request_id=$2 RETURNING *`,
      [comment || null, id]
    );

    await logAudit({
      actorRole: "hr",
      actorId: req.user.hr_id,
      action: "leave_approved",
      targetTable: "time_off",
      targetId: id,
      metadata: { emp_id: leave.emp_id, days: requested, forced: Boolean(force) },
    });

    // Send approval email if configured
    if (isMailConfigured()) {
      const employeeResult = await pool.query(
        "SELECT name, email FROM employee WHERE emp_id = $1",
        [leave.emp_id]
      );
      const employee = employeeResult.rows[0];
      const hrResult = await pool.query(
        "SELECT name FROM hr WHERE hr_id = $1",
        [req.user.hr_id]
      );
      const hr = hrResult.rows[0];
      try {
        await sendLeaveApprovalEmail({
          to: employee?.email,
          employeeName: employee?.name || "Employee",
          leaveType: leave.leave_type,
          startDate: leave.start_date,
          endDate: leave.end_date,
          status: "Approved",
          message: comment || null,
          hrName: hr?.name || "HR Administrator",
        });
      } catch (emailError) {
        console.log("Warning: Failed to send leave approval email:", emailError.message);
      }
    }

    res.json({ leave: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to approve leave" });
  }
};

// Reject leave
export const rejectLeave = async (req, res) => {
  const { id } = req.params;
  const { comment } = req.body;

  try {
    const leaveResult = await pool.query(
      `SELECT t.request_id, e.hr_id
       FROM time_off t
       JOIN employee e ON t.emp_id = e.emp_id
       WHERE t.request_id = $1`,
      [id]
    );

    if (!leaveResult.rows.length) {
      return res.status(404).json({ error: "Leave request not found" });
    }
    if (leaveResult.rows[0].hr_id !== req.user.hr_id) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Get leave details for email
    const leaveDetailsResult = await pool.query(
      `SELECT t.*, e.name, e.email
       FROM time_off t
       JOIN employee e ON t.emp_id = e.emp_id
       WHERE t.request_id = $1`,
      [id]
    );
    const leaveDetails = leaveDetailsResult.rows[0];

    const result = await pool.query(
      `UPDATE time_off SET status='Rejected', admin_comment=$1
       WHERE request_id=$2 RETURNING *`,
      [comment || null, id]
    );

    await logAudit({
      actorRole: "hr",
      actorId: req.user.hr_id,
      action: "leave_rejected",
      targetTable: "time_off",
      targetId: id,
    });

    // Send rejection email if configured
    if (isMailConfigured() && leaveDetails) {
      const hrResult = await pool.query(
        "SELECT name FROM hr WHERE hr_id = $1",
        [req.user.hr_id]
      );
      const hr = hrResult.rows[0];
      try {
        await sendLeaveApprovalEmail({
          to: leaveDetails?.email,
          employeeName: leaveDetails?.name || "Employee",
          leaveType: leaveDetails?.leave_type,
          startDate: leaveDetails?.start_date,
          endDate: leaveDetails?.end_date,
          status: "Rejected",
          message: comment || null,
          hrName: hr?.name || "HR Administrator",
        });
      } catch (emailError) {
        console.log("Warning: Failed to send leave rejection email:", emailError.message);
      }
    }

    res.json({ leave: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to reject leave" });
  }
};
