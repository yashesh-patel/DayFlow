import express from "express";
import { protectRoute, checkRole } from "../middlewares/auth.middleware.js";
import {
  getMyPayroll,
  getAllPayroll,
  getPayrollSummary,
  updateSalary,
  processPayroll,
  payIndividual,
} from "../controllers/payroll.controller.js";

const router = express.Router();

router.use(protectRoute);

router.get("/my-payroll", checkRole(["employee"]), getMyPayroll);
// HR/Admin only - per reference design, employees cannot view payroll/salary
router.get("/all", checkRole(["hr"]), getAllPayroll);
router.get("/summary", checkRole(["hr"]), getPayrollSummary);
router.put("/update-salary/:id", checkRole(["hr"]), updateSalary);
router.post("/process", checkRole(["hr"]), processPayroll);
router.post("/pay-individual", checkRole(["hr"]), payIndividual);

export default router;
