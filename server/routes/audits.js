const express = require('express');
const { getDb } = require('../db/schema');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

const router = express.Router();

// GET /api/audits — List audit cycles
router.get('/', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const audits = db.prepare(`
      SELECT ac.*, u.name as created_by_name,
        (SELECT COUNT(*) FROM audit_items WHERE audit_cycle_id = ac.id) as total_items,
        (SELECT COUNT(*) FROM audit_items WHERE audit_cycle_id = ac.id AND status = 'Verified') as verified_count,
        (SELECT COUNT(*) FROM audit_items WHERE audit_cycle_id = ac.id AND status = 'Missing') as missing_count,
        (SELECT COUNT(*) FROM audit_items WHERE audit_cycle_id = ac.id AND status = 'Damaged') as damaged_count
      FROM audit_cycles ac
      JOIN users u ON ac.created_by = u.id
      ORDER BY ac.created_at DESC
    `).all();
    res.json({ audits });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/audits/:id — Audit cycle detail with items
router.get('/:id', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const audit = db.prepare(`
      SELECT ac.*, u.name as created_by_name
      FROM audit_cycles ac JOIN users u ON ac.created_by = u.id
      WHERE ac.id = ?
    `).get(req.params.id);
    if (!audit) return res.status(404).json({ error: 'Audit cycle not found' });

    const assignments = db.prepare(`
      SELECT aa.*, u.name as auditor_name, u.email as auditor_email
      FROM audit_assignments aa JOIN users u ON aa.auditor_id = u.id
      WHERE aa.audit_cycle_id = ?
    `).all(req.params.id);

    const items = db.prepare(`
      SELECT ai.*, a.name as asset_name, a.asset_tag, a.location, a.condition,
        c.name as category_name, u.name as auditor_name
      FROM audit_items ai
      JOIN assets a ON ai.asset_id = a.id
      LEFT JOIN asset_categories c ON a.category_id = c.id
      LEFT JOIN users u ON ai.auditor_id = u.id
      WHERE ai.audit_cycle_id = ?
      ORDER BY a.asset_tag
    `).all(req.params.id);

    res.json({ audit, assignments, items });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/audits — Create audit cycle
router.post('/', authenticateToken, requireRole('Admin', 'AssetManager'), (req, res) => {
  try {
    const { name, scope_type, scope_value, start_date, end_date, auditor_ids, notes } = req.body;
    if (!name || !scope_type || !start_date || !end_date) {
      return res.status(400).json({ error: 'Name, scope, start date, and end date are required' });
    }

    const db = getDb();
    const result = db.prepare(`
      INSERT INTO audit_cycles (name, scope_type, scope_value, start_date, end_date, status, created_by, notes)
      VALUES (?, ?, ?, ?, ?, 'Open', ?, ?)
    `).run(name, scope_type, scope_value || null, start_date, end_date, req.user.id, notes || null);

    const cycleId = result.lastInsertRowid;

    // Assign auditors
    if (auditor_ids && auditor_ids.length > 0) {
      const insertAssign = db.prepare('INSERT INTO audit_assignments (audit_cycle_id, auditor_id) VALUES (?, ?)');
      auditor_ids.forEach(auditorId => {
        insertAssign.run(cycleId, auditorId);
        db.prepare('INSERT INTO notifications (user_id, type, title, message, reference_type, reference_id) VALUES (?, ?, ?, ?, ?, ?)')
          .run(auditorId, 'AuditAssigned', 'Audit Assigned', `You have been assigned as auditor for "${name}".`, 'audit', cycleId);
      });
    }

    // Add assets to audit based on scope
    let assetQuery = 'SELECT id FROM assets WHERE status NOT IN (\'Disposed\', \'Retired\')';
    const assetParams = [];
    if (scope_type === 'Department' && scope_value) {
      assetQuery += ' AND department_id = ?';
      assetParams.push(scope_value);
    } else if (scope_type === 'Location' && scope_value) {
      assetQuery += ' AND location LIKE ?';
      assetParams.push(`%${scope_value}%`);
    }

    const assets = db.prepare(assetQuery).all(...assetParams);
    const insertItem = db.prepare('INSERT INTO audit_items (audit_cycle_id, asset_id, status) VALUES (?, ?, \'Pending\')');
    assets.forEach(a => insertItem.run(cycleId, a.id));

    db.prepare('INSERT INTO activity_logs (user_id, user_name, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)')
      .run(req.user.id, req.user.name, 'CREATE', 'audit', cycleId, JSON.stringify({ name, scope_type, asset_count: assets.length }));

    const audit = db.prepare('SELECT * FROM audit_cycles WHERE id = ?').get(cycleId);
    res.status(201).json({ audit, asset_count: assets.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/audits/:id/items/:itemId — Mark audit item
router.put('/:id/items/:itemId', authenticateToken, (req, res) => {
  try {
    const { status, notes } = req.body;
    if (!['Verified', 'Missing', 'Damaged'].includes(status)) {
      return res.status(400).json({ error: 'Status must be Verified, Missing, or Damaged' });
    }

    const db = getDb();
    const audit = db.prepare('SELECT * FROM audit_cycles WHERE id = ?').get(req.params.id);
    if (!audit) return res.status(404).json({ error: 'Audit cycle not found' });
    if (audit.status === 'Closed') return res.status(400).json({ error: 'Audit cycle is closed' });

    // Check if user is assigned auditor
    const isAuditor = db.prepare('SELECT id FROM audit_assignments WHERE audit_cycle_id = ? AND auditor_id = ?').get(req.params.id, req.user.id);
    const isManager = ['Admin', 'AssetManager'].includes(req.user.role);
    if (!isAuditor && !isManager) {
      return res.status(403).json({ error: 'You are not assigned to this audit' });
    }

    db.prepare(`
      UPDATE audit_items SET status = ?, notes = ?, auditor_id = ?, audited_at = CURRENT_TIMESTAMP WHERE id = ? AND audit_cycle_id = ?
    `).run(status, notes || null, req.user.id, req.params.itemId, req.params.id);

    // Update audit to InProgress if still Open
    if (audit.status === 'Open') {
      db.prepare("UPDATE audit_cycles SET status = 'InProgress', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(req.params.id);
    }

    db.prepare('INSERT INTO activity_logs (user_id, user_name, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)')
      .run(req.user.id, req.user.name, 'AUDIT_MARK', 'audit_item', req.params.itemId, JSON.stringify({ status }));

    res.json({ message: 'Item marked successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/audits/:id/close — Close audit cycle
router.post('/:id/close', authenticateToken, requireRole('Admin', 'AssetManager'), (req, res) => {
  try {
    const db = getDb();
    const audit = db.prepare('SELECT * FROM audit_cycles WHERE id = ?').get(req.params.id);
    if (!audit) return res.status(404).json({ error: 'Audit cycle not found' });
    if (audit.status === 'Closed') return res.status(400).json({ error: 'Already closed' });

    // Update discrepant assets
    const missingItems = db.prepare("SELECT asset_id FROM audit_items WHERE audit_cycle_id = ? AND status = 'Missing'").all(req.params.id);
    const damagedItems = db.prepare("SELECT asset_id FROM audit_items WHERE audit_cycle_id = ? AND status = 'Damaged'").all(req.params.id);

    missingItems.forEach(item => {
      db.prepare("UPDATE assets SET status = 'Lost', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(item.asset_id);
    });
    damagedItems.forEach(item => {
      db.prepare("UPDATE assets SET condition = 'Damaged', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(item.asset_id);
    });

    db.prepare("UPDATE audit_cycles SET status = 'Closed', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(req.params.id);

    // Notify admins of discrepancies
    if (missingItems.length > 0 || damagedItems.length > 0) {
      const admins = db.prepare("SELECT id FROM users WHERE role IN ('Admin', 'AssetManager') AND status = 'Active'").all();
      admins.forEach(admin => {
        db.prepare('INSERT INTO notifications (user_id, type, title, message, reference_type, reference_id) VALUES (?, ?, ?, ?, ?, ?)')
          .run(admin.id, 'AuditDiscrepancy', 'Audit Discrepancies Found', `Audit "${audit.name}" closed: ${missingItems.length} missing, ${damagedItems.length} damaged.`, 'audit', audit.id);
      });
    }

    db.prepare('INSERT INTO activity_logs (user_id, user_name, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)')
      .run(req.user.id, req.user.name, 'CLOSE_AUDIT', 'audit', req.params.id, JSON.stringify({ missing: missingItems.length, damaged: damagedItems.length }));

    res.json({ message: 'Audit cycle closed', missing_count: missingItems.length, damaged_count: damagedItems.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
