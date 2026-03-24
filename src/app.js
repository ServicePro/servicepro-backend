import express from "express";
import cors from "cors";
import landingRoutes from "./routes/landingRoutes.js";

const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use("/api/landing", landingRoutes);

export default app;