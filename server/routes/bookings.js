const express = require('express');
const { getDb } = require('../db/schema');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/bookings — List bookings
router.get('/', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const { asset_id, status, date_from, date_to } = req.query;
    let query = `
      SELECT b.*, a.name as asset_name, a.asset_tag, a.location,
        u.name as booked_by_name
      FROM bookings b
      JOIN assets a ON b.asset_id = a.id
      JOIN users u ON b.booked_by = u.id
      WHERE 1=1
    `;
    const params = [];

    if (asset_id) { query += ' AND b.asset_id = ?'; params.push(asset_id); }
    if (status) { query += ' AND b.status = ?'; params.push(status); }
    if (date_from) { query += ' AND b.start_time >= ?'; params.push(date_from); }
    if (date_to) { query += ' AND b.end_time <= ?'; params.push(date_to); }

    if (req.user.role === 'Employee') {
      query += ' AND b.booked_by = ?';
      params.push(req.user.id);
    }

    query += ' ORDER BY b.start_time ASC';
    const bookings = db.prepare(query).all(...params);

    // Auto-update statuses
    const now = new Date().toISOString();
    bookings.forEach(b => {
      if (b.status === 'Upcoming' && b.start_time <= now && b.end_time > now) {
        db.prepare("UPDATE bookings SET status = 'Ongoing' WHERE id = ?").run(b.id);
        b.status = 'Ongoing';
      } else if ((b.status === 'Upcoming' || b.status === 'Ongoing') && b.end_time <= now) {
        db.prepare("UPDATE bookings SET status = 'Completed' WHERE id = ?").run(b.id);
        b.status = 'Completed';
      }
    });

    res.json({ bookings });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/bookings/resources — List bookable resources
router.get('/resources', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const resources = db.prepare(`
      SELECT a.id, a.name, a.asset_tag, a.location, a.status, c.name as category_name
      FROM assets a
      LEFT JOIN asset_categories c ON a.category_id = c.id
      WHERE a.is_bookable = 1 AND a.status NOT IN ('Retired', 'Disposed', 'Lost')
      ORDER BY a.name
    `).all();
    res.json({ resources });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/bookings/calendar/:asset_id — Calendar view for a resource
router.get('/calendar/:asset_id', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const { month, year } = req.query;
    const m = parseInt(month) || (new Date().getMonth() + 1);
    const y = parseInt(year) || new Date().getFullYear();

    const startDate = `${y}-${String(m).padStart(2, '0')}-01T00:00:00`;
    const endMonth = m === 12 ? 1 : m + 1;
    const endYear = m === 12 ? y + 1 : y;
    const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01T00:00:00`;

    const bookings = db.prepare(`
      SELECT b.*, u.name as booked_by_name
      FROM bookings b
      JOIN users u ON b.booked_by = u.id
      WHERE b.asset_id = ? AND b.start_time >= ? AND b.start_time < ? AND b.status != 'Cancelled'
      ORDER BY b.start_time ASC
    `).all(req.params.asset_id, startDate, endDate);

    res.json({ bookings });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/bookings — Create booking with overlap validation
router.post('/', authenticateToken, (req, res) => {
  try {
    const { asset_id, start_time, end_time, purpose } = req.body;

    if (!asset_id || !start_time || !end_time) {
      return res.status(400).json({ error: 'Asset, start time, and end time are required' });
    }

    if (new Date(start_time) >= new Date(end_time)) {
      return res.status(400).json({ error: 'End time must be after start time' });
    }

    if (new Date(start_time) < new Date()) {
      return res.status(400).json({ error: 'Cannot book in the past' });
    }

    const db = getDb();

    // Check asset is bookable
    const asset = db.prepare('SELECT * FROM assets WHERE id = ? AND is_bookable = 1').get(asset_id);
    if (!asset) return res.status(404).json({ error: 'Resource not found or not bookable' });

    // Overlap validation: reject if any existing booking overlaps
    // Two bookings overlap if: start1 < end2 AND start2 < end1
    // Adjacent bookings (end1 = start2) are allowed
    const overlap = db.prepare(`
      SELECT b.*, u.name as booked_by_name
      FROM bookings b JOIN users u ON b.booked_by = u.id
      WHERE b.asset_id = ? AND b.status != 'Cancelled'
      AND b.start_time < ? AND b.end_time > ?
    `).get(asset_id, end_time, start_time);

    if (overlap) {
      return res.status(409).json({
        error: `Time slot overlaps with existing booking by ${overlap.booked_by_name} (${overlap.start_time} - ${overlap.end_time})`,
        conflicting_booking: overlap
      });
    }

    const result = db.prepare(`
      INSERT INTO bookings (asset_id, booked_by, start_time, end_time, purpose, status)
      VALUES (?, ?, ?, ?, ?, 'Upcoming')
    `).run(asset_id, req.user.id, start_time, end_time, purpose || null);

    // Notification
    db.prepare('INSERT INTO notifications (user_id, type, title, message, reference_type, reference_id) VALUES (?, ?, ?, ?, ?, ?)')
      .run(req.user.id, 'BookingConfirmed', 'Booking Confirmed', `${asset.name} booked for ${start_time} to ${end_time}.`, 'booking', result.lastInsertRowid);

    // Log
    db.prepare('INSERT INTO activity_logs (user_id, user_name, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)')
      .run(req.user.id, req.user.name, 'BOOK', 'booking', result.lastInsertRowid, JSON.stringify({ asset: asset.name, start_time, end_time }));

    const booking = db.prepare(`
      SELECT b.*, a.name as asset_name, a.asset_tag, u.name as booked_by_name
      FROM bookings b JOIN assets a ON b.asset_id = a.id JOIN users u ON b.booked_by = u.id
      WHERE b.id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json({ booking });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/bookings/:id/cancel — Cancel booking
router.put('/:id/cancel', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    if (req.user.role === 'Employee' && booking.booked_by !== req.user.id) {
      return res.status(403).json({ error: 'You can only cancel your own bookings' });
    }

    if (booking.status === 'Completed' || booking.status === 'Cancelled') {
      return res.status(400).json({ error: 'Booking cannot be cancelled' });
    }

    db.prepare("UPDATE bookings SET status = 'Cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(req.params.id);

    db.prepare('INSERT INTO notifications (user_id, type, title, message, reference_type, reference_id) VALUES (?, ?, ?, ?, ?, ?)')
      .run(booking.booked_by, 'BookingCancelled', 'Booking Cancelled', `Booking #${req.params.id} has been cancelled.`, 'booking', req.params.id);

    db.prepare('INSERT INTO activity_logs (user_id, user_name, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)')
      .run(req.user.id, req.user.name, 'CANCEL_BOOKING', 'booking', req.params.id, JSON.stringify({}));

    res.json({ message: 'Booking cancelled' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
