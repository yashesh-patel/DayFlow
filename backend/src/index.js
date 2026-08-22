import dotenv from "dotenv";
dotenv.config();

import { testConnection } from "./lib/db.js";
import { ensureWorkflowSchema } from "./lib/schema.js";
import express from "express";
import path from "path";
import cookieParser from "cookie-parser";

import authRoutes from "./routes/auth.route.js";
import employeeRoutes from "./routes/employee.route.js";
import profileRoutes from "./routes/profile.route.js";
import attendanceRoutes from "./routes/attendance.route.js";
import leaveRoutes from "./routes/leave.route.js";
import payrollRoutes from "./routes/payroll.route.js";
import cors from "cors";
const app = express();
app.use(express.json());
app.use(cookieParser());
const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",").map((origin) => origin.trim())
  : [
      "http://localhost:8081",
      "http://localhost:5173",
      "http://localhost:8080",
      "http://localhost:3000",
    ];

app.use(
  cors({
    origin: corsOrigins,
    credentials: true,
  }),
);

const PORT = process.env.PORT || 3001;

app.use("/api/v1/auth/users", authRoutes);
app.use("/api/v1/hr", employeeRoutes);
app.use("/api/v1/up", profileRoutes);
app.use("/api/v1/attendance", attendanceRoutes);
app.use("/api/v1/leave", leaveRoutes);
app.use("/api/v1/payroll", payrollRoutes);

app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

const startServer = async () => {
  await testConnection();
  await ensureWorkflowSchema();

  app.listen(PORT, () => {
    console.log(`>>> Server is running on http://localhost:${PORT}`);
  });
};

startServer().catch((error) => {
  console.error("Failed to start server:", error.message);
  process.exit(1);
});
