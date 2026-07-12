const express = require('express');
const { getDb } = require('../db/schema');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/reports/asset-utilization
router.get('/asset-utilization', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const byStatus = db.prepare(`
      SELECT status, COUNT(*) as count FROM assets GROUP BY status
    `).all();
    const byCategory = db.prepare(`
      SELECT c.name as category, COUNT(a.id) as total,
        SUM(CASE WHEN a.status = 'Available' THEN 1 ELSE 0 END) as available,
        SUM(CASE WHEN a.status = 'Allocated' THEN 1 ELSE 0 END) as allocated
      FROM assets a LEFT JOIN asset_categories c ON a.category_id = c.id
      GROUP BY c.name
    `).all();
    const mostAllocated = db.prepare(`
      SELECT a.name, a.asset_tag, COUNT(al.id) as allocation_count
      FROM assets a LEFT JOIN allocations al ON a.id = al.asset_id
      GROUP BY a.id ORDER BY allocation_count DESC LIMIT 10
    `).all();
    res.json({ byStatus, byCategory, mostAllocated });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/reports/maintenance-frequency
router.get('/maintenance-frequency', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const byAsset = db.prepare(`
      SELECT a.name, a.asset_tag, COUNT(m.id) as count, c.name as category
      FROM maintenance_requests m
      JOIN assets a ON m.asset_id = a.id
      LEFT JOIN asset_categories c ON a.category_id = c.id
      GROUP BY a.id ORDER BY count DESC LIMIT 10
    `).all();
    const byCategory = db.prepare(`
      SELECT c.name as category, COUNT(m.id) as count
      FROM maintenance_requests m
      JOIN assets a ON m.asset_id = a.id
      LEFT JOIN asset_categories c ON a.category_id = c.id
      GROUP BY c.name ORDER BY count DESC
    `).all();
    const byPriority = db.prepare(`
      SELECT priority, COUNT(*) as count FROM maintenance_requests GROUP BY priority
    `).all();
    const byStatus = db.prepare(`
      SELECT status, COUNT(*) as count FROM maintenance_requests GROUP BY status
    `).all();
    res.json({ byAsset, byCategory, byPriority, byStatus });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/reports/department-allocation
router.get('/department-allocation', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const data = db.prepare(`
      SELECT d.name as department, 
        COUNT(DISTINCT a.id) as asset_count,
        COUNT(DISTINCT al.id) as allocation_count,
        COUNT(DISTINCT u.id) as employee_count
      FROM departments d
      LEFT JOIN assets a ON a.department_id = d.id
      LEFT JOIN allocations al ON al.department_id = d.id AND al.status = 'Active'
      LEFT JOIN users u ON u.department_id = d.id AND u.status = 'Active'
      GROUP BY d.id ORDER BY asset_count DESC
    `).all();
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/reports/booking-heatmap
router.get('/booking-heatmap', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const bookings = db.prepare(`
      SELECT 
        strftime('%H', start_time) as hour,
        strftime('%w', start_time) as day_of_week,
        COUNT(*) as count
      FROM bookings WHERE status != 'Cancelled'
      GROUP BY hour, day_of_week
      ORDER BY day_of_week, hour
    `).all();
    const byResource = db.prepare(`
      SELECT a.name, a.asset_tag, COUNT(b.id) as booking_count
      FROM bookings b JOIN assets a ON b.asset_id = a.id
      WHERE b.status != 'Cancelled'
      GROUP BY a.id ORDER BY booking_count DESC LIMIT 10
    `).all();
    res.json({ bookings, byResource });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/reports/dashboard-kpis
router.get('/dashboard-kpis', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toISOString();

    const kpis = {
      assets_available: db.prepare("SELECT COUNT(*) as c FROM assets WHERE status = 'Available'").get().c,
      assets_allocated: db.prepare("SELECT COUNT(*) as c FROM assets WHERE status = 'Allocated'").get().c,
      maintenance_today: db.prepare("SELECT COUNT(*) as c FROM maintenance_requests WHERE DATE(created_at) = ? AND status NOT IN ('Resolved','Rejected')").get(today).c,
      active_bookings: db.prepare("SELECT COUNT(*) as c FROM bookings WHERE status IN ('Upcoming','Ongoing')").get().c,
      pending_transfers: db.prepare("SELECT COUNT(*) as c FROM transfer_requests WHERE status = 'Requested'").get().c,
      upcoming_returns: db.prepare("SELECT COUNT(*) as c FROM allocations WHERE status = 'Active' AND expected_return_date IS NOT NULL AND expected_return_date >= ?").get(today).c,
      overdue_returns: db.prepare("SELECT COUNT(*) as c FROM allocations WHERE status = 'Active' AND expected_return_date IS NOT NULL AND expected_return_date < ?").get(today).c,
      pending_maintenance: db.prepare("SELECT COUNT(*) as c FROM maintenance_requests WHERE status = 'Pending'").get().c,
    };

    const overdueAllocations = db.prepare(`
      SELECT al.*, a.name as asset_name, a.asset_tag, u.name as holder_name
      FROM allocations al JOIN assets a ON al.asset_id = a.id JOIN users u ON al.allocated_to = u.id
      WHERE al.status = 'Active' AND al.expected_return_date < ? AND al.expected_return_date IS NOT NULL
      ORDER BY al.expected_return_date ASC LIMIT 10
    `).all(today);

    const recentActivity = db.prepare(`
      SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT 10
    `).all();

    res.json({ kpis, overdueAllocations, recentActivity });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
