import nodemailer from "nodemailer";

let transporter;

const getSmtpConfig = () => {
  const user = process.env.SMTP_USER || process.env.HR_GMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.HR_GMAIL_APP_PASSWORD;
  const host = process.env.SMTP_HOST || (user ? "smtp.gmail.com" : undefined);
  const port = Number(process.env.SMTP_PORT || 587);
  const from = process.env.SMTP_FROM || user;

  if (!host || !user || !pass || !from) {
    return null;
  }

  return {
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass,
    },
    from,
  };
};

const getTransporter = () => {
  if (transporter) {
    return transporter;
  }

  const config = getSmtpConfig();
  if (!config) {
    return null;
  }

  transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth,
  });

  return transporter;
};

export const isMailConfigured = () => Boolean(getSmtpConfig());

export const sendTaskDueReminderEmail = async ({
  to,
  employeeName,
  tasks,
  reminderText = "due in 2 days",
}) => {
  const config = getSmtpConfig();
  const smtpTransporter = getTransporter();

  if (!config || !smtpTransporter) {
    throw new Error("SMTP is not configured");
  }

  const subject = `Task reminder: ${tasks.length} ${reminderText}`;
  const listHtml = tasks
    .map(
      (task) =>
        `<li><strong>${task.task_key}</strong> - ${task.title} (Due ${task.due_date})</li>`,
    )
    .join("");

  const textLines = tasks.map(
    (task) => `- ${task.task_key}: ${task.title} (Due ${task.due_date})`,
  );

  await smtpTransporter.sendMail({
    from: config.from,
    to,
    subject,
    text: `Hi ${employeeName},\n\nThe following tasks are ${reminderText}:\n${textLines.join("\n")}\n\nPlease update progress in the task board.`,
    html: `<p>Hi ${employeeName},</p><p>The following tasks are <strong>${reminderText}</strong>:</p><ul>${listHtml}</ul><p>Please update progress in the task board.</p>`,
  });
};

export const sendWelcomeEmployeeEmail = async ({
  to,
  employeeName,
  hrName,
  companyName,
}) => {
  const config = getSmtpConfig();
  const smtpTransporter = getTransporter();

  if (!config || !smtpTransporter) {
    throw new Error("SMTP is not configured");
  }

  const subject = `Welcome to ${companyName}!`;

  await smtpTransporter.sendMail({
    from: config.from,
    to,
    subject,
    text: `Hi ${employeeName},\n\nWelcome to ${companyName}!\n\nYou have been added to our HR Management System by ${hrName}. You can now access your employee portal to:\n- View and manage your profile\n- Track your attendance\n- Apply for leave and time-off\n- View your payroll information\n\nPlease log in to get started.\n\nBest regards,\n${companyName} HR Team`,
    html: `<p>Hi ${employeeName},</p><p>Welcome to <strong>${companyName}</strong>!</p><p>You have been added to our HR Management System by ${hrName}. You can now access your employee portal to:</p><ul><li>View and manage your profile</li><li>Track your attendance</li><li>Apply for leave and time-off</li><li>View your payroll information</li></ul><p>Please log in to get started.</p><p>Best regards,<br><strong>${companyName} HR Team</strong></p>`,
  });
};

export const sendLeaveApprovalEmail = async ({
  to,
  employeeName,
  leaveType,
  startDate,
  endDate,
  status,
  message,
  hrName,
}) => {
  const config = getSmtpConfig();
  const smtpTransporter = getTransporter();

  if (!config || !smtpTransporter) {
    throw new Error("SMTP is not configured");
  }

  const subject = `Leave Request ${status}: ${leaveType} Leave (${startDate} to ${endDate})`;
  const statusColor = status === "Approved" ? "green" : "red";
  const statusText =
    status === "Approved"
      ? "Your leave request has been approved."
      : "Your leave request has been rejected.";

  await smtpTransporter.sendMail({
    from: config.from,
    to,
    subject,
    text: `Hi ${employeeName},\n\n${statusText}\n\nLeave Type: ${leaveType}\nDates: ${startDate} to ${endDate}\nStatus: ${status}\n${message ? `\nComment from HR:\n${message}` : ""}\n\nPlease log in to the HR portal for more details.`,
    html: `<p>Hi ${employeeName},</p><p>${statusText}</p><table style="border-collapse: collapse; margin: 20px 0;"><tr><td style="padding: 8px;"><strong>Leave Type:</strong></td><td style="padding: 8px;">${leaveType}</td></tr><tr><td style="padding: 8px;"><strong>Dates:</strong></td><td style="padding: 8px;">${startDate} to ${endDate}</td></tr><tr><td style="padding: 8px;"><strong>Status:</strong></td><td style="padding: 8px; color: ${statusColor};"><strong>${status}</strong></td></tr></table>${message ? `<p><strong>Comment from HR:</strong></p><p>${message}</p>` : ""}<p>Please log in to the HR portal for more details.</p>`,
  });
};

export const sendPayslipEmail = async ({
  to,
  employeeName,
  payslipData,
  month,
  year,
}) => {
  const config = getSmtpConfig();
  const smtpTransporter = getTransporter();

  if (!config || !smtpTransporter) {
    throw new Error("SMTP is not configured");
  }

  const monthName = new Date(`${year}-${String(month).padStart(2, "0")}-01`).toLocaleString(
    "default",
    { month: "long" },
  );

  const subject = `Payslip for ${monthName} ${year}`;

  const payslipHtml = payslipData
    ? `<table style="border-collapse: collapse; margin: 20px 0; width: 100%;"><tr style="background-color: #f0f0f0;"><td style="padding: 8px; border: 1px solid #ddd;"><strong>Item</strong></td><td style="padding: 8px; border: 1px solid #ddd; text-align: right;"><strong>Amount</strong></td></tr><tr><td style="padding: 8px; border: 1px solid #ddd;">Salary</td><td style="padding: 8px; border: 1px solid #ddd; text-align: right;">₹${payslipData.salary || "N/A"}</td></tr><tr><td style="padding: 8px; border: 1px solid #ddd;">Status</td><td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${payslipData.paid_status || "Pending"}</td></tr></table>`
    : "<p>Your payslip is ready.</p>";

  await smtpTransporter.sendMail({
    from: config.from,
    to,
    subject,
    text: `Hi ${employeeName},\n\nYour payslip for ${monthName} ${year} is now available.\n\nPlease log in to your HR portal to view the detailed breakdown.`,
    html: `<p>Hi ${employeeName},</p><p>Your payslip for <strong>${monthName} ${year}</strong> is now available.</p>${payslipHtml}<p>Please log in to your HR portal to view the detailed breakdown.</p>`,
  });
};
