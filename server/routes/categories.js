const express = require('express');
const { getDb } = require('../db/schema');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

const router = express.Router();

// GET /api/categories
router.get('/', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const categories = db.prepare(`
      SELECT c.*, 
        (SELECT COUNT(*) FROM assets WHERE category_id = c.id) as asset_count
      FROM asset_categories c ORDER BY c.name
    `).all();
    categories.forEach(c => { c.custom_fields = JSON.parse(c.custom_fields || '[]'); });
    res.json({ categories });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/categories
router.post('/', authenticateToken, requireRole('Admin'), (req, res) => {
  try {
    const { name, description, custom_fields } = req.body;
    if (!name) return res.status(400).json({ error: 'Category name is required' });

    const db = getDb();
    const existing = db.prepare('SELECT id FROM asset_categories WHERE name = ?').get(name);
    if (existing) return res.status(409).json({ error: 'Category already exists' });

    const result = db.prepare('INSERT INTO asset_categories (name, description, custom_fields) VALUES (?, ?, ?)')
      .run(name, description || null, JSON.stringify(custom_fields || []));

    db.prepare('INSERT INTO activity_logs (user_id, user_name, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)')
      .run(req.user.id, req.user.name, 'CREATE', 'category', result.lastInsertRowid, JSON.stringify({ name }));

    const cat = db.prepare('SELECT * FROM asset_categories WHERE id = ?').get(result.lastInsertRowid);
    cat.custom_fields = JSON.parse(cat.custom_fields || '[]');
    res.status(201).json({ category: cat });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/categories/:id
router.put('/:id', authenticateToken, requireRole('Admin'), (req, res) => {
  try {
    const { name, description, custom_fields, status } = req.body;
    const db = getDb();
    const existing = db.prepare('SELECT * FROM asset_categories WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Category not found' });

    db.prepare('UPDATE asset_categories SET name = ?, description = ?, custom_fields = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(name || existing.name, description ?? existing.description, JSON.stringify(custom_fields || JSON.parse(existing.custom_fields)), status || existing.status, req.params.id);

    db.prepare('INSERT INTO activity_logs (user_id, user_name, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)')
      .run(req.user.id, req.user.name, 'UPDATE', 'category', req.params.id, JSON.stringify({ name: name || existing.name }));

    const cat = db.prepare('SELECT * FROM asset_categories WHERE id = ?').get(req.params.id);
    cat.custom_fields = JSON.parse(cat.custom_fields || '[]');
    res.json({ category: cat });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
