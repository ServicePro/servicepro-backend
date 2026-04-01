import express from 'express';
import multer from 'multer';
import path from 'path';
import { protect } from '../middleware/authMiddleware.js';
import {
  getAllServices,
  getServiceById,
  createService,
  updateService,
  toggleServiceStatus,
  deleteService,
} from '../controllers/serviceController.js';

const router = express.Router();

// ── Multer config for service images ─────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'src/uploads/'),
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `service-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const imageFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|webp/;
  const ext = allowed.test(path.extname(file.originalname).toLowerCase());
  const mime = allowed.test(file.mimetype);
  if (ext && mime) cb(null, true);
  else cb(new Error('Only JPEG, PNG and WEBP images are allowed.'));
};

const upload = multer({
  storage,
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

// All routes are private (require JWT)
router.use(protect);

router.get('/', getAllServices);
router.get('/:id', getServiceById);
router.post('/', upload.single('image'), createService);
router.put('/:id', upload.single('image'), updateService);
router.patch('/:id/toggle-status', toggleServiceStatus);
router.delete('/:id', deleteService);

export default router;