import Booking from '../models/Booking.js';

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
    res.json({ success: true, data: booking });
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