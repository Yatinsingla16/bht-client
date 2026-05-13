import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import logoFull from '../assets/logo-full.svg';

const ROLES = ['BA', 'DEV', 'US', 'PM'];

export default function LoginPage() {
  const { login, user }   = useAuth();
  const navigate          = useNavigate();
  const [name, setName]   = useState('');
  const [pass, setPass]   = useState('');
  const [role, setRole]   = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) { navigate('/'); return null; }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(name, pass, role || undefined);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Check your name and password.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight:      '100vh',
      background:     'var(--bg)',
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'center',
    }}>
      <div style={{ width: 380 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <img
            src={logoFull}
            alt="Chandika Innov"
            style={{ height: 130, width: 'auto' }}
          />
        </div>

        {/* App title */}
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 22, color: 'var(--navy)', marginBottom: 4, textAlign: 'center' }}>
          Billable Hours Tracker
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 28, textAlign: 'center' }}>
          Internal Tool
        </p>

        <form onSubmit={handleSubmit} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label className="label">Full Name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Your name as registered"
              required
              autoFocus
            />
          </div>
          <div>
            <label className="label">Role</label>
            <select value={role} onChange={e => setRole(e.target.value)}>
              <option value="">— Select your role —</option>
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          <div>
            <label className="label">Password</label>
            <input
              type="password"
              value={pass}
              onChange={e => setPass(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <p style={{
              color: '#b83232', fontSize: 13,
              background: '#fef2f2', border: '1px solid #f5c6c2',
              borderRadius: 2, padding: '8px 12px',
            }}>
              {error}
            </p>
          )}

          <button type="submit" className="btn-primary" disabled={loading} style={{ marginTop: 4 }}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <div className="divider" style={{ marginTop: 28 }} />
        <p style={{ color: 'var(--muted)', fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', textAlign: 'center' }}>
          Chandika Innov · Confidential
        </p>
      </div>
    </div>
  );
}
