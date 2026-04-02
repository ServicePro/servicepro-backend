import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

// Existing group route
import landingRoutes from "./routes/landingRoutes.js";
import providerRoutes from "./routes/providerRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import authRoutes from "./routes/authRoutes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ===== Your newly added middleware / routes =====
import { errorHandler, notFound } from "./middleware/errorMiddleware.js";
import serviceRoutes from "./routes/serviceRoutes.js";
import appointmentRoutes from "./routes/appointmentRoutes.js";
import analyticsRoutes from "./routes/analyticsRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
// ===== End of your newly added imports =====

const app = express();


/* =========================================================
   EXISTING GROUP MIDDLEWARE
========================================================= */
app.use(cors());
app.use(express.json());

// Serve uploaded provider documents
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

/* =========================================================
   YOUR NEWLY ADDED MIDDLEWARE
========================================================= */
app.use(express.urlencoded({ extended: true }));

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

/* =========================================================
   EXISTING GROUP ROUTES
========================================================= */
app.use("/landing", landingRoutes);

/* =========================================================
   YOUR NEWLY ADDED ROUTES
========================================================= */
app.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "ServicePro API is running 🚀",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/providers", providerRoutes);
app.use("/api/admin", adminRoutes);

/* =========================================================
   YOUR NEWLY ADDED ERROR HANDLERS
========================================================= */
app.use(notFound);
app.use(errorHandler);

export default app;