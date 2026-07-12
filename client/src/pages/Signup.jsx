import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Package, User, Mail, Lock, Phone, Eye, EyeOff, Loader2, Info } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Signup() {
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { signup } = useAuth();
  const navigate = useNavigate();

  const handle = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setLoading(true);
    try {
      await signup(form.name, form.email, form.password, form.phone);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Signup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-bg-gradient" />
      <div className="auth-card animate-slideUp">
        <div className="auth-logo">
          <div className="auth-logo-icon"><Package size={22} color="white" /></div>
          <span className="auth-logo-text">AssetFlow</span>
        </div>

        <h1 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>Create account</h1>
        <p className="auth-subtitle">Join AssetFlow as an Employee</p>

        <div className="alert alert-info" style={{ marginBottom: '1rem' }}>
          <Info size={16} className="alert-icon" />
          <div>
            <div className="alert-title">Employee Account</div>
            <div className="alert-message">New accounts are created as Employee. Admins can promote roles from the Employee Directory.</div>
          </div>
        </div>

        {error && <div className="auth-error">{error}</div>}

        <form className="auth-form" onSubmit={handle}>
          <div className="form-group">
            <label className="form-label required">Full Name</label>
            <div style={{ position: 'relative' }}>
              <User size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input type="text" className="form-control" style={{ paddingLeft: '2.25rem' }} placeholder="John Doe"
                value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label required">Email</label>
            <div style={{ position: 'relative' }}>
              <Mail size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input type="email" className="form-control" style={{ paddingLeft: '2.25rem' }} placeholder="you@company.com"
                value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Phone (optional)</label>
            <div style={{ position: 'relative' }}>
              <Phone size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input type="tel" className="form-control" style={{ paddingLeft: '2.25rem' }} placeholder="+1-555-0100"
                value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label required">Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input type={showPw ? 'text' : 'password'} className="form-control" style={{ paddingLeft: '2.25rem', paddingRight: '2.25rem' }}
                placeholder="Min. 6 characters" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required />
              <button type="button" onClick={() => setShowPw(s => !s)}
                style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button type="submit" className="btn btn-primary btn-lg w-full" disabled={loading}>
            {loading ? <Loader2 size={18} className="spin" /> : 'Create Account'}
          </button>
        </form>

        <div className="auth-footer">
          Already have an account? <Link to="/login">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
