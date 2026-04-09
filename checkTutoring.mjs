import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import Provider from './src/models/Provider.js';

await mongoose.connect(process.env.MONGO_URI);
const rows = await Provider.find(
  { category: { $regex: 'tutor', $options: 'i' } },
  'name email category status is_active createdAt'
).lean();
console.table(rows.map(r => ({
  name: r.name,
  email: r.email,
  category: r.category,
  status: r.status,
  is_active: r.is_active,
  created: r.createdAt?.toISOString().slice(0,19)
})));
await mongoose.disconnect();
