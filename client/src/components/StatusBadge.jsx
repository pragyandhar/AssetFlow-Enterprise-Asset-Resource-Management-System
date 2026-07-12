const STATUS_MAP = {
  // Asset statuses
  Available:        { label: 'Available',         cls: 'badge-success' },
  Allocated:        { label: 'Allocated',          cls: 'badge-info' },
  Reserved:         { label: 'Reserved',           cls: 'badge-purple' },
  UnderMaintenance: { label: 'Under Maintenance',  cls: 'badge-warning' },
  Lost:             { label: 'Lost',               cls: 'badge-danger' },
  Retired:          { label: 'Retired',            cls: 'badge-muted' },
  Disposed:         { label: 'Disposed',           cls: 'badge-muted' },

  // Allocation statuses
  Active:           { label: 'Active',             cls: 'badge-success' },
  Returned:         { label: 'Returned',           cls: 'badge-muted' },
  Overdue:          { label: 'Overdue',            cls: 'badge-danger' },
  TransferRequested:{ label: 'Transfer Req.',      cls: 'badge-warning' },

  // Transfer
  Requested:        { label: 'Requested',          cls: 'badge-warning' },
  Approved:         { label: 'Approved',           cls: 'badge-success' },
  Rejected:         { label: 'Rejected',           cls: 'badge-danger' },
  Completed:        { label: 'Completed',          cls: 'badge-muted' },

  // Booking
  Upcoming:         { label: 'Upcoming',           cls: 'badge-blue' },
  Ongoing:          { label: 'Ongoing',            cls: 'badge-success' },
  Cancelled:        { label: 'Cancelled',          cls: 'badge-danger' },

  // Maintenance
  Pending:          { label: 'Pending',            cls: 'badge-warning' },
  TechAssigned:     { label: 'Tech Assigned',      cls: 'badge-info' },
  InProgress:       { label: 'In Progress',        cls: 'badge-blue' },
  Resolved:         { label: 'Resolved',           cls: 'badge-success' },

  // Audit
  Open:             { label: 'Open',               cls: 'badge-blue' },
  InProgress2:      { label: 'In Progress',        cls: 'badge-warning' },
  Closed:           { label: 'Closed',             cls: 'badge-muted' },
  Verified:         { label: 'Verified',           cls: 'badge-success' },
  Missing:          { label: 'Missing',            cls: 'badge-danger' },
  Damaged:          { label: 'Damaged',            cls: 'badge-warning' },

  // Priority
  Low:              { label: 'Low',                cls: 'badge-muted' },
  Medium:           { label: 'Medium',             cls: 'badge-warning' },
  High:             { label: 'High',               cls: 'badge-danger' },
  Critical:         { label: 'Critical',           cls: 'badge-danger' },

  // User statuses
  Employee:         { label: 'Employee',           cls: 'badge-muted' },
  AssetManager:     { label: 'Asset Manager',      cls: 'badge-blue' },
  DepartmentHead:   { label: 'Dept. Head',         cls: 'badge-purple' },
  Admin:            { label: 'Admin',              cls: 'badge-info' },
  Inactive:         { label: 'Inactive',           cls: 'badge-danger' },

  // Audit item
  InProgress:       { label: 'In Progress',        cls: 'badge-blue' },
};

export default function StatusBadge({ status, dot = true }) {
  const config = STATUS_MAP[status] || { label: status, cls: 'badge-muted' };
  return (
    <span className={`badge ${config.cls}`}>
      {dot && <span className="badge-dot" />}
      {config.label}
    </span>
  );
}
