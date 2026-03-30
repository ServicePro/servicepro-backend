import mysql from 'mysql2/promise';
import fs from 'fs/promises';
import path from 'path';
import 'dotenv/config';

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = parseInt(process.env.DB_PORT, 10) || 3306;
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || '';
const DB_NAME = process.env.DB_NAME || 'servicepro_db';

let pool;

// create database + tables from schema.sql
export const initializeDatabase = async () => {
  let connection;

  try {
    // 1. connect without selecting a database
    connection = await mysql.createConnection({
      host: DB_HOST,
      port: DB_PORT,
      user: DB_USER,
      password: DB_PASSWORD,
      multipleStatements: true,
    });

    console.log('⏳ Connected to MySQL server');

    // 2. read schema.sql
    const schemaPath = path.resolve(process.cwd(), 'src/database/schema.sql');
    const schemaSql = await fs.readFile(schemaPath, 'utf8');

    // 3. run schema file
    await connection.query(schemaSql);
    console.log(`✅ Database '${DB_NAME}' initialized from schema.sql`);

    await connection.end();

    // 4. create pool for app usage
    pool = mysql.createPool({
      host: DB_HOST,
      port: DB_PORT,
      user: DB_USER,
      password: DB_PASSWORD,
      database: DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      timezone: '+00:00',
      multipleStatements: true,
    });

    console.log(`✅ Pool created for database '${DB_NAME}'`);
  } catch (error) {
    if (connection) {
      try {
        await connection.end();
      } catch {}
    }

    console.error('❌ Database initialization failed:', error.message);
    process.exit(1);
  }
};

export const getPool = () => {
  if (!pool) {
    throw new Error('Database pool is not initialized. Call initializeDatabase() first.');
  }
  return pool;
};

export const testConnection = async () => {
  try {
    const connection = await getPool().getConnection();
    console.log(`✅ MySQL connected → ${DB_NAME}@${DB_HOST}:${DB_PORT}`);
    connection.release();
  } catch (error) {
    console.error('❌ MySQL connection failed:', error.message);
    process.exit(1);
  }
};

export { pool };