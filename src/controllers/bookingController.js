import Booking from '../models/Booking.js';
import { awardLoyaltyPoints } from './subscriptionController.js';

export const createBooking = async (req, res, next) => {
  try {
    const { serviceId, providerId, date, time, location, amount } = req.body;
    const newBooking = new Booking({
      userId: req.user.id,
      serviceId,
      providerId,
      date: new Date(date), // Ensure date is parsed as Date object
      time,
      location,
      amount
    });
    await newBooking.save();
    res.status(201).json({ success: true, data: newBooking });
  } catch (error) {
    next(error);
  }
};

export const getBookingById = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('serviceId', 'name category price')
      .populate('providerId', 'name email phone')
      .populate('userId', 'name email phone');
      
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }
    res.json({ success: true, data: booking });
  } catch (error) {
    next(error);
  }
};

// Used to simulate mock payment and update status directly to ACCEPTED
export const updatePaymentStatus = async (req, res, next) => {
  try {
    const { paymentState, paymentId } = req.body;
    const booking = await Booking.findByIdAndUpdate(
      req.params.id, 
      { paymentState, paymentId, status: 'ACCEPTED' }, 
      { new: true }
    );
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }

    // Award progressive loyalty points: booking #N earns N×5 pts
    const completedCount = await Booking.countDocuments({
      userId: booking.userId,
      status: { $in: ['ACCEPTED', 'ONGOING', 'COMPLETED'] },
    });
    const points = completedCount * 5; // 1st=5, 2nd=10, 3rd=15 …
    await awardLoyaltyPoints(
      booking.userId.toString(),
      points,
      `Booking #${completedCount} reward`
    );

    res.json({ success: true, data: booking, loyaltyPointsEarned: points });
  } catch (error) {
    next(error);
  }
};

export const updateTrackingStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const booking = await Booking.findByIdAndUpdate(
      req.params.id, 
      { status }, 
      { new: true }
    );
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }
    res.json({ success: true, data: booking });
  } catch (error) {
    next(error);
  }
};

export const getUserBookings = async (req, res, next) => {
  try {
    const bookings = await Booking.find({ userId: req.user.id })
      .populate('serviceId', 'name category price')
      .populate('providerId', 'name email phone')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: bookings });
  } catch (error) {
    next(error);
  }
};

// ── Provider: get all bookings for this provider ──────────────
export const getProviderBookings = async (req, res, next) => {
  try {
    const { status } = req.query;
    const query = { providerId: req.user.id };
    if (status) query.status = status.toUpperCase();

    const bookings = await Booking.find(query)
      .populate('serviceId', 'name category price image_url')
      .populate('userId', 'name email phone')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: bookings });
  } catch (error) {
    next(error);
  }
};

// ── Provider: accept / reschedule / start / complete / cancel ─
export const providerAction = async (req, res, next) => {
  try {
    const { status, scheduledDate, scheduledTime, providerNote } = req.body;
    const validStatuses = ['ACCEPTED', 'ONGOING', 'COMPLETED', 'CANCELLED'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    const booking = await Booking.findOne({ _id: req.params.id, providerId: req.user.id })
      .populate('serviceId', 'name category price image_url')
      .populate('userId', 'name email phone');

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }

    // Guard: can't change a completed or cancelled booking
    if (['COMPLETED', 'CANCELLED'].includes(booking.status)) {
      return res.status(400).json({ success: false, message: `Cannot update a ${booking.status} booking.` });
    }

    booking.status = status;
    if (scheduledDate) booking.scheduledDate = new Date(scheduledDate);
    if (scheduledTime) booking.scheduledTime = scheduledTime;
    if (providerNote !== undefined) booking.providerNote = providerNote;

    await booking.save();

    // Re-fetch with populated fields so frontend receives complete data
    const updated = await Booking.findById(booking._id)
      .populate('serviceId', 'name category price image_url')
      .populate('userId', 'name email phone');

    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};
