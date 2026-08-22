import { pool } from "../lib/db.js";
import { logAudit } from "../lib/audit.js";
import { sendPayslipEmail, isMailConfigured } from "../lib/mailer.js";

// Employee: own payroll history (include salary from profile_info)
export const getMyPayroll = async (req, res) => {
  const empId  = req.user.emp_id;
  try {
    const result = await pool.query(
      `SELECT p.*, pi.salary
       FROM payroll p
       LEFT JOIN profile_info pi ON p.emp_id = pi.emp_id
       WHERE p.emp_id = $1
       ORDER BY p.paid_date DESC`,
      [empId]
    );

    // Also get current salary info
    const salaryResult = await pool.query(
      `SELECT salary FROM profile_info WHERE emp_id = $1`,
      [empId]
    );

    res.json({
      payroll: result.rows,
      currentSalary: salaryResult.rows[0]?.salary || 0
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch payroll" });
  }
};

// Admin: all payroll for employees under this HR, with salary info
export const getAllPayroll = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.*, e.name AS emp_name, pi.department, pi.salary
       FROM payroll p
       JOIN employee e ON p.emp_id = e.emp_id
       LEFT JOIN profile_info pi ON e.emp_id = pi.emp_id
       WHERE e.hr_id = $1
       ORDER BY p.paid_date DESC`,
      [req.user.hr_id]
    );
    res.json({ payroll: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch payroll" });
  }
};

// Get employee payroll summary (all employees with salary + payment status)
export const getPayrollSummary = async (req, res) => {
  try {
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    const result = await pool.query(
      `SELECT
        e.emp_id,
        e.name,
        e.email,
        pi.department,
        COALESCE(pi.salary, 0) AS annual_salary,
        COALESCE(pi.salary / 12, 0) AS monthly_salary,
        p.paid_status AS current_month_status,
        p.paid_date
       FROM employee e
       LEFT JOIN profile_info pi ON e.emp_id = pi.emp_id
       LEFT JOIN payroll p ON e.emp_id = p.emp_id
         AND p.pay_month = $1
         AND p.pay_year = $2
       WHERE e.hr_id = $3
       ORDER BY e.name ASC`,
      [currentMonth, currentYear, req.user.hr_id]
    );

    const totalMonthly = result.rows.reduce((sum, r) => sum + parseFloat(r.monthly_salary || 0), 0);
    const paidCount = result.rows.filter(r => r.current_month_status === 'Paid').length;
    const pendingCount = result.rows.filter(r => r.current_month_status !== 'Paid').length;

    res.json({
      employees: result.rows,
      summary: {
        totalEmployees: result.rows.length,
        totalMonthlyPayroll: Math.round(totalMonthly),
        paidThisMonth: paidCount,
        pendingThisMonth: pendingCount,
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch payroll summary" });
  }
};

// Update employee salary (admin) -- only for employees under this HR
export const updateSalary = async (req, res) => {
  const { id } = req.params; // employee ID
  const { salary } = req.body;

  try {
    const ownershipCheck = await pool.query(
      `SELECT emp_id FROM employee WHERE emp_id = $1 AND hr_id = $2`,
      [id, req.user.hr_id]
    );
    if (!ownershipCheck.rows.length) {
      return res.status(403).json({ error: "Access denied" });
    }

    await pool.query(
      `UPDATE profile_info SET salary=$1 WHERE emp_id=$2`,
      [salary, id]
    );

    await logAudit({
      actorRole: "hr",
      actorId: req.user.hr_id,
      action: "salary_updated",
      targetTable: "profile_info",
      targetId: id,
      metadata: { new_salary: salary },
    });

    res.json({ message: "Salary updated successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update salary" });
  }
};

// Process payroll (admin) - mark all employees under this HR as paid for the given month.
// Uses INSERT ... ON CONFLICT so concurrent calls can't create duplicate/conflicting rows
// (the payroll table previously had no unique constraint at all).
export const processPayroll = async (req, res) => {
  const { month, year } = req.body;

  if (!month || !year) {
    return res.status(400).json({ error: "month and year are required" });
  }

  try {
    const employees = await pool.query(
      `SELECT e.emp_id, e.name, e.email, COALESCE(pi.salary, 0) AS annual_salary
       FROM employee e
       LEFT JOIN profile_info pi ON e.emp_id = pi.emp_id
       WHERE e.hr_id = $1`,
      [req.user.hr_id]
    );

    let processed = 0;
    const processedEmployees = [];
    for (const emp of employees.rows) {
      const grossMonthly = Number(emp.annual_salary) / 12;
      const paidDate = `${year}-${String(month).padStart(2, '0')}-28`;

      const result = await pool.query(
        `INSERT INTO payroll (emp_id, paid_date, paid_status, pay_month, pay_year, gross_salary, deductions, net_salary)
         VALUES ($1, $2, 'Paid', $3, $4, $5, 0, $5)
         ON CONFLICT (emp_id, pay_month, pay_year)
         DO UPDATE SET
           paid_status = 'Paid',
           paid_date = EXCLUDED.paid_date,
           gross_salary = EXCLUDED.gross_salary,
           net_salary = EXCLUDED.net_salary
         WHERE payroll.paid_status <> 'Paid'`,
        [emp.emp_id, paidDate, month, year, grossMonthly]
      );

      if (result.rowCount > 0) {
        processed++;
        processedEmployees.push(emp);
      }
    }

    // Send payslip emails if configured
    if (isMailConfigured()) {
      for (const emp of processedEmployees) {
        try {
          await sendPayslipEmail({
            to: emp.email,
            employeeName: emp.name,
            payslipData: {
              salary: emp.annual_salary / 12,
              paid_status: "Paid",
            },
            month,
            year,
          });
        } catch (emailError) {
          console.log(`Warning: Failed to send payslip email to ${emp.email}:`, emailError.message);
        }
      }
    }

    await logAudit({
      actorRole: "hr",
      actorId: req.user.hr_id,
      action: "payroll_processed",
      targetTable: "payroll",
      metadata: { month, year, employeesProcessed: processed },
    });

    res.json({ message: `Payroll processed for ${processed} employees` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to process payroll" });
  }
};

// Pay individual employee manually with custom amount -- only for employees under this HR
export const payIndividual = async (req, res) => {
  const { empId, amount, month, year, note } = req.body;

  if (!empId || amount === undefined || !month || !year) {
    return res.status(400).json({ error: "empId, amount, month, and year are required" });
  }

  try {
    const ownershipCheck = await pool.query(
      `SELECT emp_id FROM employee WHERE emp_id = $1 AND hr_id = $2`,
      [empId, req.user.hr_id]
    );
    if (!ownershipCheck.rows.length) {
      return res.status(403).json({ error: "Access denied" });
    }

    const paidDate = `${year}-${String(month).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;
    const netAmount = Number(amount);

    await pool.query(
      `INSERT INTO payroll (emp_id, paid_date, paid_status, pay_month, pay_year, gross_salary, deductions, net_salary, notes)
       VALUES ($1, $2, 'Paid', $3, $4, $5, 0, $5, $6)
       ON CONFLICT (emp_id, pay_month, pay_year)
       DO UPDATE SET
         paid_status = 'Paid',
         paid_date = EXCLUDED.paid_date,
         gross_salary = EXCLUDED.gross_salary,
         net_salary = EXCLUDED.net_salary,
         notes = EXCLUDED.notes`,
      [empId, paidDate, month, year, netAmount, note || null]
    );

    await logAudit({
      actorRole: "hr",
      actorId: req.user.hr_id,
      action: "payroll_individual_payment",
      targetTable: "payroll",
      targetId: empId,
      metadata: { amount: netAmount, month, year, note: note || null },
    });

    res.json({ message: `Payment of ₹${amount} processed for employee` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to process individual payment" });
  }
};
