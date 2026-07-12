const bcrypt = require('bcryptjs');
const { getDb, generateAssetTag } = require('./schema');

function seedDatabase() {
  const db = getDb();

  // Check if admin already exists
  const existingAdmin = db.prepare('SELECT id FROM users WHERE email = ?').get('admin@assetflow.com');
  if (existingAdmin) {
    console.log('ℹ️  Database already seeded');
    return;
  }

  const passwordHash = bcrypt.hashSync('admin123', 10);
  const empHash = bcrypt.hashSync('password123', 10);

  // ── Create Departments ──
  const insertDept = db.prepare('INSERT INTO departments (name, description, status) VALUES (?, ?, ?)');
  const itDept = insertDept.run('Information Technology', 'IT department managing tech infrastructure', 'Active');
  const hrDept = insertDept.run('Human Resources', 'HR department managing people operations', 'Active');
  const opsDept = insertDept.run('Operations', 'Operations and logistics department', 'Active');
  const finDept = insertDept.run('Finance', 'Finance and accounting department', 'Active');
  const mktDept = insertDept.run('Marketing', 'Marketing and communications department', 'Active');

  // ── Create Admin User ──
  const insertUser = db.prepare('INSERT INTO users (name, email, password_hash, role, department_id, phone, status) VALUES (?, ?, ?, ?, ?, ?, ?)');
  const admin = insertUser.run('System Admin', 'admin@assetflow.com', passwordHash, 'Admin', itDept.lastInsertRowid, '+1-555-0100', 'Active');

  // ── Create Sample Employees ──
  const assetMgr = insertUser.run('Sarah Chen', 'sarah@assetflow.com', empHash, 'AssetManager', itDept.lastInsertRowid, '+1-555-0101', 'Active');
  const deptHead = insertUser.run('Michael Torres', 'michael@assetflow.com', empHash, 'DepartmentHead', opsDept.lastInsertRowid, '+1-555-0102', 'Active');
  const emp1 = insertUser.run('Priya Sharma', 'priya@assetflow.com', empHash, 'Employee', itDept.lastInsertRowid, '+1-555-0103', 'Active');
  const emp2 = insertUser.run('Raj Patel', 'raj@assetflow.com', empHash, 'Employee', opsDept.lastInsertRowid, '+1-555-0104', 'Active');
  const emp3 = insertUser.run('Emily Johnson', 'emily@assetflow.com', empHash, 'Employee', hrDept.lastInsertRowid, '+1-555-0105', 'Active');
  const emp4 = insertUser.run('David Kim', 'david@assetflow.com', empHash, 'Employee', finDept.lastInsertRowid, '+1-555-0106', 'Active');
  const emp5 = insertUser.run('Lisa Wang', 'lisa@assetflow.com', empHash, 'Employee', mktDept.lastInsertRowid, '+1-555-0107', 'Active');

  // ── Set Department Heads ──
  db.prepare('UPDATE departments SET head_id = ? WHERE id = ?').run(admin.lastInsertRowid, itDept.lastInsertRowid);
  db.prepare('UPDATE departments SET head_id = ? WHERE id = ?').run(deptHead.lastInsertRowid, opsDept.lastInsertRowid);
  db.prepare('UPDATE departments SET head_id = ? WHERE id = ?').run(emp3.lastInsertRowid, hrDept.lastInsertRowid);

  // ── Create Asset Categories ──
  const insertCat = db.prepare('INSERT INTO asset_categories (name, description, custom_fields, status) VALUES (?, ?, ?, ?)');
  const electronicsId = insertCat.run('Electronics', 'Laptops, monitors, phones, and other electronic devices',
    JSON.stringify([{ name: 'warranty_period', label: 'Warranty Period (months)', type: 'number' }]), 'Active').lastInsertRowid;
  const furnitureId = insertCat.run('Furniture', 'Desks, chairs, cabinets, and other furniture',
    JSON.stringify([{ name: 'material', label: 'Material', type: 'text' }]), 'Active').lastInsertRowid;
  const vehicleId = insertCat.run('Vehicles', 'Company vehicles for transportation',
    JSON.stringify([{ name: 'license_plate', label: 'License Plate', type: 'text' }, { name: 'mileage', label: 'Current Mileage', type: 'number' }]), 'Active').lastInsertRowid;
  const roomId = insertCat.run('Rooms & Spaces', 'Meeting rooms, conference halls, and shared spaces',
    JSON.stringify([{ name: 'capacity', label: 'Capacity', type: 'number' }]), 'Active').lastInsertRowid;
  const equipId = insertCat.run('Equipment', 'Projectors, printers, tools, and shared equipment',
    JSON.stringify([]), 'Active').lastInsertRowid;

  // ── Create Sample Assets ──
  const insertAsset = db.prepare(`INSERT INTO assets (name, category_id, asset_tag, serial_number, acquisition_date, acquisition_cost, condition, location, status, is_bookable, department_id, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

  // Electronics
  const tag1 = generateAssetTag();
  insertAsset.run('MacBook Pro 16"', electronicsId, tag1, 'SN-MBP-2024-001', '2024-01-15', 2499.99, 'New', 'Building A, Floor 2', 'Available', 0, itDept.lastInsertRowid, 'Developer laptop with M3 Pro chip');
  const tag2 = generateAssetTag();
  insertAsset.run('Dell UltraSharp 27" Monitor', electronicsId, tag2, 'SN-DLL-2024-002', '2024-02-10', 549.99, 'Good', 'Building A, Floor 2', 'Available', 0, itDept.lastInsertRowid, '4K USB-C monitor');
  const tag3 = generateAssetTag();
  insertAsset.run('MacBook Air 15"', electronicsId, tag3, 'SN-MBA-2024-003', '2024-03-05', 1799.99, 'Good', 'Building A, Floor 3', 'Allocated', 0, itDept.lastInsertRowid, 'Marketing team laptop');
  const tag4 = generateAssetTag();
  insertAsset.run('iPhone 15 Pro', electronicsId, tag4, 'SN-IPH-2024-004', '2024-01-20', 1199.99, 'New', 'Building A, Floor 1', 'Available', 0, opsDept.lastInsertRowid, 'Company phone');

  // Furniture
  const tag5 = generateAssetTag();
  insertAsset.run('Standing Desk - Electric', furnitureId, tag5, 'SN-DSK-2024-005', '2024-01-10', 699.99, 'Good', 'Building A, Floor 2', 'Allocated', 0, itDept.lastInsertRowid, 'Adjustable standing desk');
  const tag6 = generateAssetTag();
  insertAsset.run('Herman Miller Aeron Chair', furnitureId, tag6, 'SN-CHR-2024-006', '2024-02-01', 1395.00, 'New', 'Building A, Floor 2', 'Available', 0, null, 'Ergonomic office chair');

  // Vehicles
  const tag7 = generateAssetTag();
  insertAsset.run('Toyota Camry 2024', vehicleId, tag7, 'VIN-TC-2024-007', '2024-04-01', 28999.99, 'New', 'Parking Lot B', 'Available', 1, opsDept.lastInsertRowid, 'Company pool vehicle');
  const tag8 = generateAssetTag();
  insertAsset.run('Ford Transit Van', vehicleId, tag8, 'VIN-FT-2024-008', '2023-06-15', 35999.99, 'Good', 'Parking Lot A', 'Available', 1, opsDept.lastInsertRowid, 'Delivery van');

  // Rooms (bookable)
  const tag9 = generateAssetTag();
  insertAsset.run('Conference Room A - "Summit"', roomId, tag9, 'RM-CONF-A', '2020-01-01', 0, 'Good', 'Building A, Floor 1', 'Available', 1, null, 'Large conference room, seats 20');
  const tag10 = generateAssetTag();
  insertAsset.run('Meeting Room B2 - "Focus"', roomId, tag10, 'RM-MTG-B2', '2020-01-01', 0, 'Good', 'Building B, Floor 2', 'Available', 1, null, 'Small meeting room, seats 6');
  const tag11 = generateAssetTag();
  insertAsset.run('Training Room - "Academy"', roomId, tag11, 'RM-TRN-01', '2021-03-15', 0, 'Good', 'Building A, Floor 3', 'Available', 1, null, 'Training room with projector, seats 30');

  // Equipment (bookable)
  const tag12 = generateAssetTag();
  insertAsset.run('Epson Projector 4K', equipId, tag12, 'SN-PRJ-2024-012', '2024-02-20', 899.99, 'New', 'Storage Room 1', 'Available', 1, null, 'Portable 4K projector');

  // ── Create Sample Allocation ──
  // MacBook Air allocated to Lisa (Marketing)
  const asset3Id = db.prepare('SELECT id FROM assets WHERE asset_tag = ?').get(tag3).id;
  db.prepare(`INSERT INTO allocations (asset_id, allocated_to, allocated_by, department_id, expected_return_date, status) VALUES (?, ?, ?, ?, ?, ?)`).run(
    asset3Id, emp5.lastInsertRowid, assetMgr.lastInsertRowid, mktDept.lastInsertRowid, '2025-03-05', 'Active'
  );

  // Standing Desk allocated to Priya (IT)
  const asset5Id = db.prepare('SELECT id FROM assets WHERE asset_tag = ?').get(tag5).id;
  db.prepare(`INSERT INTO allocations (asset_id, allocated_to, allocated_by, department_id, expected_return_date, status) VALUES (?, ?, ?, ?, ?, ?)`).run(
    asset5Id, emp1.lastInsertRowid, assetMgr.lastInsertRowid, itDept.lastInsertRowid, null, 'Active'
  );

  // ── Create Sample Bookings ──
  const room1Id = db.prepare('SELECT id FROM assets WHERE asset_tag = ?').get(tag9).id;
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayAfter = new Date(now);
  dayAfter.setDate(dayAfter.getDate() + 2);

  db.prepare(`INSERT INTO bookings (asset_id, booked_by, start_time, end_time, purpose, status) VALUES (?, ?, ?, ?, ?, ?)`).run(
    room1Id, emp1.lastInsertRowid,
    `${tomorrow.toISOString().split('T')[0]}T09:00:00`,
    `${tomorrow.toISOString().split('T')[0]}T10:00:00`,
    'Sprint Planning Meeting', 'Upcoming'
  );
  db.prepare(`INSERT INTO bookings (asset_id, booked_by, start_time, end_time, purpose, status) VALUES (?, ?, ?, ?, ?, ?)`).run(
    room1Id, emp2.lastInsertRowid,
    `${tomorrow.toISOString().split('T')[0]}T14:00:00`,
    `${tomorrow.toISOString().split('T')[0]}T15:30:00`,
    'Client Presentation', 'Upcoming'
  );

  // ── Create Sample Notifications ──
  const insertNotif = db.prepare('INSERT INTO notifications (user_id, type, title, message, is_read, reference_type, reference_id) VALUES (?, ?, ?, ?, ?, ?, ?)');
  insertNotif.run(emp5.lastInsertRowid, 'AssetAssigned', 'Asset Assigned', 'MacBook Air 15" (AF-0003) has been allocated to you.', 0, 'allocation', 1);
  insertNotif.run(emp1.lastInsertRowid, 'AssetAssigned', 'Asset Assigned', 'Standing Desk (AF-0005) has been allocated to you.', 1, 'allocation', 2);
  insertNotif.run(emp1.lastInsertRowid, 'BookingConfirmed', 'Booking Confirmed', 'Conference Room A booked for Sprint Planning tomorrow 9:00-10:00.', 0, 'booking', 1);

  // ── Activity Logs ──
  const insertLog = db.prepare('INSERT INTO activity_logs (user_id, user_name, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)');
  insertLog.run(admin.lastInsertRowid, 'System Admin', 'CREATE', 'department', itDept.lastInsertRowid, JSON.stringify({ name: 'Information Technology' }));
  insertLog.run(assetMgr.lastInsertRowid, 'Sarah Chen', 'CREATE', 'asset', 1, JSON.stringify({ name: 'MacBook Pro 16"', asset_tag: tag1 }));
  insertLog.run(assetMgr.lastInsertRowid, 'Sarah Chen', 'ALLOCATE', 'asset', asset3Id, JSON.stringify({ allocated_to: 'Lisa Wang', asset_tag: tag3 }));

  console.log('✅ Database seeded with sample data');
  console.log('   📧 Admin: admin@assetflow.com / admin123');
  console.log('   📧 Employees: [name]@assetflow.com / password123');
}

module.exports = { seedDatabase };
