import express from "express";
import {
  addTaskComment,
  createTask,
  getTaskById,
  getTasks,
  sendDueSoonTaskReminders,
  updateTask,
} from "../controllers/task.controller.js";
import { checkRole, protectRoute } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.use(protectRoute);

router.get("/", checkRole(["hr", "employee", "client"]), getTasks);
router.post("/", express.json(), checkRole(["hr"]), createTask);
router.post(
  "/reminders/due-in-two-days",
  express.json(),
  checkRole(["hr"]),
  sendDueSoonTaskReminders,
);
router.get("/:taskId", checkRole(["hr", "employee", "client"]), getTaskById);
router.patch(
  "/:taskId",
  express.json(),
  checkRole(["hr", "employee"]),
  updateTask,
);
router.post(
  "/:taskId/comments",
  express.json(),
  checkRole(["hr", "employee", "client"]),
  addTaskComment,
);

export default router;
