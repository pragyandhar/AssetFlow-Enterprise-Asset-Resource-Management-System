import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

const PAGE_TITLES = {
  '/dashboard': 'Dashboard',
  '/org-setup': 'Organization Setup',
  '/assets': 'Asset Directory',
  '/allocations': 'Asset Allocations',
  '/bookings': 'Resource Booking',
  '/maintenance': 'Maintenance',
  '/audits': 'Asset Audits',
  '/reports': 'Reports & Analytics',
  '/activity': 'Activity & Notifications',
};

export default function Layout({ children }) {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const title = PAGE_TITLES[location.pathname] || 'AssetFlow';

  return (
    <div className="app-layout">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />
      <div className={`main-content ${collapsed ? 'sidebar-collapsed' : ''}`}>
        <Header title={title} collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />
        <main className="page-content animate-fadeIn">
          {children}
        </main>
      </div>
    </div>
  );
}
