import express from "express";
import {
  connectToHr,
  getHrDirectory,
  getMyConnections,
} from "../controllers/client.controller.js";
import { checkRole, protectRoute } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.use(protectRoute);
router.use(checkRole(["client"]));

router.get("/hrs", getHrDirectory);
router.get("/connections", getMyConnections);
router.post("/connections/:hrId", express.json(), connectToHr);

export default router;
