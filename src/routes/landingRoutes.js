import express from "express";
import { getWelcomeData } from "../controllers/landingController.js";

const router = express.Router();

router.get("/", getWelcomeData);

export default router;