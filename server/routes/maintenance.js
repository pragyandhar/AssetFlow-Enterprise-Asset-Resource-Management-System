const express = require('express');
const { getDb } = require('../db/schema');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

const router = express.Router();

// GET /api/maintenance — List maintenance requests
router.get('/', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const { status, priority, asset_id } = req.query;
    let query = `
      SELECT m.*, 
        a.name as asset_name, a.asset_tag, a.location as asset_location,
        u.name as requested_by_name,
        ab.name as approved_by_name,
        t.name as technician_name
      FROM maintenance_requests m
      JOIN assets a ON m.asset_id = a.id
      JOIN users u ON m.requested_by = u.id
      LEFT JOIN users ab ON m.approved_by = ab.id
      LEFT JOIN users t ON m.technician_id = t.id
      WHERE 1=1
    `;
    const params = [];

    if (status) { query += ' AND m.status = ?'; params.push(status); }
    if (priority) { query += ' AND m.priority = ?'; params.push(priority); }
    if (asset_id) { query += ' AND m.asset_id = ?'; params.push(asset_id); }

    if (req.user.role === 'Employee') {
      query += ' AND m.requested_by = ?';
      params.push(req.user.id);
    }

    query += ' ORDER BY m.created_at DESC';
    const requests = db.prepare(query).all(...params);
    res.json({ requests });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/maintenance — Raise request
router.post('/', authenticateToken, (req, res) => {
  try {
    const { asset_id, description, priority } = req.body;
    if (!asset_id || !description) {
      return res.status(400).json({ error: 'Asset and description are required' });
    }

    const db = getDb();
    const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(asset_id);
    if (!asset) return res.status(404).json({ error: 'Asset not found' });

    const result = db.prepare(`
      INSERT INTO maintenance_requests (asset_id, requested_by, description, priority, status)
      VALUES (?, ?, ?, ?, 'Pending')
    `).run(asset_id, req.user.id, description, priority || 'Medium');

    // Notify asset managers
    const managers = db.prepare("SELECT id FROM users WHERE role IN ('Admin', 'AssetManager') AND status = 'Active'").all();
    managers.forEach(mgr => {
      db.prepare('INSERT INTO notifications (user_id, type, title, message, reference_type, reference_id) VALUES (?, ?, ?, ?, ?, ?)')
        .run(mgr.id, 'MaintenanceRequested', 'Maintenance Request', `${req.user.name} raised a ${priority || 'Medium'} priority maintenance request for ${asset.name} (${asset.asset_tag}).`, 'maintenance', result.lastInsertRowid);
    });

    db.prepare('INSERT INTO activity_logs (user_id, user_name, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)')
      .run(req.user.id, req.user.name, 'MAINTENANCE_REQUEST', 'maintenance', result.lastInsertRowid, JSON.stringify({ asset: asset.name, priority: priority || 'Medium' }));

    const request = db.prepare(`
      SELECT m.*, a.name as asset_name, a.asset_tag, u.name as requested_by_name
      FROM maintenance_requests m JOIN assets a ON m.asset_id = a.id JOIN users u ON m.requested_by = u.id
      WHERE m.id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json({ request });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/maintenance/:id — Update status (approve/reject/assign/resolve)
router.put('/:id', authenticateToken, (req, res) => {
  try {
    const { status, technician_id, technician_notes, resolution_notes } = req.body;
    const db = getDb();

    const request = db.prepare(`
      SELECT m.*, a.name as asset_name, a.asset_tag
      FROM maintenance_requests m JOIN assets a ON m.asset_id = a.id
      WHERE m.id = ?
    `).get(req.params.id);

    if (!request) return res.status(404).json({ error: 'Maintenance request not found' });

    // Validate status transitions
    const validTransitions = {
      'Pending': ['Approved', 'Rejected'],
      'Approved': ['TechAssigned', 'InProgress'],
      'TechAssigned': ['InProgress'],
      'InProgress': ['Resolved'],
    };

    if (status && validTransitions[request.status] && !validTransitions[request.status].includes(status)) {
      return res.status(400).json({ error: `Cannot transition from ${request.status} to ${status}` });
    }

    // Only managers can approve/reject
    if (['Approved', 'Rejected'].includes(status) && !['Admin', 'AssetManager'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Only Asset Managers can approve/reject' });
    }

    const updates = {};
    if (status) updates.status = status;
    if (status === 'Approved' || status === 'Rejected') updates.approved_by = req.user.id;
    if (technician_id) updates.technician_id = technician_id;
    if (technician_notes) updates.technician_notes = technician_notes;
    if (resolution_notes) updates.resolution_notes = resolution_notes;
    if (status === 'Resolved') updates.resolved_at = new Date().toISOString();

    const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    db.prepare(`UPDATE maintenance_requests SET ${setClauses}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
      .run(...Object.values(updates), req.params.id);

    // Asset status updates
    if (status === 'Approved') {
      db.prepare("UPDATE assets SET status = 'UnderMaintenance', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(request.asset_id);
    } else if (status === 'Resolved') {
      db.prepare("UPDATE assets SET status = 'Available', condition = 'Good', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(request.asset_id);
    }

    // Notifications
    if (status === 'Approved') {
      db.prepare('INSERT INTO notifications (user_id, type, title, message, reference_type, reference_id) VALUES (?, ?, ?, ?, ?, ?)')
        .run(request.requested_by, 'MaintenanceApproved', 'Maintenance Approved', `Your maintenance request for ${request.asset_name} has been approved.`, 'maintenance', req.params.id);
    } else if (status === 'Rejected') {
      db.prepare('INSERT INTO notifications (user_id, type, title, message, reference_type, reference_id) VALUES (?, ?, ?, ?, ?, ?)')
        .run(request.requested_by, 'MaintenanceRejected', 'Maintenance Rejected', `Your maintenance request for ${request.asset_name} has been rejected.`, 'maintenance', req.params.id);
    } else if (status === 'Resolved') {
      db.prepare('INSERT INTO notifications (user_id, type, title, message, reference_type, reference_id) VALUES (?, ?, ?, ?, ?, ?)')
        .run(request.requested_by, 'MaintenanceResolved', 'Maintenance Resolved', `${request.asset_name} has been repaired and is available.`, 'maintenance', req.params.id);
    }

    db.prepare('INSERT INTO activity_logs (user_id, user_name, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)')
      .run(req.user.id, req.user.name, `MAINTENANCE_${status.toUpperCase()}`, 'maintenance', req.params.id, JSON.stringify({ asset: request.asset_name }));

    const updated = db.prepare(`
      SELECT m.*, a.name as asset_name, a.asset_tag, u.name as requested_by_name, ab.name as approved_by_name, t.name as technician_name
      FROM maintenance_requests m
      JOIN assets a ON m.asset_id = a.id JOIN users u ON m.requested_by = u.id
      LEFT JOIN users ab ON m.approved_by = ab.id LEFT JOIN users t ON m.technician_id = t.id
      WHERE m.id = ?
    `).get(req.params.id);

    res.json({ request: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
