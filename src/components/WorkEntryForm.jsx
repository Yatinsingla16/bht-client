import { useState, useEffect, useRef } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { ACTIVITY_CONFIG } from '../config/activityTypes';

function todayYMD() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

const blank = {
  project_id:       '',
  date:             todayYMD(),
  jira_ticket_id:   '',
  jira_ticket_text: '',
  work_description: '',
  activity_type:    '',
  multiplier:       1.0,
  actual_hours:     '',
  notes:            '',
};

export default function WorkEntryForm({ onSuccess }) {
  const { user, sessionRole }    = useAuth();
  const [projects, setProjects]  = useState([]);
  const [tickets, setTickets]    = useState([]);
  const [ticketDetail, setTicketDetail] = useState(null);
  const [form, setForm]          = useState(blank);
  const [ticketQuery, setTicketQuery]   = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [error, setError]        = useState('');
  const [loading, setLoading]    = useState(false);
  const [open, setOpen]          = useState(false);
  const dropdownRef              = useRef(null);

  const activeRole = sessionRole || user?.role || '';
  const activities = ACTIVITY_CONFIG[activeRole] || [];

  useEffect(() => {
    api.get('/projects').then(r => setProjects(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!form.project_id) { setTickets([]); clearTicket(); return; }
    api.get(`/jira-tickets?project_id=${form.project_id}`)
      .then(r => setTickets(r.data))
      .catch(() => setTickets([]));
    clearTicket();
  }, [form.project_id]);

  useEffect(() => {
    if (!form.jira_ticket_id) { setTicketDetail(null); return; }
    api.get(`/jira-tickets/${form.jira_ticket_id}`)
      .then(r => setTicketDetail(r.data))
      .catch(() => setTicketDetail(null));
  }, [form.jira_ticket_id]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handle(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target))
        setDropdownOpen(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  function set(field, val) { setForm(f => ({ ...f, [field]: val })); }

  function clearTicket() {
    setForm(f => ({ ...f, jira_ticket_id: '', jira_ticket_text: '' }));
    setTicketQuery('');
    setTicketDetail(null);
  }

  function selectTicket(t) {
    setForm(f => ({ ...f, jira_ticket_id: t.id, jira_ticket_text: `${t.ticket_id} — ${t.title}` }));
    setTicketQuery(`${t.ticket_id} — ${t.title}`);
    setDropdownOpen(false);
  }

  function handleActivityChange(label) {
    const activity = activities.find(a => a.label === label);
    setForm(f => ({ ...f, activity_type: label, multiplier: activity ? activity.multiplier : 1.0 }));
  }

  const filteredTickets = tickets.filter(t =>
    `${t.ticket_id} ${t.title}`.toLowerCase().includes(ticketQuery.toLowerCase())
  );

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/work-entries', {
        project_id:       form.project_id,
        date:             form.date,
        jira_ticket_id:   form.jira_ticket_id || null,
        work_description: form.work_description,
        activity_type:    form.activity_type,
        multiplier:       form.multiplier,
        actual_hours:     form.actual_hours,
        notes:            form.notes,
      });
      setForm(blank);
      setTicketQuery('');
      setTicketDetail(null);
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
    <div className="card" style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 18 }}>Log Work Entry</h3>
        <button className="btn-secondary" onClick={() => setOpen(false)} style={{ padding: '6px 14px' }}>Cancel</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24, alignItems: 'start' }}>
        {/* Left: form */}
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

          {/* Searchable Jira ticket dropdown */}
          <div style={{ gridColumn: '1 / -1' }} ref={dropdownRef}>
            <label className="label">Jira Ticket</label>
            <div style={{ position: 'relative' }}>
              <input
                value={ticketQuery}
                onChange={e => { setTicketQuery(e.target.value); setDropdownOpen(true); }}
                onFocus={() => setDropdownOpen(true)}
                placeholder={form.project_id ? 'Search by ticket ID or title…' : 'Select a project first'}
                disabled={!form.project_id}
                style={{ width: '100%' }}
              />
              {form.jira_ticket_id && (
                <button
                  type="button"
                  onClick={clearTicket}
                  style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 16 }}
                >×</button>
              )}
              {dropdownOpen && form.project_id && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
                  background: 'var(--card)', border: '1px solid var(--border)', borderTop: 'none',
                  borderRadius: '0 0 2px 2px', maxHeight: 200, overflowY: 'auto',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                }}>
                  {filteredTickets.length === 0
                    ? <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--muted)' }}>
                        {tickets.length === 0 ? 'No tickets available for this project' : 'No matches'}
                      </div>
                    : filteredTickets.map(t => (
                      <div
                        key={t.id}
                        onMouseDown={() => selectTicket(t)}
                        style={{
                          padding: '8px 12px', fontSize: 12, cursor: 'pointer',
                          borderBottom: '0.5px solid var(--border)',
                          background: form.jira_ticket_id === t.id ? '#EEF4FB' : 'transparent',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = '#EEF4FB'}
                        onMouseLeave={e => e.currentTarget.style.background = form.jira_ticket_id === t.id ? '#EEF4FB' : 'transparent'}
                      >
                        <code style={{ color: 'var(--navy)', fontWeight: 600, marginRight: 6 }}>{t.ticket_id}</code>
                        <span style={{ color: 'var(--muted)' }}>{t.title}</span>
                      </div>
                    ))
                  }
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="label">Activity Type</label>
            <select value={form.activity_type} onChange={e => handleActivityChange(e.target.value)} required>
              <option value="">Select activity…</option>
              {activities.map(a => <option key={a.label} value={a.label}>{a.label}</option>)}
            </select>
          </div>

          <div>
            <label className="label">Actual Hours</label>
            <input
              type="number" step="0.25" min="0.25" max="24"
              value={form.actual_hours}
              onChange={e => set('actual_hours', e.target.value)}
              placeholder="0.00" required
            />
          </div>

          <div style={{ gridColumn: '1 / -1' }}>
            <label className="label">What did you do?</label>
            <textarea
              rows={3}
              value={form.work_description}
              onChange={e => set('work_description', e.target.value)}
              placeholder="Describe the work you completed on this ticket today…"
            />
          </div>

          <div style={{ gridColumn: '1 / -1' }}>
            <label className="label">Notes</label>
            <textarea rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Optional" />
          </div>

          {error && <p style={{ gridColumn: '1 / -1', color: '#b83232', fontSize: 13 }}>{error}</p>}

          <div style={{ gridColumn: '1 / -1' }}>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Saving…' : 'Save Entry'}
            </button>
          </div>
        </form>

        {/* Right: Jira info panel */}
        <div style={{
          background: ticketDetail ? '#EEF4FB' : 'var(--bg)',
          border: `1px solid ${ticketDetail ? '#85B7EB' : 'var(--border)'}`,
          borderRadius: 2,
          padding: 16,
          minHeight: 180,
        }}>
          {ticketDetail ? (
            <>
              <div style={{ fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color: '#185FA5', marginBottom: 10 }}>
                Jira Ticket
              </div>
              <div style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 700, color: 'var(--navy)', marginBottom: 4 }}>
                {ticketDetail.ticket_id}
              </div>
              <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--navy)', marginBottom: 8 }}>
                {ticketDetail.title}
              </div>
              <div style={{ fontSize: 10, color: '#185FA5', marginBottom: 10 }}>
                {ticketDetail.project_name}
              </div>
              {ticketDetail.description && (
                <div style={{
                  fontSize: 11, color: '#555', lineHeight: 1.6,
                  maxHeight: 140, overflowY: 'auto',
                  paddingTop: 8, borderTop: '1px solid #85B7EB',
                }}>
                  {ticketDetail.description}
                </div>
              )}
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 140, textAlign: 'center' }}>
              <div style={{ fontSize: 22, marginBottom: 8, opacity: 0.3 }}>🎫</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
                Select a Jira ticket to<br />see its details here
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
