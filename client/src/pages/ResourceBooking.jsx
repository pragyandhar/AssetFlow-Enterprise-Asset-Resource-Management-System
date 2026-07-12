import { useState, useEffect } from 'react';
import { Plus, ChevronLeft, ChevronRight, Clock, AlertTriangle, X, Loader2 } from 'lucide-react';
import api from '../api/client';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';
import { useAuth } from '../context/AuthContext';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, isSameMonth, isToday } from 'date-fns';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function ResourceBooking() {
  const { user } = useAuth();
  const [resources, setResources] = useState([]);
  const [selectedResource, setSelectedResource] = useState(null);
  const [calendarBookings, setCalendarBookings] = useState([]);
  const [allBookings, setAllBookings] = useState([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showCreate, setShowCreate] = useState(false);
  const [clickedDay, setClickedDay] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ start_time: '', end_time: '', purpose: '' });
  const [view, setView] = useState('calendar');

  useEffect(() => {
    api.get('/bookings/resources').then(r => {
      setResources(r.data.resources);
      if (r.data.resources.length > 0) setSelectedResource(r.data.resources[0]);
    });
    api.get('/bookings').then(r => { setAllBookings(r.data.bookings); setLoading(false); });
  }, []);

  useEffect(() => {
    if (!selectedResource) return;
    const month = currentMonth.getMonth() + 1;
    const year = currentMonth.getFullYear();
    api.get(`/bookings/calendar/${selectedResource.id}`, { params: { month, year } })
      .then(r => setCalendarBookings(r.data.bookings));
  }, [selectedResource, currentMonth]);

  const openCreate = (day = null) => {
    const dateStr = day ? format(day, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');
    setForm({ start_time: `${dateStr}T09:00`, end_time: `${dateStr}T10:00`, purpose: '' });
    setError(''); setShowCreate(true);
  };

  const handleBook = async (e) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      await api.post('/bookings', { asset_id: selectedResource.id, ...form });
      setShowCreate(false);
      const month = currentMonth.getMonth() + 1;
      const year = currentMonth.getFullYear();
      const [cal, all] = await Promise.all([
        api.get(`/bookings/calendar/${selectedResource.id}`, { params: { month, year } }),
        api.get('/bookings'),
      ]);
      setCalendarBookings(cal.data.bookings);
      setAllBookings(all.data.bookings);
    } catch (err) {
      setError(err.response?.data?.error || 'Booking failed');
    } finally { setSaving(false); }
  };

  const handleCancel = async (bookingId) => {
    if (!confirm('Cancel this booking?')) return;
    try {
      await api.put(`/bookings/${bookingId}/cancel`);
      setAllBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status: 'Cancelled' } : b));
      setCalendarBookings(prev => prev.filter(b => b.id !== bookingId));
    } catch (err) { alert(err.response?.data?.error || 'Error'); }
  };

  // Calendar computation
  const firstDay = startOfMonth(currentMonth);
  const lastDay = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: firstDay, end: lastDay });
  const startPad = getDay(firstDay);
  const paddedDays = [...Array(startPad).fill(null), ...days];

  const getBookingsForDay = (day) => {
    if (!day) return [];
    return calendarBookings.filter(b => {
      const bDate = parseISO(b.start_time);
      return isSameDay(bDate, day);
    });
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Resource Booking</h1>
          <p className="page-subtitle">Book shared resources by time slot — overlapping bookings are prevented</p>
        </div>
        {selectedResource && (
          <button className="btn btn-primary" onClick={() => openCreate()}><Plus size={16} /> New Booking</button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '1.5rem' }}>
        {/* Resource List */}
        <div>
          <div className="card" style={{ padding: '1rem' }}>
            <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>Resources</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {resources.map(r => (
                <button key={r.id} onClick={() => setSelectedResource(r)}
                  style={{ textAlign: 'left', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: `1px solid ${selectedResource?.id === r.id ? 'var(--border-accent)' : 'var(--border)'}`, background: selectedResource?.id === r.id ? 'rgba(79,142,247,0.1)' : 'var(--bg-input)', cursor: 'pointer', transition: 'all 0.15s' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>{r.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{r.category_name} · {r.location || 'No location'}</div>
                </button>
              ))}
              {resources.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', padding: '1rem', textAlign: 'center' }}>No bookable resources</div>}
            </div>
          </div>
        </div>

        {/* Calendar / List */}
        <div>
          <div className="tabs" style={{ marginBottom: '1rem' }}>
            <button className={`tab ${view === 'calendar' ? 'active' : ''}`} onClick={() => setView('calendar')}>📅 Calendar</button>
            <button className={`tab ${view === 'list' ? 'active' : ''}`} onClick={() => setView('list')}>📋 My Bookings</button>
          </div>

          {view === 'calendar' && (
            <div className="card" style={{ padding: '1rem' }}>
              {/* Month nav */}
              <div className="flex justify-between items-center mb-4">
                <button className="btn btn-ghost btn-icon" onClick={() => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}><ChevronLeft size={18} /></button>
                <h3>{format(currentMonth, 'MMMM yyyy')}</h3>
                <button className="btn btn-ghost btn-icon" onClick={() => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}><ChevronRight size={18} /></button>
              </div>

              {/* Day headers */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', marginBottom: '4px' }}>
                {DAY_NAMES.map(d => (
                  <div key={d} style={{ textAlign: 'center', fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', padding: '0.25rem' }}>{d}</div>
                ))}
              </div>

              {/* Calendar cells */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
                {paddedDays.map((day, i) => {
                  const dayBookings = day ? getBookingsForDay(day) : [];
                  const inMonth = day && isSameMonth(day, currentMonth);
                  return (
                    <div
                      key={i}
                      className={`calendar-cell ${dayBookings.length > 0 ? 'has-booking' : ''} ${day && isToday(day) ? 'today' : ''} ${!inMonth ? 'other-month' : ''}`}
                      onClick={() => day && inMonth && openCreate(day)}
                      style={{ cursor: day && inMonth ? 'pointer' : 'default' }}
                    >
                      {day && <div className="calendar-day-num">{format(day, 'd')}</div>}
                      {dayBookings.slice(0, 3).map(b => (
                        <div key={b.id} className={`calendar-booking-slot ${b.status.toLowerCase()}`} title={`${b.booked_by_name}: ${b.purpose || 'No purpose'}`}>
                          {format(parseISO(b.start_time), 'HH:mm')} {b.booked_by_name}
                        </div>
                      ))}
                      {dayBookings.length > 3 && <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)', padding: '2px 4px' }}>+{dayBookings.length - 3} more</div>}
                    </div>
                  );
                })}
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}><div style={{ width: 12, height: 12, borderRadius: 2, background: 'rgba(79,142,247,0.4)', borderLeft: '2px solid var(--accent-primary)' }} />Upcoming</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}><div style={{ width: 12, height: 12, borderRadius: 2, background: 'rgba(100,116,139,0.15)', borderLeft: '2px solid var(--text-muted)' }} />Completed</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}><Clock size={12} />Click a day to book</div>
              </div>
            </div>
          )}

          {view === 'list' && (
            <div className="table-container">
              <div className="table-responsive">
                {loading ? <div className="loading-container"><div className="loading-spinner" /></div> : (
                  <table>
                    <thead>
                      <tr><th>Resource</th><th>Start</th><th>End</th><th>Purpose</th><th>Status</th><th>Actions</th></tr>
                    </thead>
                    <tbody>
                      {allBookings.map(b => (
                        <tr key={b.id}>
                          <td><div style={{ fontWeight: 600 }}>{b.asset_name}</div><div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{b.location || ''}</div></td>
                          <td style={{ fontSize: '0.8125rem' }}>{format(parseISO(b.start_time), 'MMM d, HH:mm')}</td>
                          <td style={{ fontSize: '0.8125rem' }}>{format(parseISO(b.end_time), 'HH:mm')}</td>
                          <td>{b.purpose || '—'}</td>
                          <td><StatusBadge status={b.status} /></td>
                          <td>
                            {(b.status === 'Upcoming') && b.booked_by === user?.id && (
                              <button className="btn btn-danger btn-sm" onClick={() => handleCancel(b.id)}><X size={14} /> Cancel</button>
                            )}
                          </td>
                        </tr>
                      ))}
                      {allBookings.length === 0 && (
                        <tr><td colSpan={6}><div className="empty-state"><div className="empty-state-title">No bookings found</div></div></td></tr>
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Booking Modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title={`Book: ${selectedResource?.name}`}
        footer={<><button className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button><button className="btn btn-primary" onClick={handleBook} disabled={saving}>{saving ? <Loader2 size={16} className="spin" /> : 'Confirm Booking'}</button></>}>
        {error && (
          <div className="alert alert-danger mb-4">
            <AlertTriangle size={16} className="alert-icon" />
            <div>
              <div className="alert-title">Overlap Detected</div>
              <div className="alert-message">{error}</div>
            </div>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ padding: '0.75rem', background: 'rgba(79,142,247,0.08)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(79,142,247,0.2)', fontSize: '0.875rem' }}>
            <strong>{selectedResource?.name}</strong> · {selectedResource?.location || 'No location'}
          </div>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label required">Start Time</label>
              <input type="datetime-local" className="form-control" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label className="form-label required">End Time</label>
              <input type="datetime-local" className="form-control" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} required />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Purpose</label>
            <input className="form-control" value={form.purpose} onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))} placeholder="e.g. Team Meeting, Training Session..." />
          </div>
        </div>
      </Modal>
    </div>
  );
}
