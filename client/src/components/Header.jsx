import { Bell, Menu } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';

export default function Header({ title, collapsed, onToggle }) {
  const { user, logout } = useAuth();
  const { unreadCount } = useNotifications();
  const navigate = useNavigate();

  return (
    <header className={`header ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <div className="flex items-center gap-3">
        <button className="header-icon-btn" onClick={onToggle}>
          <Menu size={18} />
        </button>
        <span className="header-title">{title}</span>
      </div>
      <div className="header-actions">
        <button className="header-icon-btn" onClick={() => navigate('/activity')} title="Notifications">
          <Bell size={18} />
          {unreadCount > 0 && (
            <span className="notification-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
          )}
        </button>
        <div
          style={{
            width: 34, height: 34, borderRadius: '50%',
            background: 'linear-gradient(135deg, #4f8ef7, #7c5af7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.75rem', fontWeight: 700, color: 'white', cursor: 'pointer',
            border: '2px solid rgba(79,142,247,0.3)',
          }}
          title={user?.name}
        >
          {user?.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
        </div>
      </div>
    </header>
  );
}
