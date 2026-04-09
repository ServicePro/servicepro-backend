import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import User from "../models/User.js";

dotenv.config();

const admins = [
  { name: "Admin One",   email: "admin1@servicepro.com", password: "Admin@1234" },
  { name: "Admin Two",   email: "admin2@servicepro.com", password: "Admin@5678" },
  { name: "Admin Three", email: "admin3@servicepro.com", password: "Admin@9012" }
];

const seed = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to DB");

  for (const a of admins) {
    const exists = await User.findOne({ email: a.email });
    if (exists) {
      console.log(`Skipped (already exists): ${a.email}`);
      continue;
    }
    const hashed = await bcrypt.hash(a.password, 10);
    await User.create({ name: a.name, email: a.email, password: hashed, isVerified: true, role: "admin" });
    console.log(`Created admin: ${a.email}`);
  }

  await mongoose.disconnect();
  console.log("Done.");
};

seed().catch(console.error);
