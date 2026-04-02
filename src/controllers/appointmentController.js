import Appointment from '../models/Appointment.js';
import mongoose from 'mongoose';

// Get all appointments
const getAppointments = async (req, res, next) => {
  try {
    const providerId = req.user.id;
    const { status, service_id, date_from, date_to, page = 1, limit = 20 } = req.query;

    let query = { providerId };

    if (status) query.status = status;
    if (service_id) query.serviceId = service_id;
    if (date_from || date_to) {
      query.appointment_date = {};
      if (date_from) query.appointment_date.$gte = new Date(date_from);
      if (date_to) query.appointment_date.$lte = new Date(date_to);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // populate service to match SQL join (service_name, service_category)
    const appointmentsDocs = await Appointment.find(query)
      .populate('serviceId', 'name category image_url')
      .sort({ appointment_date: 1, appointment_time: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Appointment.countDocuments(query);

    // Get counts grouped by status
    const statusCountsAgg = await Appointment.aggregate([
      { $match: { providerId: new mongoose.Types.ObjectId(providerId) } },
      { $group: { _id: "$status", count: { $sum: 1 } } }
    ]);

    const counts = { pending: 0, confirmed: 0, completed: 0, cancelled: 0 };
    statusCountsAgg.forEach(row => {
      counts[row._id] = row.count;
    });

    const appointments = appointmentsDocs.map(doc => {
      const obj = doc.toObject();
      obj.id = obj._id;
      // Map populated fields back to flat structure expected by frontend
      if (obj.serviceId) {
        obj.service_name = obj.serviceId.name;
        obj.service_category = obj.serviceId.category;
        obj.service_image = obj.serviceId.image_url;
      }
      return obj;
    });

    res.json({
      success: true,
      data: {
        appointments,
        statusCounts: counts,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get appointment by ID
const getAppointmentById = async (req, res, next) => {
  try {
    const appointmentDoc = await Appointment.findOne({ _id: req.params.id, providerId: req.user.id })
      .populate('serviceId', 'name category');

    if (!appointmentDoc) {
      return res.status(404).json({ success: false, message: 'Appointment not found.' });
    }

    const appointment = appointmentDoc.toObject();
    appointment.id = appointment._id;
    if (appointment.serviceId) {
      appointment.service_name = appointment.serviceId.name;
      appointment.service_category = appointment.serviceId.category;
    }

    res.json({ success: true, data: { appointment } });
  } catch (error) {
    next(error);
  }
};

// Update appointment status
const updateAppointmentStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const validStatuses = ['pending', 'confirmed', 'completed', 'cancelled'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      });
    }

    const appointment = await Appointment.findOne({ _id: req.params.id, providerId: req.user.id });

    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Appointment not found.' });
    }

    const currentStatus = appointment.status;
    if (['completed', 'cancelled'].includes(currentStatus)) {
      return res.status(400).json({
        success: false,
        message: `Cannot update a ${currentStatus} appointment.`,
      });
    }

    appointment.status = status;
    await appointment.save();

    res.json({
      success: true,
      message: `Appointment status updated to "${status}".`,
      data: { status },
    });
  } catch (error) {
    next(error);
  }
};

// Get today's appointments
const getTodayAppointments = async (req, res, next) => {
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    const dateStart = new Date(todayStr);
    const dateEnd = new Date(dateStart);
    dateEnd.setDate(dateEnd.getDate() + 1);

    const appointmentsDocs = await Appointment.find({
      providerId: req.user.id,
      appointment_date: { $gte: dateStart, $lt: dateEnd }
    }).populate('serviceId', 'name category').sort({ appointment_time: 1 });

    const appointments = appointmentsDocs.map(doc => {
      const obj = doc.toObject();
      obj.id = obj._id;
      if (obj.serviceId) {
        obj.service_name = obj.serviceId.name;
        obj.service_category = obj.serviceId.category;
      }
      return obj;
    });

    res.json({ success: true, data: { appointments } });
  } catch (error) {
    next(error);
  }
};

export {
  getAppointments,
  getAppointmentById,
  updateAppointmentStatus,
  getTodayAppointments,
};