import mysql from 'mysql2/promise';
import 'dotenv/config';

// Create a connection pool
export const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'servicepro_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: '+00:00',
});

// Test the connection on startup
export const testConnection = async () => {
  try {
    const connection = await pool.getConnection();
    console.log(`✅ MySQL connected → ${process.env.DB_NAME}@${process.env.DB_HOST}`);
    connection.release();
  } catch (error) {
    console.error('❌ MySQL connection failed:', error.message);
    process.exit(1);
  }
};