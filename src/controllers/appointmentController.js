import { pool } from '../config/db.js';

// Get all appointments
const getAppointments = async (req, res, next) => {
  try {
    const providerId = req.provider.id;
    const { status, service_id, date_from, date_to, page = 1, limit = 20 } = req.query;

    let query = `
      SELECT
        a.*,
        s.name        AS service_name,
        s.category    AS service_category,
        s.image_url   AS service_image
      FROM appointments a
      JOIN services s ON a.service_id = s.id
      WHERE a.provider_id = ?
    `;
    let params = [providerId];

    if (status)     { query += ` AND a.status = ?`;            params.push(status); }
    if (service_id) { query += ` AND a.service_id = ?`;        params.push(service_id); }
    if (date_from)  { query += ` AND a.appointment_date >= ?`; params.push(date_from); }
    if (date_to)    { query += ` AND a.appointment_date <= ?`; params.push(date_to); }

    query += ` ORDER BY a.appointment_date ASC, a.appointment_time ASC`;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    query += ` LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), offset);

    const [appointments] = await pool.execute(query, params);

    const [countResult] = await pool.execute(
      'SELECT COUNT(*) AS total FROM appointments WHERE provider_id = ?',
      [providerId]
    );

    const [statusCounts] = await pool.execute(
      `SELECT status, COUNT(*) AS count
       FROM appointments
       WHERE provider_id = ?
       GROUP BY status`,
      [providerId]
    );

    const counts = { pending: 0, confirmed: 0, completed: 0, cancelled: 0 };
    statusCounts.forEach((row) => { counts[row.status] = row.count; });

    res.json({
      success: true,
      data: {
        appointments,
        statusCounts: counts,
        pagination: {
          total: countResult[0].total,
          page:  parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(countResult[0].total / parseInt(limit)),
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
    const [rows] = await pool.execute(
      `SELECT a.*, s.name AS service_name, s.category AS service_category
       FROM appointments a
       JOIN services s ON a.service_id = s.id
       WHERE a.id = ? AND a.provider_id = ?`,
      [req.params.id, req.provider.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Appointment not found.' });
    }

    res.json({ success: true, data: { appointment: rows[0] } });
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

    const [rows] = await pool.execute(
      'SELECT id, status FROM appointments WHERE id = ? AND provider_id = ?',
      [req.params.id, req.provider.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Appointment not found.' });
    }

    const currentStatus = rows[0].status;
    if (['completed', 'cancelled'].includes(currentStatus)) {
      return res.status(400).json({
        success: false,
        message: `Cannot update a ${currentStatus} appointment.`,
      });
    }

    await pool.execute(
      'UPDATE appointments SET status = ?, updated_at = NOW() WHERE id = ?',
      [status, req.params.id]
    );

    if (status === 'completed') {
      await pool.execute(
        `UPDATE services
         SET total_bookings = total_bookings + 1
         WHERE id = (SELECT service_id FROM appointments WHERE id = ?)`,
        [req.params.id]
      );
    }

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
    const today = new Date().toISOString().split('T')[0];

    const [appointments] = await pool.execute(
      `SELECT a.*, s.name AS service_name, s.category AS service_category
       FROM appointments a
       JOIN services s ON a.service_id = s.id
       WHERE a.provider_id = ? AND a.appointment_date = ?
       ORDER BY a.appointment_time ASC`,
      [req.provider.id, today]
    );

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