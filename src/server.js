// ================= Existing Project Setup =================
import app from "./app.js";

// ================= Added Backend Setup =================
import 'dotenv/config';
import { testConnection } from './config/db.js';

// ================= Server Configuration =================
const PORT = process.env.PORT || 5000;

// ================= Start Server =================
const startServer = async () => {
  try {
    // Test database connection (newly added)
    await testConnection();

    app.listen(PORT, () => {
      console.log("\n🚀 Server started successfully");
      console.log(`   Port:        http://localhost:${PORT}`);
      console.log(`   Health:      http://localhost:${PORT}/health`);
      console.log(`   Environment: ${process.env.NODE_ENV}\n`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

startServer();