import { useState, useEffect } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { ACTIVITY_CONFIG } from '../config/activityTypes';

const blank = {
  project_id:    '',
  date:          (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })(),
  ticket_id:     '',
  ticket_title:  '',
  activity_type: '',
  multiplier:    1.0,
  actual_hours:  '',
  notes:         '',
};

export default function WorkEntryForm({ onSuccess }) {
  const { user, sessionRole } = useAuth();
  const [projects, setProjects] = useState([]);
  const [form, setForm]  = useState(blank);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [open, setOpen]  = useState(false);

  const activeRole = sessionRole || user?.role || '';
  const activities = ACTIVITY_CONFIG[activeRole] || [];

  useEffect(() => {
    api.get('/projects').then(r => setProjects(r.data)).catch(() => {});
  }, []);

  function set(field, val) { setForm(f => ({ ...f, [field]: val })); }

  function handleActivityChange(label) {
    const activity = activities.find(a => a.label === label);
    setForm(f => ({
      ...f,
      activity_type: label,
      multiplier: activity ? activity.multiplier : 1.0,
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/work-entries', form);
      setForm(blank);
      setOpen(false);
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save entry');
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button className="btn-primary" onClick={() => setOpen(true)}>
        + Log Work Entry
      </button>
    );
  }

  return (
    <div className="card" style={{ maxWidth: 720, marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 18 }}>Log Work Entry</h3>
        <button className="btn-secondary" onClick={() => setOpen(false)} style={{ padding: '6px 14px' }}>
          Cancel
        </button>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div>
          <label className="label">Project</label>
          <select value={form.project_id} onChange={e => set('project_id', e.target.value)} required>
            <option value="">Select project…</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        <div>
          <label className="label">Date</label>
          <input type="date" value={form.date} onChange={e => set('date', e.target.value)} required />
        </div>

        <div>
          <label className="label">Ticket ID</label>
          <input value={form.ticket_id} onChange={e => set('ticket_id', e.target.value)} placeholder="e.g. NPP-101" />
        </div>

        <div>
          <label className="label">Activity Type</label>
          <select
            value={form.activity_type}
            onChange={e => handleActivityChange(e.target.value)}
            required
          >
            <option value="">Select activity…</option>
            {activities.map(a => <option key={a.label} value={a.label}>{a.label}</option>)}
          </select>
        </div>

        <div style={{ gridColumn: '1 / -1' }}>
          <label className="label">Ticket Title / Description</label>
          <input value={form.ticket_title} onChange={e => set('ticket_title', e.target.value)} placeholder="Brief description of the work done" required />
        </div>

        <div>
          <label className="label">Actual Hours</label>
          <input
            type="number" step="0.25" min="0.25" max="24"
            value={form.actual_hours}
            onChange={e => set('actual_hours', e.target.value)}
            placeholder="0.00"
            required
          />
        </div>

        <div style={{ gridColumn: '1 / -1' }}>
          <label className="label">Notes</label>
          <textarea rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Optional" />
        </div>

        {error && (
          <p style={{ gridColumn: '1 / -1', color: '#b83232', fontSize: 13 }}>{error}</p>
        )}

        <div style={{ gridColumn: '1 / -1' }}>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Saving…' : 'Save Entry'}
          </button>
        </div>
      </form>
    </div>
  );
}
