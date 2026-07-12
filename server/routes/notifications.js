const express = require('express');
const { getDb } = require('../db/schema');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/notifications — User's notifications
router.get('/', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const { unread_only } = req.query;
    let query = 'SELECT * FROM notifications WHERE user_id = ?';
    if (unread_only === 'true') query += ' AND is_read = 0';
    query += ' ORDER BY created_at DESC LIMIT 50';
    const notifications = db.prepare(query).all(req.user.id);
    const unread_count = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0').get(req.user.id).count;
    res.json({ notifications, unread_count });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/notifications/:id/read — Mark single notification read
router.put('/:id/read', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
    res.json({ message: 'Marked as read' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/notifications/read-all — Mark all read
router.put('/read-all', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.user.id);
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
