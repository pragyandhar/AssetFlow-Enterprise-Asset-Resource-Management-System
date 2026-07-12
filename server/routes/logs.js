const express = require('express');
const { getDb } = require('../db/schema');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

const router = express.Router();

// GET /api/logs — Activity logs
router.get('/', authenticateToken, requireRole('Admin', 'AssetManager'), (req, res) => {
  try {
    const db = getDb();
    const { user_id, action, entity_type, date_from, date_to, limit = 100 } = req.query;
    let query = 'SELECT * FROM activity_logs WHERE 1=1';
    const params = [];

    if (user_id) { query += ' AND user_id = ?'; params.push(user_id); }
    if (action) { query += ' AND action LIKE ?'; params.push(`%${action}%`); }
    if (entity_type) { query += ' AND entity_type = ?'; params.push(entity_type); }
    if (date_from) { query += ' AND created_at >= ?'; params.push(date_from); }
    if (date_to) { query += ' AND created_at <= ?'; params.push(date_to); }

    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(parseInt(limit));

    const logs = db.prepare(query).all(...params);
    logs.forEach(log => {
      try { log.details = JSON.parse(log.details); } catch { log.details = {}; }
    });

    res.json({ logs });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
