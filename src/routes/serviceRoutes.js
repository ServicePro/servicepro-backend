import express from "express";
import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import path from "path";
import { cloudinary } from "../config/cloudinary.js";
import { protect } from "../middleware/authMiddleware.js";

import {
    createService,
    deleteService,
    // 🔒 Provider
    getAllServices,
    getFeaturedServices,
    getPublicServiceById,
    // 🌍 Public (NEW)
    getPublicServices,
    getSearchSuggestions,
    getServiceById,
    getServiceCategories,
    getTopServices,
    toggleServiceStatus,
    updateService,
} from "../controllers/serviceController.js";

const router = express.Router();


// ==============================
// 📁 Upload Config (Improved)
// ==============================
const storage = new CloudinaryStorage({
  cloudinary,
  params: async () => ({
    folder: "services",
  }),
});

const imageFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|webp/;
  const ext = allowed.test(path.extname(file.originalname).toLowerCase());
  const mime = allowed.test(file.mimetype);

  if (ext && mime) cb(null, true);
  else cb(new Error("Only JPEG, PNG, WEBP allowed"));
};

const upload = multer({
  storage,
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});




// ==============================
// 🌍 PUBLIC ROUTES (NO AUTH)
// ==============================

// 🔍 Get all services (with filters)
router.get("/public", getPublicServices);
router.get("/public/:id", getPublicServiceById);

// ⭐ Featured services (homepage)
router.get("/featured", getFeaturedServices);

// 🔥 Top / trending services
router.get("/top", getTopServices);

// � All distinct categories
router.get("/categories", getServiceCategories);

// �💡 Search suggestions (auto-complete)
router.get("/search/suggestions", getSearchSuggestions);


// ==============================
// 🔒 PROTECTED ROUTES (PROVIDER)
// ==============================
router.use(protect);

// Provider services
router.get("/", getAllServices);
router.get("/:id", getServiceById);

// CRUD
router.post("/", upload.single("image"), createService);
router.put("/:id", upload.single("image"), updateService);
router.patch("/:id/toggle-status", toggleServiceStatus);
router.delete("/:id", deleteService);


export default router;