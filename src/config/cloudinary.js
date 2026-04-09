import { v2 as cloudinary } from "cloudinary";

const cloudName = process.env.CLOUDINARY_CLOUD_NAME || process.env.CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY || process.env.API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET || process.env.API_SECRET;

cloudinary.config({
  cloud_name: cloudName,
  api_key: apiKey,
  api_secret: apiSecret,
});

export { cloudinary };
