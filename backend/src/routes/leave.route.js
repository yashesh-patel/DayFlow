import express from "express";
import { protectRoute, checkRole } from "../middlewares/auth.middleware.js";
import {
  createLeaveRequest,
  getMyLeaves,
  getMyLeaveBalance,
  getAllLeaves,
  approveLeave,
  rejectLeave,
} from "../controllers/leave.controller.js";

const router = express.Router();

router.use(protectRoute);

// Employee routes
router.post("/request", checkRole(["employee"]), createLeaveRequest); // Submit leave request
router.get("/my-leaves", checkRole(["employee"]), getMyLeaves); // Get own leave history
router.get("/my-balance", checkRole(["employee"]), getMyLeaveBalance); // Get own leave balance

// Admin/HR routes
router.get("/all", checkRole(["hr"]), getAllLeaves); // Get all leave requests for this HR's employees
router.put("/approve/:id", checkRole(["hr"]), approveLeave); // Approve leave
router.put("/reject/:id", checkRole(["hr"]), rejectLeave); // Reject leave

export default router;
