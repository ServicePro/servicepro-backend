import mongoose from 'mongoose';
import 'dotenv/config';

export const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI || 'mongodb+srv://servicepro_dev:adminservicepro@servicepro-cluster.sse9fxs.mongodb.net/servicepro?appName=ServicePro-Cluster');
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    process.exit(1);
  }
};