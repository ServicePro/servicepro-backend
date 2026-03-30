// ================= Existing Project Setup =================
import app from "./app.js";

// ================= Added Backend Setup =================
import 'dotenv/config';
import { initializeDatabase, testConnection } from './config/db.js';

// ================= Server Configuration =================
const PORT = process.env.PORT || 5000;

// ================= Start Server =================
const startServer = async () => {
  try {
    // 1. Create database and tables from schema.sql
    await initializeDatabase();

    // 2. Test database connection
    await testConnection();

    // 3. Start server
    app.listen(PORT, () => {
      console.log("\n🚀 Server started successfully");
      console.log(`   Port:        http://localhost:${PORT}`);
      console.log(`   Health:      http://localhost:${PORT}/health`);
      console.log(`   Environment: ${process.env.NODE_ENV}\n`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error.message);
    process.exit(1);
  }
};

startServer();