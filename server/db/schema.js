const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'assetflow.db');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

function initializeSchema() {
  const db = getDb();

  db.exec(`
    -- Users / Employees
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'Employee' CHECK(role IN ('Employee','DepartmentHead','AssetManager','Admin')),
      department_id INTEGER,
      phone TEXT,
      status TEXT NOT NULL DEFAULT 'Active' CHECK(status IN ('Active','Inactive')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
    );

    -- Departments
    CREATE TABLE IF NOT EXISTS departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      parent_id INTEGER,
      head_id INTEGER,
      status TEXT NOT NULL DEFAULT 'Active' CHECK(status IN ('Active','Inactive')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (parent_id) REFERENCES departments(id) ON DELETE SET NULL,
      FOREIGN KEY (head_id) REFERENCES users(id) ON DELETE SET NULL
    );

    -- Asset Categories
    CREATE TABLE IF NOT EXISTS asset_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      custom_fields TEXT DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'Active' CHECK(status IN ('Active','Inactive')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Assets
    CREATE TABLE IF NOT EXISTS assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category_id INTEGER NOT NULL,
      asset_tag TEXT NOT NULL UNIQUE,
      serial_number TEXT,
      acquisition_date DATE,
      acquisition_cost REAL DEFAULT 0,
      condition TEXT DEFAULT 'Good' CHECK(condition IN ('New','Good','Fair','Poor','Damaged')),
      location TEXT,
      status TEXT NOT NULL DEFAULT 'Available' CHECK(status IN ('Available','Allocated','Reserved','UnderMaintenance','Lost','Retired','Disposed')),
      is_bookable INTEGER DEFAULT 0,
      photo_url TEXT,
      department_id INTEGER,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES asset_categories(id),
      FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
    );

    -- Asset Tag Sequence
    CREATE TABLE IF NOT EXISTS asset_tag_seq (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      next_val INTEGER NOT NULL DEFAULT 1
    );
    INSERT OR IGNORE INTO asset_tag_seq (id, next_val) VALUES (1, 1);

    -- Allocations
    CREATE TABLE IF NOT EXISTS allocations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      asset_id INTEGER NOT NULL,
      allocated_to INTEGER NOT NULL,
      allocated_by INTEGER NOT NULL,
      department_id INTEGER,
      expected_return_date DATE,
      actual_return_date DATE,
      return_condition TEXT,
      return_notes TEXT,
      status TEXT NOT NULL DEFAULT 'Active' CHECK(status IN ('Active','Returned','Overdue','TransferRequested')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (asset_id) REFERENCES assets(id),
      FOREIGN KEY (allocated_to) REFERENCES users(id),
      FOREIGN KEY (allocated_by) REFERENCES users(id),
      FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
    );

    -- Transfer Requests
    CREATE TABLE IF NOT EXISTS transfer_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      allocation_id INTEGER,
      asset_id INTEGER NOT NULL,
      from_user_id INTEGER NOT NULL,
      to_user_id INTEGER NOT NULL,
      requested_by INTEGER NOT NULL,
      approved_by INTEGER,
      status TEXT NOT NULL DEFAULT 'Requested' CHECK(status IN ('Requested','Approved','Rejected','Completed')),
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (allocation_id) REFERENCES allocations(id),
      FOREIGN KEY (asset_id) REFERENCES assets(id),
      FOREIGN KEY (from_user_id) REFERENCES users(id),
      FOREIGN KEY (to_user_id) REFERENCES users(id),
      FOREIGN KEY (requested_by) REFERENCES users(id),
      FOREIGN KEY (approved_by) REFERENCES users(id)
    );

    -- Bookings
    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      asset_id INTEGER NOT NULL,
      booked_by INTEGER NOT NULL,
      start_time DATETIME NOT NULL,
      end_time DATETIME NOT NULL,
      purpose TEXT,
      status TEXT NOT NULL DEFAULT 'Upcoming' CHECK(status IN ('Upcoming','Ongoing','Completed','Cancelled')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (asset_id) REFERENCES assets(id),
      FOREIGN KEY (booked_by) REFERENCES users(id)
    );

    -- Maintenance Requests
    CREATE TABLE IF NOT EXISTS maintenance_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      asset_id INTEGER NOT NULL,
      requested_by INTEGER NOT NULL,
      description TEXT NOT NULL,
      priority TEXT NOT NULL DEFAULT 'Medium' CHECK(priority IN ('Low','Medium','High','Critical')),
      status TEXT NOT NULL DEFAULT 'Pending' CHECK(status IN ('Pending','Approved','Rejected','TechAssigned','InProgress','Resolved')),
      approved_by INTEGER,
      technician_id INTEGER,
      technician_notes TEXT,
      resolution_notes TEXT,
      resolved_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (asset_id) REFERENCES assets(id),
      FOREIGN KEY (requested_by) REFERENCES users(id),
      FOREIGN KEY (approved_by) REFERENCES users(id),
      FOREIGN KEY (technician_id) REFERENCES users(id)
    );

    -- Audit Cycles
    CREATE TABLE IF NOT EXISTS audit_cycles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      scope_type TEXT NOT NULL CHECK(scope_type IN ('Department','Location','All')),
      scope_value TEXT,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      status TEXT NOT NULL DEFAULT 'Open' CHECK(status IN ('Open','InProgress','Closed')),
      created_by INTEGER NOT NULL,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    -- Audit Assignments
    CREATE TABLE IF NOT EXISTS audit_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      audit_cycle_id INTEGER NOT NULL,
      auditor_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (audit_cycle_id) REFERENCES audit_cycles(id) ON DELETE CASCADE,
      FOREIGN KEY (auditor_id) REFERENCES users(id)
    );

    -- Audit Items
    CREATE TABLE IF NOT EXISTS audit_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      audit_cycle_id INTEGER NOT NULL,
      asset_id INTEGER NOT NULL,
      auditor_id INTEGER,
      status TEXT NOT NULL DEFAULT 'Pending' CHECK(status IN ('Pending','Verified','Missing','Damaged')),
      notes TEXT,
      audited_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (audit_cycle_id) REFERENCES audit_cycles(id) ON DELETE CASCADE,
      FOREIGN KEY (asset_id) REFERENCES assets(id),
      FOREIGN KEY (auditor_id) REFERENCES users(id)
    );

    -- Notifications
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      is_read INTEGER DEFAULT 0,
      reference_type TEXT,
      reference_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Activity Logs
    CREATE TABLE IF NOT EXISTS activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      user_name TEXT,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id INTEGER,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    -- Indexes for performance
    CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status);
    CREATE INDEX IF NOT EXISTS idx_assets_category ON assets(category_id);
    CREATE INDEX IF NOT EXISTS idx_assets_tag ON assets(asset_tag);
    CREATE INDEX IF NOT EXISTS idx_allocations_asset ON allocations(asset_id);
    CREATE INDEX IF NOT EXISTS idx_allocations_user ON allocations(allocated_to);
    CREATE INDEX IF NOT EXISTS idx_allocations_status ON allocations(status);
    CREATE INDEX IF NOT EXISTS idx_bookings_asset ON bookings(asset_id);
    CREATE INDEX IF NOT EXISTS idx_bookings_time ON bookings(start_time, end_time);
    CREATE INDEX IF NOT EXISTS idx_maintenance_asset ON maintenance_requests(asset_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
    CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON activity_logs(user_id);
  `);

  console.log('✅ Database schema initialized');
}

function generateAssetTag() {
  const db = getDb();
  const row = db.prepare('SELECT next_val FROM asset_tag_seq WHERE id = 1').get();
  const tag = `AF-${String(row.next_val).padStart(4, '0')}`;
  db.prepare('UPDATE asset_tag_seq SET next_val = next_val + 1 WHERE id = 1').run();
  return tag;
}

module.exports = { getDb, initializeSchema, generateAssetTag };
