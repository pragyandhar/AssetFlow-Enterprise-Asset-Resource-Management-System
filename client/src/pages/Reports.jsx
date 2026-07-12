import { useState, useEffect } from 'react';
import { BarChart3, Download } from 'lucide-react';
import api from '../api/client';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, ArcElement, Tooltip, Legend, Filler
} from 'chart.js';
import { Bar, Doughnut, Pie } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Tooltip, Legend, Filler);

const CHART_COLORS = ['#4f8ef7', '#7c5af7', '#22c55e', '#f59e0b', '#ef4444', '#38bdf8', '#a78bfa', '#fb923c'];

const chartOptions = (title) => ({
  responsive: true,
  plugins: {
    legend: { position: 'bottom', labels: { color: '#94a3b8', padding: 16, font: { family: 'Inter', size: 12 } } },
    tooltip: { backgroundColor: '#0f1629', borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1, titleColor: '#f1f5f9', bodyColor: '#94a3b8', padding: 10 },
  },
  scales: title ? {
    x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.04)' } },
    y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.04)' }, beginAtZero: true }
  } : undefined,
});

function ChartCard({ title, subtitle, children }) {
  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title">{title}</div>
          {subtitle && <div className="card-subtitle">{subtitle}</div>}
        </div>
      </div>
      {children}
    </div>
  );
}

export default function Reports() {
  const [utilization, setUtilization] = useState(null);
  const [maintenance, setMaintenance] = useState(null);
  const [deptAlloc, setDeptAlloc] = useState(null);
  const [bookingHeat, setBookingHeat] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('utilization');

  useEffect(() => {
    Promise.all([
      api.get('/reports/asset-utilization'),
      api.get('/reports/maintenance-frequency'),
      api.get('/reports/department-allocation'),
      api.get('/reports/booking-heatmap'),
    ]).then(([u, m, d, b]) => {
      setUtilization(u.data);
      setMaintenance(m.data);
      setDeptAlloc(d.data);
      setBookingHeat(b.data);
      setLoading(false);
    });
  }, []);

  const exportCSV = (data, filename) => {
    if (!data?.length) return;
    const keys = Object.keys(data[0]);
    const csv = [keys.join(','), ...data.map(row => keys.map(k => `"${row[k] ?? ''}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${filename}.csv`; a.click();
  };

  if (loading) return <div className="loading-container"><div className="loading-spinner" /></div>;

  const assetByStatus = utilization?.byStatus || [];
  const doughnutData = {
    labels: assetByStatus.map(s => s.status),
    datasets: [{
      data: assetByStatus.map(s => s.count),
      backgroundColor: CHART_COLORS.slice(0, assetByStatus.length),
      borderColor: 'rgba(0,0,0,0.3)', borderWidth: 2,
    }]
  };

  const byCategoryData = {
    labels: (utilization?.byCategory || []).map(c => c.category || 'Uncategorized'),
    datasets: [
      { label: 'Available', data: (utilization?.byCategory || []).map(c => c.available), backgroundColor: 'rgba(34,197,94,0.7)', borderRadius: 4 },
      { label: 'Allocated', data: (utilization?.byCategory || []).map(c => c.allocated), backgroundColor: 'rgba(79,142,247,0.7)', borderRadius: 4 },
    ]
  };

  const maintCatData = {
    labels: (maintenance?.byCategory || []).map(c => c.category || 'Uncategorized'),
    datasets: [{
      label: 'Maintenance Requests',
      data: (maintenance?.byCategory || []).map(c => c.count),
      backgroundColor: CHART_COLORS.map(c => c + 'aa'),
      borderColor: CHART_COLORS,
      borderWidth: 2, borderRadius: 4,
    }]
  };

  const deptData = {
    labels: (deptAlloc?.data || []).map(d => d.department),
    datasets: [
      { label: 'Assets', data: (deptAlloc?.data || []).map(d => d.asset_count), backgroundColor: 'rgba(79,142,247,0.7)', borderRadius: 4 },
      { label: 'Active Allocations', data: (deptAlloc?.data || []).map(d => d.allocation_count), backgroundColor: 'rgba(124,90,247,0.7)', borderRadius: 4 },
      { label: 'Employees', data: (deptAlloc?.data || []).map(d => d.employee_count), backgroundColor: 'rgba(34,197,94,0.7)', borderRadius: 4 },
    ]
  };

  const maintStatusData = {
    labels: (maintenance?.byStatus || []).map(s => s.status),
    datasets: [{
      data: (maintenance?.byStatus || []).map(s => s.count),
      backgroundColor: CHART_COLORS.slice(0, (maintenance?.byStatus || []).length),
      borderColor: 'rgba(0,0,0,0.3)', borderWidth: 2,
    }]
  };

  const bookingResourceData = {
    labels: (bookingHeat?.byResource || []).map(r => r.name),
    datasets: [{
      label: 'Total Bookings',
      data: (bookingHeat?.byResource || []).map(r => r.booking_count),
      backgroundColor: CHART_COLORS.map(c => c + 'bb'),
      borderColor: CHART_COLORS,
      borderWidth: 2, borderRadius: 4,
    }]
  };

  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const heatmapData = {};
  (bookingHeat?.bookings || []).forEach(b => {
    const key = `${DAY_NAMES[b.day_of_week]}-${b.hour}`;
    heatmapData[key] = (heatmapData[key] || 0) + b.count;
  });

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Reports & Analytics</h1>
          <p className="page-subtitle">Actionable operational insight into your asset portfolio</p>
        </div>
      </div>

      <div className="tabs mb-4">
        {[
          { id: 'utilization', label: '📊 Asset Utilization' },
          { id: 'maintenance', label: '🔧 Maintenance' },
          { id: 'departments', label: '🏢 Departments' },
          { id: 'bookings', label: '📅 Booking Heatmap' },
        ].map(({ id, label }) => (
          <button key={id} className={`tab ${activeTab === id ? 'active' : ''}`} onClick={() => setActiveTab(id)}>{label}</button>
        ))}
      </div>

      {activeTab === 'utilization' && (
        <div className="grid-2">
          <ChartCard title="Asset Status Distribution" subtitle="Current asset lifecycle breakdown">
            <Doughnut data={doughnutData} options={{ ...chartOptions(null), plugins: { ...chartOptions(null).plugins } }} />
          </ChartCard>
          <ChartCard title="Assets by Category" subtitle="Available vs Allocated per category">
            <Bar data={byCategoryData} options={chartOptions(true)} />
          </ChartCard>
          <div className="card" style={{ gridColumn: 'span 2' }}>
            <div className="card-header">
              <div><div className="card-title">Most Allocated Assets</div><div className="card-subtitle">Top assets by total allocation count</div></div>
              <button className="btn btn-secondary btn-sm" onClick={() => exportCSV(utilization?.mostAllocated, 'most-allocated-assets')}><Download size={14} /> Export</button>
            </div>
            <div className="table-responsive">
              <table>
                <thead><tr><th>Asset</th><th>Tag</th><th>Category</th><th>Total Allocations</th></tr></thead>
                <tbody>
                  {(utilization?.mostAllocated || []).map((a, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 600 }}>{a.name}</td>
                      <td><span className="asset-tag">{a.asset_tag}</span></td>
                      <td>{a.category}</td>
                      <td style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>{a.allocation_count}</td>
                    </tr>
                  ))}
                  {!utilization?.mostAllocated?.length && <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>No data</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'maintenance' && (
        <div className="grid-2">
          <ChartCard title="Maintenance by Category" subtitle="Which categories need the most repairs">
            <Bar data={maintCatData} options={chartOptions(true)} />
          </ChartCard>
          <ChartCard title="Request Status Breakdown" subtitle="Current maintenance request states">
            <Pie data={maintStatusData} options={chartOptions(null)} />
          </ChartCard>
          <div className="card" style={{ gridColumn: 'span 2' }}>
            <div className="card-header">
              <div><div className="card-title">Most Maintained Assets</div><div className="card-subtitle">Assets with highest repair frequency</div></div>
              <button className="btn btn-secondary btn-sm" onClick={() => exportCSV(maintenance?.byAsset, 'maintenance-frequency')}><Download size={14} /> Export</button>
            </div>
            <div className="table-responsive">
              <table>
                <thead><tr><th>Asset</th><th>Tag</th><th>Category</th><th>Maintenance Count</th></tr></thead>
                <tbody>
                  {(maintenance?.byAsset || []).map((a, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 600 }}>{a.name}</td>
                      <td><span className="asset-tag">{a.asset_tag}</span></td>
                      <td>{a.category}</td>
                      <td style={{ fontWeight: 700, color: 'var(--warning)' }}>{a.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'departments' && (
        <div>
          <div className="card mb-4">
            <div className="card-header">
              <div><div className="card-title">Department-wise Allocation Summary</div><div className="card-subtitle">Assets, allocations, and headcount by department</div></div>
              <button className="btn btn-secondary btn-sm" onClick={() => exportCSV(deptAlloc?.data, 'department-allocation')}><Download size={14} /> Export</button>
            </div>
            <Bar data={deptData} options={chartOptions(true)} style={{ maxHeight: 320 }} />
          </div>
          <div className="table-container">
            <div className="table-responsive">
              <table>
                <thead><tr><th>Department</th><th>Total Assets</th><th>Active Allocations</th><th>Employees</th></tr></thead>
                <tbody>
                  {(deptAlloc?.data || []).map((d, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 600 }}>{d.department}</td>
                      <td>{d.asset_count}</td>
                      <td style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>{d.allocation_count}</td>
                      <td>{d.employee_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'bookings' && (
        <div className="grid-2">
          <ChartCard title="Top Booked Resources" subtitle="Most popular shared resources">
            <Bar data={bookingResourceData} options={chartOptions(true)} />
          </ChartCard>
          <div className="card">
            <div className="card-header"><div className="card-title">Booking Heatmap</div><div className="card-subtitle">Peak usage by day and hour</div></div>
            <div style={{ overflowX: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'auto repeat(24, 1fr)', gap: 2, minWidth: 600 }}>
                <div />
                {Array.from({ length: 24 }, (_, h) => (
                  <div key={h} style={{ textAlign: 'center', fontSize: '0.5625rem', color: 'var(--text-muted)', padding: '2px 0' }}>{h}</div>
                ))}
                {DAY_NAMES.map((day, di) => (
                  <>
                    <div key={day} style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', paddingRight: 4 }}>{day}</div>
                    {Array.from({ length: 24 }, (_, h) => {
                      const count = heatmapData[`${day}-${String(h).padStart(2, '0')}`] || 0;
                      const intensity = Math.min(count / 5, 1);
                      return (
                        <div key={h} title={`${day} ${h}:00 — ${count} bookings`}
                          style={{ height: 20, borderRadius: 2, background: count ? `rgba(79,142,247,${0.1 + intensity * 0.8})` : 'rgba(255,255,255,0.03)', cursor: 'default', transition: 'opacity 0.15s' }} />
                      );
                    })}
                  </>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.5rem', marginTop: '0.75rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                <span>Low</span>
                {[0.1, 0.3, 0.5, 0.7, 0.9].map(o => <div key={o} style={{ width: 16, height: 16, background: `rgba(79,142,247,${o})`, borderRadius: 2 }} />)}
                <span>High</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
