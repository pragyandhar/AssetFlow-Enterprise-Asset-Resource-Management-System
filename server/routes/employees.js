const express = require('express');
const { getDb } = require('../db/schema');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

const router = express.Router();

// GET /api/employees — List all employees
router.get('/', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const { department_id, role, status, search } = req.query;
    let query = `
      SELECT u.id, u.name, u.email, u.role, u.department_id, u.phone, u.status, u.created_at,
        d.name as department_name
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE 1=1
    `;
    const params = [];

    if (department_id) { query += ' AND u.department_id = ?'; params.push(department_id); }
    if (role) { query += ' AND u.role = ?'; params.push(role); }
    if (status) { query += ' AND u.status = ?'; params.push(status); }
    if (search) { query += ' AND (u.name LIKE ? OR u.email LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }

    query += ' ORDER BY u.name';
    const employees = db.prepare(query).all(...params);
    res.json({ employees });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/employees/:id
router.get('/:id', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const emp = db.prepare(`
      SELECT u.id, u.name, u.email, u.role, u.department_id, u.phone, u.status, u.created_at,
        d.name as department_name
      FROM users u LEFT JOIN departments d ON u.department_id = d.id WHERE u.id = ?
    `).get(req.params.id);
    if (!emp) return res.status(404).json({ error: 'Employee not found' });
    res.json({ employee: emp });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/employees/:id — Update employee (including role promotion)
router.put('/:id', authenticateToken, requireRole('Admin'), (req, res) => {
  try {
    const { name, email, role, department_id, phone, status } = req.body;
    const db = getDb();

    const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Employee not found' });

    // Prevent self-demotion of last admin
    if (existing.role === 'Admin' && role !== 'Admin') {
      const adminCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'Admin' AND status = 'Active'").get();
      if (adminCount.count <= 1) {
        return res.status(400).json({ error: 'Cannot remove the last admin' });
      }
    }

    db.prepare(`UPDATE users SET name = ?, email = ?, role = ?, department_id = ?, phone = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
      .run(
        name || existing.name,
        email || existing.email,
        role || existing.role,
        department_id !== undefined ? department_id : existing.department_id,
        phone ?? existing.phone,
        status || existing.status,
        req.params.id
      );

    // If promoted to DepartmentHead, check if should be dept head
    if (role === 'DepartmentHead' && department_id) {
      db.prepare('UPDATE departments SET head_id = ? WHERE id = ? AND (head_id IS NULL OR head_id = ?)').run(req.params.id, department_id, req.params.id);
    }

    // Create notification for role change
    if (role && role !== existing.role) {
      db.prepare('INSERT INTO notifications (user_id, type, title, message, reference_type, reference_id) VALUES (?, ?, ?, ?, ?, ?)')
        .run(req.params.id, 'RoleChanged', 'Role Updated', `Your role has been updated to ${role}.`, 'user', req.params.id);

      db.prepare('INSERT INTO activity_logs (user_id, user_name, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)')
        .run(req.user.id, req.user.name, 'PROMOTE', 'user', req.params.id, JSON.stringify({ from: existing.role, to: role, user: existing.name }));
    }

    const emp = db.prepare(`
      SELECT u.id, u.name, u.email, u.role, u.department_id, u.phone, u.status, u.created_at,
        d.name as department_name
      FROM users u LEFT JOIN departments d ON u.department_id = d.id WHERE u.id = ?
    `).get(req.params.id);
    res.json({ employee: emp });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
