const express = require('express');
const { getDb } = require('../db/schema');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

const router = express.Router();

// GET /api/allocations — List allocations
router.get('/', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const { status, department_id, user_id } = req.query;
    let query = `
      SELECT al.*, 
        a.name as asset_name, a.asset_tag, a.status as asset_status,
        u.name as allocated_to_name, u.email as allocated_to_email,
        ab.name as allocated_by_name,
        d.name as department_name
      FROM allocations al
      JOIN assets a ON al.asset_id = a.id
      JOIN users u ON al.allocated_to = u.id
      JOIN users ab ON al.allocated_by = ab.id
      LEFT JOIN departments d ON al.department_id = d.id
      WHERE 1=1
    `;
    const params = [];

    if (status) { query += ' AND al.status = ?'; params.push(status); }
    if (department_id) { query += ' AND al.department_id = ?'; params.push(department_id); }
    if (user_id) { query += ' AND al.allocated_to = ?'; params.push(user_id); }

    // Non-admin/manager users only see their own
    if (req.user.role === 'Employee') {
      query += ' AND al.allocated_to = ?';
      params.push(req.user.id);
    }

    query += ' ORDER BY al.created_at DESC';
    const allocations = db.prepare(query).all(...params);

    // Auto-flag overdue
    const now = new Date().toISOString().split('T')[0];
    allocations.forEach(al => {
      if (al.status === 'Active' && al.expected_return_date && al.expected_return_date < now) {
        al.is_overdue = true;
      }
    });

    res.json({ allocations });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/allocations — Allocate asset
router.post('/', authenticateToken, requireRole('Admin', 'AssetManager', 'DepartmentHead'), (req, res) => {
  try {
    const { asset_id, allocated_to, department_id, expected_return_date } = req.body;
    if (!asset_id || !allocated_to) {
      return res.status(400).json({ error: 'Asset and employee are required' });
    }

    const db = getDb();

    // Check asset exists and is available
    const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(asset_id);
    if (!asset) return res.status(404).json({ error: 'Asset not found' });

    if (asset.status !== 'Available') {
      // Find current holder
      const currentAllocation = db.prepare(`
        SELECT al.*, u.name as holder_name 
        FROM allocations al JOIN users u ON al.allocated_to = u.id 
        WHERE al.asset_id = ? AND al.status = 'Active' LIMIT 1
      `).get(asset_id);

      const holderInfo = currentAllocation
        ? `Currently held by ${currentAllocation.holder_name}.`
        : `Asset status is ${asset.status}.`;

      return res.status(409).json({
        error: `Asset is not available for allocation. ${holderInfo}`,
        current_holder: currentAllocation?.holder_name,
        can_transfer: !!currentAllocation
      });
    }

    // Check user exists
    const user = db.prepare('SELECT * FROM users WHERE id = ? AND status = ?').get(allocated_to, 'Active');
    if (!user) return res.status(404).json({ error: 'Employee not found or inactive' });

    // Create allocation
    const result = db.prepare(`
      INSERT INTO allocations (asset_id, allocated_to, allocated_by, department_id, expected_return_date, status)
      VALUES (?, ?, ?, ?, ?, 'Active')
    `).run(asset_id, allocated_to, req.user.id, department_id || user.department_id, expected_return_date || null);

    // Update asset status
    db.prepare("UPDATE assets SET status = 'Allocated', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(asset_id);

    // Notification
    db.prepare('INSERT INTO notifications (user_id, type, title, message, reference_type, reference_id) VALUES (?, ?, ?, ?, ?, ?)')
      .run(allocated_to, 'AssetAssigned', 'Asset Assigned', `${asset.name} (${asset.asset_tag}) has been allocated to you.`, 'allocation', result.lastInsertRowid);

    // Log
    db.prepare('INSERT INTO activity_logs (user_id, user_name, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)')
      .run(req.user.id, req.user.name, 'ALLOCATE', 'asset', asset_id, JSON.stringify({ asset_tag: asset.asset_tag, allocated_to: user.name }));

    const allocation = db.prepare(`
      SELECT al.*, a.name as asset_name, a.asset_tag, u.name as allocated_to_name
      FROM allocations al JOIN assets a ON al.asset_id = a.id JOIN users u ON al.allocated_to = u.id
      WHERE al.id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json({ allocation });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/allocations/:id/return — Return asset
router.post('/:id/return', authenticateToken, (req, res) => {
  try {
    const { return_condition, return_notes } = req.body;
    const db = getDb();

    const allocation = db.prepare('SELECT al.*, a.name as asset_name, a.asset_tag FROM allocations al JOIN assets a ON al.asset_id = a.id WHERE al.id = ?').get(req.params.id);
    if (!allocation) return res.status(404).json({ error: 'Allocation not found' });
    if (allocation.status !== 'Active' && allocation.status !== 'Overdue') {
      return res.status(400).json({ error: 'Allocation is not active' });
    }

    // Only the holder, admin, or asset manager can return
    if (req.user.role === 'Employee' && allocation.allocated_to !== req.user.id) {
      return res.status(403).json({ error: 'You can only return assets allocated to you' });
    }

    db.prepare(`
      UPDATE allocations SET status = 'Returned', actual_return_date = CURRENT_TIMESTAMP, return_condition = ?, return_notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(return_condition || 'Good', return_notes || null, req.params.id);

    // Update asset status based on condition
    const newStatus = (return_condition === 'Damaged') ? 'UnderMaintenance' : 'Available';
    const newCondition = return_condition || 'Good';
    db.prepare('UPDATE assets SET status = ?, condition = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newStatus, newCondition, allocation.asset_id);

    // Notification
    db.prepare('INSERT INTO notifications (user_id, type, title, message, reference_type, reference_id) VALUES (?, ?, ?, ?, ?, ?)')
      .run(allocation.allocated_to, 'AssetReturned', 'Asset Returned', `${allocation.asset_name} (${allocation.asset_tag}) has been returned.`, 'allocation', req.params.id);

    // Log
    db.prepare('INSERT INTO activity_logs (user_id, user_name, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)')
      .run(req.user.id, req.user.name, 'RETURN', 'asset', allocation.asset_id, JSON.stringify({ asset_tag: allocation.asset_tag, condition: return_condition }));

    res.json({ message: 'Asset returned successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/allocations/transfer — Request transfer
router.post('/transfer', authenticateToken, (req, res) => {
  try {
    const { asset_id, to_user_id, notes } = req.body;
    if (!asset_id || !to_user_id) {
      return res.status(400).json({ error: 'Asset and target employee are required' });
    }

    const db = getDb();

    // Find active allocation
    const allocation = db.prepare(`
      SELECT al.*, a.name as asset_name, a.asset_tag
      FROM allocations al JOIN assets a ON al.asset_id = a.id
      WHERE al.asset_id = ? AND al.status = 'Active' LIMIT 1
    `).get(asset_id);

    if (!allocation) {
      return res.status(404).json({ error: 'No active allocation found for this asset' });
    }

    const toUser = db.prepare('SELECT * FROM users WHERE id = ? AND status = ?').get(to_user_id, 'Active');
    if (!toUser) return res.status(404).json({ error: 'Target employee not found' });

    const result = db.prepare(`
      INSERT INTO transfer_requests (allocation_id, asset_id, from_user_id, to_user_id, requested_by, notes, status)
      VALUES (?, ?, ?, ?, ?, ?, 'Requested')
    `).run(allocation.id, asset_id, allocation.allocated_to, to_user_id, req.user.id, notes || null);

    // Update allocation status
    db.prepare("UPDATE allocations SET status = 'TransferRequested', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(allocation.id);

    // Notification to asset managers
    const managers = db.prepare("SELECT id FROM users WHERE role IN ('Admin', 'AssetManager') AND status = 'Active'").all();
    managers.forEach(mgr => {
      db.prepare('INSERT INTO notifications (user_id, type, title, message, reference_type, reference_id) VALUES (?, ?, ?, ?, ?, ?)')
        .run(mgr.id, 'TransferRequested', 'Transfer Request', `Transfer request for ${allocation.asset_name} (${allocation.asset_tag}).`, 'transfer', result.lastInsertRowid);
    });

    db.prepare('INSERT INTO activity_logs (user_id, user_name, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)')
      .run(req.user.id, req.user.name, 'TRANSFER_REQUEST', 'asset', asset_id, JSON.stringify({ asset_tag: allocation.asset_tag, to: toUser.name }));

    res.status(201).json({ message: 'Transfer request created', transfer_id: result.lastInsertRowid });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/allocations/transfers — List transfer requests
router.get('/transfers/list', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const transfers = db.prepare(`
      SELECT tr.*, 
        a.name as asset_name, a.asset_tag,
        fu.name as from_user_name, tu.name as to_user_name,
        rb.name as requested_by_name, ab.name as approved_by_name
      FROM transfer_requests tr
      JOIN assets a ON tr.asset_id = a.id
      JOIN users fu ON tr.from_user_id = fu.id
      JOIN users tu ON tr.to_user_id = tu.id
      JOIN users rb ON tr.requested_by = rb.id
      LEFT JOIN users ab ON tr.approved_by = ab.id
      ORDER BY tr.created_at DESC
    `).all();
    res.json({ transfers });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/allocations/transfers/:id — Approve/reject transfer
router.put('/transfers/:id', authenticateToken, requireRole('Admin', 'AssetManager', 'DepartmentHead'), (req, res) => {
  try {
    const { status } = req.body;
    if (!['Approved', 'Rejected'].includes(status)) {
      return res.status(400).json({ error: 'Status must be Approved or Rejected' });
    }

    const db = getDb();
    const transfer = db.prepare(`
      SELECT tr.*, a.name as asset_name, a.asset_tag
      FROM transfer_requests tr JOIN assets a ON tr.asset_id = a.id
      WHERE tr.id = ?
    `).get(req.params.id);

    if (!transfer) return res.status(404).json({ error: 'Transfer request not found' });
    if (transfer.status !== 'Requested') return res.status(400).json({ error: 'Transfer already processed' });

    db.prepare('UPDATE transfer_requests SET status = ?, approved_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(status, req.user.id, req.params.id);

    if (status === 'Approved') {
      // Close old allocation
      db.prepare("UPDATE allocations SET status = 'Returned', actual_return_date = CURRENT_TIMESTAMP, return_notes = 'Transferred', updated_at = CURRENT_TIMESTAMP WHERE id = ?")
        .run(transfer.allocation_id);

      // Create new allocation
      const toUser = db.prepare('SELECT * FROM users WHERE id = ?').get(transfer.to_user_id);
      db.prepare(`
        INSERT INTO allocations (asset_id, allocated_to, allocated_by, department_id, status)
        VALUES (?, ?, ?, ?, 'Active')
      `).run(transfer.asset_id, transfer.to_user_id, req.user.id, toUser.department_id);

      db.prepare('UPDATE transfer_requests SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run('Completed', req.params.id);

      // Notify
      db.prepare('INSERT INTO notifications (user_id, type, title, message, reference_type, reference_id) VALUES (?, ?, ?, ?, ?, ?)')
        .run(transfer.to_user_id, 'TransferApproved', 'Transfer Approved', `${transfer.asset_name} (${transfer.asset_tag}) has been transferred to you.`, 'transfer', req.params.id);
      db.prepare('INSERT INTO notifications (user_id, type, title, message, reference_type, reference_id) VALUES (?, ?, ?, ?, ?, ?)')
        .run(transfer.from_user_id, 'TransferApproved', 'Transfer Approved', `${transfer.asset_name} (${transfer.asset_tag}) has been transferred.`, 'transfer', req.params.id);
    } else {
      // Rejected — revert allocation status
      db.prepare("UPDATE allocations SET status = 'Active', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(transfer.allocation_id);

      db.prepare('INSERT INTO notifications (user_id, type, title, message, reference_type, reference_id) VALUES (?, ?, ?, ?, ?, ?)')
        .run(transfer.requested_by, 'TransferRejected', 'Transfer Rejected', `Transfer for ${transfer.asset_name} was rejected.`, 'transfer', req.params.id);
    }

    db.prepare('INSERT INTO activity_logs (user_id, user_name, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)')
      .run(req.user.id, req.user.name, status === 'Approved' ? 'TRANSFER_APPROVE' : 'TRANSFER_REJECT', 'transfer', req.params.id, JSON.stringify({ asset_tag: transfer.asset_tag }));

    res.json({ message: `Transfer ${status.toLowerCase()}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
