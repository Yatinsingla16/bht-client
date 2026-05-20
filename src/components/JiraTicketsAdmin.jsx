import { useState, useEffect } from 'react';
import api from '../api/client';

const blankForm = { ticket_id: '', title: '', description: '', project_id: '' };

export default function JiraTicketsAdmin() {
  const [projects, setProjects]   = useState([]);
  const [tickets, setTickets]     = useState([]);
  const [form, setForm]           = useState(blankForm);
  const [addError, setAddError]   = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [toast, setToast]         = useState(null);
  const [editTicket, setEditTicket] = useState(null);
  const [editForm, setEditForm]   = useState({ title: '', description: '', project_id: '' });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    api.get('/projects').then(r => setProjects(r.data)).catch(() => {});
    fetchTickets();
  }, []);

  async function fetchTickets() {
    try {
      const { data } = await api.get('/jira-tickets');
      setTickets(data);
    } catch { setTickets([]); }
  }

  function setF(field, val) { setForm(f => ({ ...f, [field]: val })); }

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function handleAdd(e) {
    e.preventDefault();
    setAddError('');
    setAddLoading(true);
    try {
      await api.post('/jira-tickets', {
        ticket_id:   form.ticket_id.trim(),
        title:       form.title.trim(),
        description: form.description.trim() || null,
        project_id:  parseInt(form.project_id),
      });
      setForm(blankForm);
      showToast('Ticket added successfully');
      fetchTickets();
    } catch (err) {
      setAddError(err.response?.data?.error || 'Failed to add ticket');
    } finally {
      setAddLoading(false);
    }
  }

  function openEdit(t) {
    setEditTicket(t);
    setEditForm({ title: t.title, description: t.description || '', project_id: t.project_id });
    setEditError('');
  }

  async function handleEdit(e) {
    e.preventDefault();
    setEditError('');
    setEditLoading(true);
    try {
      await api.put(`/jira-tickets/${editTicket.id}`, {
        title:       editForm.title.trim(),
        description: editForm.description.trim() || null,
        project_id:  parseInt(editForm.project_id),
      });
      setEditTicket(null);
      showToast('Ticket updated successfully');
      fetchTickets();
    } catch (err) {
      setEditError(err.response?.data?.error || 'Failed to update ticket');
    } finally {
      setEditLoading(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await api.delete(`/jira-tickets/${deleteTarget.id}`);
      setDeleteTarget(null);
      showToast('Ticket deleted');
      fetchTickets();
    } catch {
      setDeleteTarget(null);
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <div>
      {/* Add form */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 18, marginBottom: 16 }}>Add New Ticket</h3>
        <form onSubmit={handleAdd} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <label className="label">Project</label>
            <select value={form.project_id} onChange={e => setF('project_id', e.target.value)} required style={{ width: '100%', borderColor: 'var(--green)' }}>
              <option value="">Select project…</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Ticket ID</label>
            <input value={form.ticket_id} onChange={e => setF('ticket_id', e.target.value)} placeholder="e.g. CRM-142" required style={{ width: '100%' }} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label className="label">Title</label>
            <input value={form.title} onChange={e => setF('title', e.target.value)} placeholder="e.g. Implement intake form" required style={{ width: '100%' }} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label className="label">Description</label>
            <textarea rows={3} value={form.description} onChange={e => setF('description', e.target.value)} placeholder="Full description (optional)" style={{ width: '100%' }} />
          </div>
          {addError && <p style={{ gridColumn: '1 / -1', color: '#b83232', fontSize: 13, margin: 0 }}>{addError}</p>}
          <div style={{ gridColumn: '1 / -1' }}>
            <button type="submit" className="btn-primary" disabled={addLoading}>
              {addLoading ? 'Adding…' : 'Add Ticket'}
            </button>
          </div>
        </form>
      </div>

      {/* Tickets table */}
      <div className="card">
        <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 18, marginBottom: 16 }}>
          Jira Tickets ({tickets.length})
        </h3>
        {tickets.length === 0
          ? <p style={{ color: 'var(--muted)', fontSize: 13 }}>No tickets yet.</p>
          : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr>
                    {['Ticket ID','Project','Title','Description','Linked',''].map(h => (
                      <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--muted)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tickets.map(t => (
                    <tr key={t.id} style={{ borderBottom: '0.5px solid var(--border)' }}>
                      <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontWeight: 600, color: 'var(--navy)', whiteSpace: 'nowrap' }}>{t.ticket_id}</td>
                      <td style={{ padding: '8px 10px', color: 'var(--muted)', whiteSpace: 'nowrap' }}>{t.project_name}</td>
                      <td style={{ padding: '8px 10px', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</td>
                      <td style={{ padding: '8px 10px', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--muted)' }}>
                        {t.description ? (t.description.length > 60 ? t.description.slice(0, 60) + '…' : t.description) : '—'}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'center', color: 'var(--muted)' }}>{t.linked_entries}</td>
                      <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
                        <button onClick={() => openEdit(t)} style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--navy)', fontSize: 10, padding: '3px 10px', cursor: 'pointer', borderRadius: 2, marginRight: 6 }}>Edit</button>
                        <button onClick={() => setDeleteTarget(t)} style={{ background: 'transparent', border: '1px solid #e0a0a0', color: '#b83232', fontSize: 10, padding: '3px 10px', cursor: 'pointer', borderRadius: 2 }}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
      </div>

      {/* Edit modal */}
      {editTicket && (
        <div onClick={() => setEditTicket(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(26,47,69,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 2, width: '100%', maxWidth: 480, overflow: 'hidden', boxShadow: '0 8px 32px rgba(26,47,69,0.22)' }}>
            <div style={{ background: 'var(--navy)', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '2px solid var(--green)' }}>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: 16, color: '#fff' }}>Edit Ticket</div>
              <button onClick={() => setEditTicket(null)} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.25)', color: 'rgba(255,255,255,0.7)', fontSize: 18, lineHeight: 1, padding: '1px 8px 3px', cursor: 'pointer', borderRadius: 2 }}>×</button>
            </div>
            <div style={{ padding: 18 }}>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 4 }}>Ticket ID (read only)</div>
                <div style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 600, color: 'var(--navy)' }}>{editTicket.ticket_id}</div>
              </div>
              <form onSubmit={handleEdit} style={{ display: 'grid', gap: 14 }}>
                <div>
                  <label className="label">Project</label>
                  <select value={editForm.project_id} onChange={e => setEditForm(f => ({ ...f, project_id: e.target.value }))} required style={{ width: '100%', borderColor: 'var(--green)' }}>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Title</label>
                  <input value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} required style={{ width: '100%' }} />
                </div>
                <div>
                  <label className="label">Description</label>
                  <textarea rows={4} value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} style={{ width: '100%' }} />
                </div>
                {editError && <p style={{ color: '#b83232', fontSize: 13, margin: 0 }}>{editError}</p>}
                <div style={{ display: 'flex', gap: 10 }}>
                  <button type="submit" className="btn-primary" disabled={editLoading}>{editLoading ? 'Saving…' : 'Save Changes'}</button>
                  <button type="button" className="btn-secondary" onClick={() => setEditTicket(null)}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <div onClick={() => setDeleteTarget(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(26,47,69,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 2, width: '100%', maxWidth: 400, padding: 24, boxShadow: '0 8px 32px rgba(26,47,69,0.22)' }}>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 18, marginBottom: 12, color: 'var(--navy)' }}>Delete Ticket?</h3>
            <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.65, marginBottom: 20 }}>
              {deleteTarget.linked_entries > 0
                ? `This ticket is linked to ${deleteTarget.linked_entries} work entr${deleteTarget.linked_entries === 1 ? 'y' : 'ies'}. Deleting will remove the link but work entries will be kept.`
                : 'This ticket has no linked work entries.'
              }
              {' '}Are you sure?
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={handleDelete}
                disabled={deleteLoading}
                style={{ padding: '9px 20px', background: '#b83232', color: '#fff', border: 'none', borderRadius: 2, fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 500, letterSpacing: 1, textTransform: 'uppercase', cursor: deleteLoading ? 'default' : 'pointer' }}
              >
                {deleteLoading ? 'Deleting…' : 'Delete'}
              </button>
              <button className="btn-secondary" onClick={() => setDeleteTarget(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 1100, padding: '12px 20px', background: '#2A6B52', color: '#fff', borderRadius: 2, fontSize: 13, fontWeight: 500, boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}>
          {toast}
        </div>
      )}
    </div>
  );
}
