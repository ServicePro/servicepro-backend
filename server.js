import app from "./app.js";
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

// 🔹 ENV Variables
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

// 🔐 Validate critical env variables
if (!MONGO_URI) {
  console.error("❌ MONGO_URI is missing in .env");
  process.exit(1);
}

if (!process.env.JWT_SECRET) {
  console.error("❌ JWT_SECRET is missing in .env");
  process.exit(1);
}

// 🔗 MongoDB Connection
const connectDB = async () => {
  try {
    await mongoose.connect(MONGO_URI, {
      dbName: "servicepro", // ✅ Ensures correct DB is used
    });

    console.log("✅ MongoDB connected successfully");
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error.message);
    process.exit(1);
  }
};

// 🚀 Start Server
const startServer = async () => {
  await connectDB();

  const server = app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
  });

  // ❗ Handle server errors
  server.on("error", (err) => {
    console.error("❌ Server error:", err);
  });

  // 🛑 Graceful shutdown
  process.on("SIGINT", async () => {
    console.log("🛑 Gracefully shutting down...");
    await mongoose.connection.close();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    console.log("🛑 Server terminated");
    await mongoose.connection.close();
    process.exit(0);
  });

  // 🔥 Catch unhandled promise rejections
  process.on("unhandledRejection", (err) => {
    console.error("❌ Unhandled Rejection:", err.message);
    server.close(() => process.exit(1));
  });

  // 🔥 Catch uncaught exceptions
  process.on("uncaughtException", (err) => {
    console.error("❌ Uncaught Exception:", err.message);
    process.exit(1);
  });
};

// ▶️ Run server
startServer();