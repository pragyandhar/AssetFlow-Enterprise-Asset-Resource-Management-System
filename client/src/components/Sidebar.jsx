import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Building2, Package, ArrowLeftRight,
  CalendarDays, Wrench, ClipboardList, BarChart3,
  Bell, LogOut, ChevronLeft, Settings, Box
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';

const navItems = [
  { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', roles: null },
  { path: '/org-setup', icon: Building2, label: 'Organization', roles: ['Admin'] },
  { path: '/assets', icon: Box, label: 'Assets', roles: null },
  { path: '/allocations', icon: ArrowLeftRight, label: 'Allocations', roles: null },
  { path: '/bookings', icon: CalendarDays, label: 'Resource Booking', roles: null },
  { path: '/maintenance', icon: Wrench, label: 'Maintenance', roles: null },
  { path: '/audits', icon: ClipboardList, label: 'Audits', roles: ['Admin', 'AssetManager'] },
  { path: '/reports', icon: BarChart3, label: 'Reports', roles: ['Admin', 'AssetManager', 'DepartmentHead'] },
  { path: '/activity', icon: Bell, label: 'Activity & Logs', roles: null },
];

export default function Sidebar({ collapsed, onToggle }) {
  const { user, logout, isAdmin } = useAuth();
  const { unreadCount } = useNotifications();

  const initials = user?.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'AF';

  const visibleItems = navItems.filter(item =>
    !item.roles || item.roles.includes(user?.role)
  );

  return (
    <nav className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <Package size={18} color="white" />
        </div>
        {!collapsed && <span className="sidebar-logo-text">AssetFlow</span>}
      </div>

      <div className="sidebar-nav">
        {!collapsed && <div className="sidebar-section-label">Navigation</div>}
        {visibleItems.map(({ path, icon: Icon, label }) => (
          <NavLink
            key={path}
            to={path}
            className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}
            data-tooltip={collapsed ? label : undefined}
          >
            <Icon size={18} className="sidebar-item-icon" />
            {!collapsed && <span className="sidebar-item-label">{label}</span>}
            {label === 'Activity & Logs' && unreadCount > 0 && !collapsed && (
              <span className="sidebar-item-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
            )}
          </NavLink>
        ))}
      </div>

      <div className="sidebar-footer">
        <button
          onClick={onToggle}
          className="sidebar-item"
          style={{ width: '100%', border: 'none', background: 'transparent', marginBottom: '0.25rem' }}
        >
          <ChevronLeft size={18} style={{ transform: collapsed ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s', flexShrink: 0 }} />
          {!collapsed && <span className="sidebar-item-label">Collapse</span>}
        </button>

        <div className="sidebar-user">
          <div className="sidebar-avatar">{initials}</div>
          {!collapsed && (
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{user?.name}</div>
              <div className="sidebar-user-role">{user?.role}</div>
            </div>
          )}
          {!collapsed && (
            <button onClick={logout} className="btn btn-ghost btn-icon btn-sm" style={{ marginLeft: 'auto' }} title="Logout">
              <LogOut size={15} />
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
