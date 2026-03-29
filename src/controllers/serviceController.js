import { pool } from '../config/db.js';

// ─────────────────────────────────────────────────────────────
// @desc    Get all services for the logged-in provider
// ─────────────────────────────────────────────────────────────
const getServices = async (req, res, next) => {
  try {
    const providerId = req.provider.id;
    const { status, category, search, page = 1, limit = 20 } = req.query;

    let query  = `SELECT * FROM services WHERE provider_id = ?`;
    let params = [providerId];

    if (status)   { query += ` AND status = ?`;                         params.push(status); }
    if (category) { query += ` AND category = ?`;                       params.push(category); }
    if (search)   { query += ` AND (name LIKE ? OR description LIKE ?)`; params.push(`%${search}%`, `%${search}%`); }

    query += ` ORDER BY created_at DESC`;

    // Pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);
    query += ` LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), offset);

    const [services] = await pool.execute(query, params);

    // Total count
    const [countResult] = await pool.execute(
      `SELECT COUNT(*) AS total FROM services WHERE provider_id = ?`,
      [providerId]
    );

    res.json({
      success: true,
      data: {
        services,
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

// ─────────────────────────────────────────────────────────────
const getServiceById = async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM services WHERE id = ? AND provider_id = ?',
      [req.params.id, req.provider.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Service not found.' });
    }

    res.json({ success: true, data: { service: rows[0] } });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────
const createService = async (req, res, next) => {
  try {
    const {
      name, category, description, price, duration_minutes,
      max_bookings_per_day, available_days, start_time, end_time, tags,
    } = req.body;

    if (!name || !category || !price || !duration_minutes) {
      return res.status(400).json({
        success: false,
        message: 'Name, category, price, and duration are required.',
      });
    }

    const image_url = req.file ? `/uploads/${req.file.filename}` : null;

    const [result] = await pool.execute(
      `INSERT INTO services
         (provider_id, name, category, description, price, duration_minutes,
          max_bookings_per_day, available_days, start_time, end_time, tags, image_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.provider.id,
        name,
        category,
        description || null,
        parseFloat(price),
        parseInt(duration_minutes),
        max_bookings_per_day ? parseInt(max_bookings_per_day) : 5,
        available_days || 'Mon,Tue,Wed,Thu,Fri',
        start_time || '08:00:00',
        end_time   || '18:00:00',
        tags || null,
        image_url,
      ]
    );

    const [rows] = await pool.execute(
      'SELECT * FROM services WHERE id = ?',
      [result.insertId]
    );

    res.status(201).json({
      success: true,
      message: 'Service created successfully.',
      data: { service: rows[0] },
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────
const updateService = async (req, res, next) => {
  try {
    const [existing] = await pool.execute(
      'SELECT id FROM services WHERE id = ? AND provider_id = ?',
      [req.params.id, req.provider.id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Service not found.' });
    }

    const {
      name, category, description, price, duration_minutes,
      max_bookings_per_day, available_days, start_time, end_time, tags, status,
    } = req.body;

    const image_url = req.file ? `/uploads/${req.file.filename}` : undefined;

    const fields = [];
    const params = [];

    if (name) fields.push('name = ?'), params.push(name);
    if (category) fields.push('category = ?'), params.push(category);
    if (description !== undefined) fields.push('description = ?'), params.push(description);
    if (price !== undefined) fields.push('price = ?'), params.push(parseFloat(price));
    if (duration_minutes) fields.push('duration_minutes = ?'), params.push(parseInt(duration_minutes));
    if (max_bookings_per_day) fields.push('max_bookings_per_day = ?'), params.push(parseInt(max_bookings_per_day));
    if (available_days) fields.push('available_days = ?'), params.push(available_days);
    if (start_time) fields.push('start_time = ?'), params.push(start_time);
    if (end_time) fields.push('end_time = ?'), params.push(end_time);
    if (tags !== undefined) fields.push('tags = ?'), params.push(tags);
    if (status) fields.push('status = ?'), params.push(status);
    if (image_url) fields.push('image_url = ?'), params.push(image_url);

    if (fields.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update.' });
    }

    fields.push('updated_at = NOW()');
    params.push(req.params.id);

    await pool.execute(
      `UPDATE services SET ${fields.join(', ')} WHERE id = ?`,
      params
    );

    const [rows] = await pool.execute(
      'SELECT * FROM services WHERE id = ?',
      [req.params.id]
    );

    res.json({
      success: true,
      message: 'Service updated successfully.',
      data: { service: rows[0] },
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────
const toggleServiceStatus = async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, status FROM services WHERE id = ? AND provider_id = ?',
      [req.params.id, req.provider.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Service not found.' });
    }

    const newStatus = rows[0].status === 'active' ? 'inactive' : 'active';

    await pool.execute(
      'UPDATE services SET status = ?, updated_at = NOW() WHERE id = ?',
      [newStatus, req.params.id]
    );

    res.json({
      success: true,
      message: `Service ${newStatus === 'active' ? 'activated' : 'deactivated'} successfully.`,
      data: { status: newStatus },
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────
const deleteService = async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id FROM services WHERE id = ? AND provider_id = ?',
      [req.params.id, req.provider.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Service not found.' });
    }

    const [activeAppts] = await pool.execute(
      `SELECT COUNT(*) AS cnt FROM appointments
       WHERE service_id = ? AND status IN ('pending','confirmed')`,
      [req.params.id]
    );

    if (activeAppts[0].cnt > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete: ${activeAppts[0].cnt} active appointment(s) exist.`,
      });
    }

    await pool.execute('DELETE FROM services WHERE id = ?', [req.params.id]);

    res.json({ success: true, message: 'Service deleted successfully.' });
  } catch (error) {
    next(error);
  }
};

export {
  getServices,
  getServiceById,
  createService,
  updateService,
  toggleServiceStatus,
  deleteService,
};