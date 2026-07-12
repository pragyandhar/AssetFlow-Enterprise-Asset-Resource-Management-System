const express = require('express');
const { getDb } = require('../db/schema');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

const router = express.Router();

// GET /api/departments — List all departments
router.get('/', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const departments = db.prepare(`
      SELECT d.*, 
        u.name as head_name, u.email as head_email,
        pd.name as parent_name,
        (SELECT COUNT(*) FROM users WHERE department_id = d.id AND status = 'Active') as employee_count
      FROM departments d
      LEFT JOIN users u ON d.head_id = u.id
      LEFT JOIN departments pd ON d.parent_id = pd.id
      ORDER BY d.name
    `).all();
    res.json({ departments });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/departments/:id
router.get('/:id', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const dept = db.prepare(`
      SELECT d.*, u.name as head_name, pd.name as parent_name
      FROM departments d
      LEFT JOIN users u ON d.head_id = u.id
      LEFT JOIN departments pd ON d.parent_id = pd.id
      WHERE d.id = ?
    `).get(req.params.id);
    if (!dept) return res.status(404).json({ error: 'Department not found' });
    res.json({ department: dept });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/departments — Create
router.post('/', authenticateToken, requireRole('Admin'), (req, res) => {
  try {
    const { name, description, parent_id, head_id } = req.body;
    if (!name) return res.status(400).json({ error: 'Department name is required' });

    const db = getDb();
    const existing = db.prepare('SELECT id FROM departments WHERE name = ?').get(name);
    if (existing) return res.status(409).json({ error: 'Department name already exists' });

    const result = db.prepare('INSERT INTO departments (name, description, parent_id, head_id) VALUES (?, ?, ?, ?)')
      .run(name, description || null, parent_id || null, head_id || null);

    // If head_id is set, update user's role to DepartmentHead
    if (head_id) {
      db.prepare("UPDATE users SET role = 'DepartmentHead', department_id = ? WHERE id = ? AND role = 'Employee'")
        .run(result.lastInsertRowid, head_id);
    }

    db.prepare('INSERT INTO activity_logs (user_id, user_name, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)')
      .run(req.user.id, req.user.name, 'CREATE', 'department', result.lastInsertRowid, JSON.stringify({ name }));

    const dept = db.prepare('SELECT * FROM departments WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ department: dept });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/departments/:id — Update
router.put('/:id', authenticateToken, requireRole('Admin'), (req, res) => {
  try {
    const { name, description, parent_id, head_id, status } = req.body;
    const db = getDb();

    const existing = db.prepare('SELECT * FROM departments WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Department not found' });

    db.prepare(`UPDATE departments SET name = ?, description = ?, parent_id = ?, head_id = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
      .run(name || existing.name, description ?? existing.description, parent_id ?? existing.parent_id, head_id ?? existing.head_id, status || existing.status, req.params.id);

    db.prepare('INSERT INTO activity_logs (user_id, user_name, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)')
      .run(req.user.id, req.user.name, 'UPDATE', 'department', req.params.id, JSON.stringify({ name: name || existing.name }));

    const dept = db.prepare('SELECT * FROM departments WHERE id = ?').get(req.params.id);
    res.json({ department: dept });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
