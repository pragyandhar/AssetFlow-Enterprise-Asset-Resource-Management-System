const express = require('express');
const { getDb, generateAssetTag } = require('../db/schema');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

const router = express.Router();

// GET /api/assets — List/search assets
router.get('/', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const { search, category_id, status, department_id, location, is_bookable, page = 1, limit = 50 } = req.query;
    let query = `
      SELECT a.*, 
        c.name as category_name,
        d.name as department_name,
        (SELECT u.name FROM allocations al JOIN users u ON al.allocated_to = u.id WHERE al.asset_id = a.id AND al.status = 'Active' LIMIT 1) as current_holder
      FROM assets a
      LEFT JOIN asset_categories c ON a.category_id = c.id
      LEFT JOIN departments d ON a.department_id = d.id
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      query += ' AND (a.name LIKE ? OR a.asset_tag LIKE ? OR a.serial_number LIKE ? OR a.location LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (category_id) { query += ' AND a.category_id = ?'; params.push(category_id); }
    if (status) { query += ' AND a.status = ?'; params.push(status); }
    if (department_id) { query += ' AND a.department_id = ?'; params.push(department_id); }
    if (location) { query += ' AND a.location LIKE ?'; params.push(`%${location}%`); }
    if (is_bookable !== undefined) { query += ' AND a.is_bookable = ?'; params.push(is_bookable === 'true' ? 1 : 0); }

    query += ' ORDER BY a.created_at DESC';

    const offset = (parseInt(page) - 1) * parseInt(limit);
    query += ' LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const assets = db.prepare(query).all(...params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM assets WHERE 1=1';
    const countParams = [];
    if (search) {
      countQuery += ' AND (name LIKE ? OR asset_tag LIKE ? OR serial_number LIKE ? OR location LIKE ?)';
      countParams.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (category_id) { countQuery += ' AND category_id = ?'; countParams.push(category_id); }
    if (status) { countQuery += ' AND status = ?'; countParams.push(status); }
    if (department_id) { countQuery += ' AND department_id = ?'; countParams.push(department_id); }
    if (is_bookable !== undefined) { countQuery += ' AND is_bookable = ?'; countParams.push(is_bookable === 'true' ? 1 : 0); }

    const { total } = db.prepare(countQuery).get(...countParams);

    res.json({ assets, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/assets/:id — Asset detail with history
router.get('/:id', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const asset = db.prepare(`
      SELECT a.*, c.name as category_name, d.name as department_name
      FROM assets a
      LEFT JOIN asset_categories c ON a.category_id = c.id
      LEFT JOIN departments d ON a.department_id = d.id
      WHERE a.id = ?
    `).get(req.params.id);

    if (!asset) return res.status(404).json({ error: 'Asset not found' });

    // Get allocation history
    const allocations = db.prepare(`
      SELECT al.*, u.name as allocated_to_name, ab.name as allocated_by_name, d.name as department_name
      FROM allocations al
      LEFT JOIN users u ON al.allocated_to = u.id
      LEFT JOIN users ab ON al.allocated_by = ab.id
      LEFT JOIN departments d ON al.department_id = d.id
      WHERE al.asset_id = ?
      ORDER BY al.created_at DESC
    `).all(req.params.id);

    // Get maintenance history
    const maintenance = db.prepare(`
      SELECT m.*, u.name as requested_by_name, a2.name as approved_by_name
      FROM maintenance_requests m
      LEFT JOIN users u ON m.requested_by = u.id
      LEFT JOIN users a2 ON m.approved_by = a2.id
      WHERE m.asset_id = ?
      ORDER BY m.created_at DESC
    `).all(req.params.id);

    // Get bookings
    const bookings = db.prepare(`
      SELECT b.*, u.name as booked_by_name
      FROM bookings b
      LEFT JOIN users u ON b.booked_by = u.id
      WHERE b.asset_id = ?
      ORDER BY b.start_time DESC
    `).all(req.params.id);

    res.json({ asset, allocations, maintenance, bookings });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/assets — Register new asset
router.post('/', authenticateToken, requireRole('Admin', 'AssetManager'), (req, res) => {
  try {
    const { name, category_id, serial_number, acquisition_date, acquisition_cost, condition, location, is_bookable, department_id, notes, photo_url } = req.body;

    if (!name || !category_id) {
      return res.status(400).json({ error: 'Name and category are required' });
    }

    const db = getDb();
    const assetTag = generateAssetTag();

    const result = db.prepare(`
      INSERT INTO assets (name, category_id, asset_tag, serial_number, acquisition_date, acquisition_cost, condition, location, status, is_bookable, department_id, notes, photo_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Available', ?, ?, ?, ?)
    `).run(name, category_id, assetTag, serial_number || null, acquisition_date || null, acquisition_cost || 0, condition || 'New', location || null, is_bookable ? 1 : 0, department_id || null, notes || null, photo_url || null);

    db.prepare('INSERT INTO activity_logs (user_id, user_name, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)')
      .run(req.user.id, req.user.name, 'CREATE', 'asset', result.lastInsertRowid, JSON.stringify({ name, asset_tag: assetTag }));

    const asset = db.prepare('SELECT a.*, c.name as category_name FROM assets a LEFT JOIN asset_categories c ON a.category_id = c.id WHERE a.id = ?').get(result.lastInsertRowid);
    res.status(201).json({ asset });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/assets/:id — Update asset
router.put('/:id', authenticateToken, requireRole('Admin', 'AssetManager'), (req, res) => {
  try {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM assets WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Asset not found' });

    const { name, category_id, serial_number, acquisition_date, acquisition_cost, condition, location, status, is_bookable, department_id, notes, photo_url } = req.body;

    db.prepare(`
      UPDATE assets SET name = ?, category_id = ?, serial_number = ?, acquisition_date = ?, acquisition_cost = ?, condition = ?, location = ?, status = ?, is_bookable = ?, department_id = ?, notes = ?, photo_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(
      name || existing.name, category_id || existing.category_id, serial_number ?? existing.serial_number,
      acquisition_date || existing.acquisition_date, acquisition_cost ?? existing.acquisition_cost,
      condition || existing.condition, location ?? existing.location, status || existing.status,
      is_bookable !== undefined ? (is_bookable ? 1 : 0) : existing.is_bookable,
      department_id !== undefined ? department_id : existing.department_id,
      notes ?? existing.notes, photo_url ?? existing.photo_url, req.params.id
    );

    db.prepare('INSERT INTO activity_logs (user_id, user_name, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)')
      .run(req.user.id, req.user.name, 'UPDATE', 'asset', req.params.id, JSON.stringify({ name: name || existing.name, status: status || existing.status }));

    const asset = db.prepare('SELECT a.*, c.name as category_name FROM assets a LEFT JOIN asset_categories c ON a.category_id = c.id WHERE a.id = ?').get(req.params.id);
    res.json({ asset });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/assets/stats/summary — Dashboard stats
router.get('/stats/summary', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const stats = {
      available: db.prepare("SELECT COUNT(*) as count FROM assets WHERE status = 'Available'").get().count,
      allocated: db.prepare("SELECT COUNT(*) as count FROM assets WHERE status = 'Allocated'").get().count,
      under_maintenance: db.prepare("SELECT COUNT(*) as count FROM assets WHERE status = 'UnderMaintenance'").get().count,
      reserved: db.prepare("SELECT COUNT(*) as count FROM assets WHERE status = 'Reserved'").get().count,
      lost: db.prepare("SELECT COUNT(*) as count FROM assets WHERE status = 'Lost'").get().count,
      retired: db.prepare("SELECT COUNT(*) as count FROM assets WHERE status = 'Retired'").get().count,
      disposed: db.prepare("SELECT COUNT(*) as count FROM assets WHERE status = 'Disposed'").get().count,
      total: db.prepare('SELECT COUNT(*) as count FROM assets').get().count,
    };
    res.json({ stats });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
