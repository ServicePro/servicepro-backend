import Service from '../models/Service.js';
import mongoose from 'mongoose';

// Create a new service
const createService = async (req, res, next) => {
  try {
    const { name, category, description, price, duration_minutes, available_days, max_bookings_per_day } = req.body;
    let imageUrl = null;

    if (req.file) {
      imageUrl = `/uploads/${req.file.filename}`;
    }

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
      service.image_url = `/uploads/${req.file.filename}`;
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
    const service = await Service.findOneAndDelete({ _id: req.params.id, providerId: req.user.id });
    
    if (!service) {
      return res.status(404).json({ success: false, message: 'Service not found.' });
    }

    res.json({
      success: true,
      message: 'Service permanently deleted.',
    });
  } catch (error) {
    next(error);
  }
};

export {
  createService,
  getAllServices,
  getServiceById,
  updateService,
  toggleServiceStatus,
  deleteService,
};