import Provider from '../models/Provider.js';
import Service from '../models/Service.js';

const parseAreaToServiceLocation = (area = '') => {
  const normalized = String(area || '').trim();
  if (!normalized) return null;

  const [cityRaw, ...districtParts] = normalized.split(',').map((part) => part.trim()).filter(Boolean);
  return {
    city: cityRaw || normalized,
    district: districtParts.join(', ') || undefined,
  };
};

// Create a new service
const createService = async (req, res, next) => {
  try {
    const { name, category, description, price, duration_minutes, available_days, max_bookings_per_day } = req.body;
    let imageUrl = null;

    if (req.file) {
      imageUrl = req.file.path || req.file.secure_url || `/uploads/${req.file.filename}`;
    }

    const provider = await Provider.findById(req.user.id).select('area').lean();
    const derivedLocation = parseAreaToServiceLocation(provider?.area);

    const service = new Service({
      providerId: req.user.id, // from authMiddleware
      name,
      category,
      description,
      price: parseFloat(price),
      duration_minutes: parseInt(duration_minutes),
      available_days: available_days ? available_days.split(',') : undefined,
      max_bookings_per_day: max_bookings_per_day ? parseInt(max_bookings_per_day) : undefined,
      image_url: imageUrl,
      location: derivedLocation || undefined,
    });

    const savedService = await service.save();

    res.status(201).json({
      success: true,
      data: { service: savedService, message: 'Service created successfully' },
    });
  } catch (error) {
    next(error);
  }
};

// Get all services
const getAllServices = async (req, res, next) => {
  try {
    // Only fetch services for the current provider
    const services = await Service.find({ providerId: req.user.id }).sort({ createdAt: -1 });
    
    // Map _id to id to keep frontend stable if necessary, or let frontend use _id
    const mappedServices = services.map(s => {
      const obj = s.toObject();
      obj.id = obj._id;
      return obj;
    });

    res.json({
      success: true,
      data: { services: mappedServices },
    });
  } catch (error) {
    next(error);
  }
};

// Get service by ID
const getServiceById = async (req, res, next) => {
  try {
    const service = await Service.findOne({ _id: req.params.id, providerId: req.user.id });

    if (!service) {
      return res.status(404).json({ success: false, message: 'Service not found.' });
    }

    res.json({
      success: true,
      data: { service },
    });
  } catch (error) {
    next(error);
  }
};

// Update a service
const updateService = async (req, res, next) => {
  try {
    const { name, category, description, price, duration_minutes, status, available_days, max_bookings_per_day } = req.body;
    
    const service = await Service.findOne({ _id: req.params.id, providerId: req.user.id });
    if (!service) {
      return res.status(404).json({ success: false, message: 'Service not found or unauthorized' });
    }

    if (name) service.name = name;
    if (category) service.category = category;
    if (description) service.description = description;
    if (price) service.price = parseFloat(price);
    if (duration_minutes) service.duration_minutes = parseInt(duration_minutes);
    if (status) service.status = status;
    if (available_days) service.available_days = typeof available_days === 'string' ? available_days.split(',') : available_days;
    if (max_bookings_per_day) service.max_bookings_per_day = parseInt(max_bookings_per_day);
    
    if (req.file) {
      service.image_url = req.file.path || req.file.secure_url || `/uploads/${req.file.filename}`;
    }

    const updatedService = await service.save();

    res.json({
      success: true,
      message: 'Service updated successfully.',
      data: { service: updatedService },
    });
  } catch (error) {
    next(error);
  }
};

// Toggle service status
const toggleServiceStatus = async (req, res, next) => {
  try {
    const service = await Service.findOne({ _id: req.params.id, providerId: req.user.id });
    if (!service) {
      return res.status(404).json({ success: false, message: 'Service not found.' });
    }

    service.status = service.status === 'active' ? 'inactive' : 'active';
    await service.save();

    res.json({
      success: true,
      message: `Service marked as ${service.status}.`,
      data: { status: service.status },
    });
  } catch (error) {
    next(error);
  }
};

// Delete a service
const deleteService = async (req, res, next) => {
  try {
    if (req.user.role !== 'provider') {
      return res.status(403).json({ success: false, message: 'Only providers can delete services.' });
    }

    // First find so we can give a descriptive error if ID is valid but belongs to someone else
    const existing = await Service.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Service not found.' });
    }
    if (existing.providerId.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'You are not authorised to delete this service.' });
    }

    await Service.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Service permanently deleted.',
    });
  } catch (error) {
    next(error);
  }
};

const getPublicServices = async (req, res, next) => {
  try {
    const {
      search,
      category,
      location,
      minPrice,
      maxPrice,
      rating,
      sort = "rating",
      page = 1,
      limit = 10,
    } = req.query;

    let query = { status: "active" };
    const andFilters = [];

    // 🔍 SEARCH — regex on name, category, description (no text index required)
    if (search) {
      const re = new RegExp(search.trim(), 'i');
      andFilters.push({
        $or: [
        { name: re },
        { category: re },
        { description: re },
        ],
      });
    }

    // 🏷 CATEGORY
    if (category) {
      query.category = category;
    }

    // 📍 LOCATION (NEW)
    if (location) {
      const locationRe = new RegExp(location.trim(), "i");
      const providerIdsByArea = await Provider.find({ area: locationRe }).distinct("_id");

      andFilters.push({
        $or: [
          { "location.city": locationRe },
          { "location.district": locationRe },
          { providerId: { $in: providerIdsByArea } },
        ],
      });
    }

    // 💰 PRICE RANGE
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }

    // ⭐ RATING FILTER (NEW)
    if (rating) {
      query.rating = { $gte: Number(rating) };
    }

    if (andFilters.length > 0) {
      query.$and = andFilters;
    }

    const skip = (page - 1) * limit;

    // 🔽 SORTING (UPGRADED)
    let sortOption = {};

    switch (sort) {
      case "price_low":
        sortOption.price = 1;
        break;
      case "price_high":
        sortOption.price = -1;
        break;
      case "newest":
        sortOption.createdAt = -1;
        break;
      case "popular":
        sortOption.total_bookings = -1;
        break;
      default:
        sortOption.rating = -1;
    }

    const services = await Service.find(query)
      .populate("providerId", "name area")
      .sort(sortOption)
      .skip(skip)
      .limit(Number(limit));

    const normalizedServices = services.map((service) => {
      const serviceObj = service.toObject();
      if (!serviceObj.providerLocation && serviceObj.providerId?.area) {
        serviceObj.providerLocation = serviceObj.providerId.area;
      }
      return serviceObj;
    });

    const total = await Service.countDocuments(query);

    res.json({
      success: true,
      data: {
        services: normalizedServices,
        pagination: {
          total,
          page: Number(page),
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

const getPublicServiceById = async (req, res, next) => {
  try {
    const service = await Service.findOne({ _id: req.params.id, status: "active" }).populate("providerId", "name area");

    if (!service) {
      return res.status(404).json({ success: false, message: "Service not found." });
    }

    res.json({
      success: true,
      data: { service },
    });
  } catch (error) {
    next(error);
  }
};

const getFeaturedServices = async (req, res, next) => {
  try {
    const services = await Service.find({
      featured: true,
      status: "active",
    }).limit(8);

    res.json({
      success: true,
      data: { services },
    });
  } catch (error) {
    next(error);
  }
};

const getSearchSuggestions = async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q || !q.trim()) return res.json([]);

    const re = new RegExp(q.trim(), 'i');
    const results = await Service.find({
      status: 'active',
      $or: [{ name: re }, { category: re }],
    })
      .select('name category')
      .limit(8)
      .lean();

    res.json(results);
  } catch (error) {
    next(error);
  }
};

const getTopServices = async (req, res, next) => {
  try {
    // placeholder - implement top services logic
    res.json({ success: true, data: { services: [] } });
  } catch (error) {
    next(error);
  }
};

// GET /api/services/categories  (public — no auth)
const getServiceCategories = async (req, res, next) => {
  try {
    const categories = await Service.aggregate([
      { $match: { status: 'active' } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $project: { _id: 0, category: '$_id', count: 1 } },
    ]);
    res.json({ success: true, data: categories });
  } catch (error) {
    next(error);
  }
};

export {
    createService,
    deleteService,
    getAllServices,
    getFeaturedServices, getPublicServiceById, getPublicServices, getSearchSuggestions,
    getServiceById,
    getServiceCategories,
    getTopServices,
    toggleServiceStatus,
    updateService
};

