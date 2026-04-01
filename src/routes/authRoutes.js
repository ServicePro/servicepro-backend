import express from "express";
import {
  registerUser,
  verifyUser,
  loginUser,
  googleAuth,
  linkedinInitiate,
  linkedinCallback,
  facebookInitiate,
  facebookCallback,
  forgotPassword,
  resetPassword
} from "../controllers/authController.js";

const router = express.Router();

// Email / password
router.post("/register", registerUser);
router.post("/login", loginUser);
router.get("/verify/:token", verifyUser);

// Forgot / reset password (OTP flow)
router.post("/forgot", forgotPassword);
router.post("/reset", resetPassword);

// Google (access-token flow via frontend SDK)
router.post("/google", googleAuth);

// LinkedIn (server-side code exchange)
router.get("/linkedin", linkedinInitiate);
router.get("/linkedin/callback", linkedinCallback);

// Facebook (server-side code exchange)
router.get("/facebook", facebookInitiate);
router.get("/facebook/callback", facebookCallback);

export default router;