import { useState, useEffect, useRef } from 'react';
import api from '../api/client';

const blankForm = { ticket_id: '', title: '', description: '', project_id: '' };

export default function JiraTicketsAdmin() {
  const [projects, setProjects]     = useState([]);
  const [tickets, setTickets]       = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterProject, setFilterProject] = useState('');

  // Add-single form
  const [form, setForm]             = useState(blankForm);
  const [addError, setAddError]     = useState('');
  const [addLoading, setAddLoading] = useState(false);

  // Edit modal
  const [editTicket, setEditTicket] = useState(null);
  const [editForm, setEditForm]     = useState({ title: '', description: '', project_id: '' });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError]   = useState('');

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // CSV upload
  const [csvFile, setCsvFile]       = useState(null);
  const [csvDragging, setCsvDragging] = useState(false);
  const [csvUploading, setCsvUploading] = useState(false);
  const [csvResult, setCsvResult]   = useState(null);
  const fileInputRef                = useRef(null);

  // Toast
  const [toast, setToast]           = useState(null);

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

  // ── Add single ticket ──
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

  // ── Edit ──
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

  // ── Delete ──
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

  // ── CSV drag/drop ──
  function handleDragOver(e) { e.preventDefault(); setCsvDragging(true); }
  function handleDragLeave()  { setCsvDragging(false); }
  function handleDrop(e) {
    e.preventDefault();
    setCsvDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.name.toLowerCase().endsWith('.csv')) {
      setCsvFile(file);
      setCsvResult(null);
    }
  }
  function handleFileChange(e) {
    const file = e.target.files[0];
    if (file) { setCsvFile(file); setCsvResult(null); }
  }

  // ── CSV upload ──
  async function handleUpload() {
    if (!csvFile) return;
    setCsvUploading(true);
    setCsvResult(null);
    const formData = new FormData();
    formData.append('file', csvFile);
    try {
      const { data } = await api.post('/jira-tickets/upload-csv', formData);
      setCsvResult(data);
      if (data.inserted > 0) fetchTickets();
      setCsvFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      setCsvResult({ uploadError: err.response?.data?.error || 'Upload failed' });
    } finally {
      setCsvUploading(false);
    }
  }

  // ── Template download ──
  async function handleDownloadTemplate() {
    try {
      const { data } = await api.get('/jira-tickets/template', { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([data], { type: 'text/csv' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'jira_tickets_template.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch { /* silent */ }
  }

  // ── Filtered tickets ──
  const filteredTickets = tickets.filter(t => {
    const q = searchQuery.toLowerCase();
    const matchSearch = !q || t.ticket_id.toLowerCase().includes(q) || t.title.toLowerCase().includes(q);
    const matchProject = !filterProject || String(t.project_id) === filterProject;
    return matchSearch && matchProject;
  });

  const dropZoneStyle = {
    border: csvDragging ? '2px dashed #2A6B52' : csvFile ? '2px solid #2A6B52' : '2px dashed #E0DDD4',
    background: csvFile ? '#EAF3DE' : '#FDFBF7',
    borderRadius: 4,
    padding: '28px 20px',
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'all 0.15s',
    minHeight: 120,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── 1. Project Reference Table ── */}
      <div className="card" style={{ background: '#FDFBF7', border: '1px solid #E0DDD4' }}>
        <div style={{ fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 12 }}>
          Project Reference — use these Project IDs in your CSV
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              {['Project ID', 'Project Name'].map(h => (
                <th key={h} style={{ padding: '7px 12px', textAlign: 'left', background: 'var(--navy)', color: '#fff', fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', borderBottom: '2px solid var(--green)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {projects.map((p, i) => (
              <tr key={p.id} style={{ background: i % 2 === 0 ? '#FDFBF7' : '#F5F2EB' }}>
                <td style={{ padding: '6px 12px', fontFamily: 'monospace', fontWeight: 700, color: 'var(--navy)', borderBottom: '0.5px solid #E0DDD4' }}>{p.id}</td>
                <td style={{ padding: '6px 12px', borderBottom: '0.5px solid #E0DDD4' }}>{p.name}</td>
              </tr>
            ))}
            {projects.length === 0 && (
              <tr><td colSpan={2} style={{ padding: '12px', color: 'var(--muted)', fontSize: 12, textAlign: 'center' }}>No active projects</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── 2. CSV Upload ── */}
      <div className="card" style={{ background: '#FDFBF7', border: '1px solid #E0DDD4' }}>
        <div style={{ fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 16 }}>
          Bulk Upload via CSV
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, alignItems: 'start' }}>

          {/* Left: drop zone + upload button + result */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div
              style={dropZoneStyle}
              onDragOver={csvUploading ? undefined : handleDragOver}
              onDragLeave={csvUploading ? undefined : handleDragLeave}
              onDrop={csvUploading ? undefined : handleDrop}
              onClick={() => !csvUploading && fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
              {csvFile ? (
                <>
                  <div style={{ fontSize: 22 }}>📄</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy)' }}>{csvFile.name}</div>
                  <div style={{ fontSize: 11, color: '#2A6B52' }}>File ready to upload</div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 22, opacity: 0.4 }}>📂</div>
                  <div style={{ fontSize: 13, color: 'var(--muted)' }}>Drag & drop a CSV file here</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', opacity: 0.7 }}>or click to browse</div>
                </>
              )}
            </div>

            {csvFile && (
              <button
                onClick={handleUpload}
                disabled={csvUploading}
                style={{
                  padding: '10px 20px', background: csvUploading ? '#3a5a70' : 'var(--navy)',
                  color: '#fff', border: 'none', borderRadius: 2,
                  fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 500,
                  letterSpacing: 1, textTransform: 'uppercase', cursor: csvUploading ? 'default' : 'pointer',
                }}
              >
                {csvUploading ? 'Uploading…' : 'Upload CSV'}
              </button>
            )}

            {/* Upload result card */}
            {csvResult && !csvResult.uploadError && (
              <div style={{
                border: `1px solid ${csvResult.errors > 0 ? '#E24B4A' : csvResult.skipped > 0 ? '#EF9F27' : '#97C459'}`,
                background: csvResult.errors > 0 ? '#FDECEA' : csvResult.skipped > 0 ? '#FFF3CD' : '#EAF3DE',
                borderRadius: 2, padding: 14,
              }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--navy)' }}>
                  {csvResult.errors > 0
                    ? `❌ ${csvResult.errors} row${csvResult.errors !== 1 ? 's' : ''} had errors`
                    : csvResult.skipped > 0
                      ? `⚠ ${csvResult.inserted} inserted, ${csvResult.skipped} skipped`
                      : `✅ ${csvResult.inserted} ticket${csvResult.inserted !== 1 ? 's' : ''} imported successfully`
                  }
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', fontSize: 11, color: 'var(--navy)', marginBottom: csvResult.skipped_tickets?.length || csvResult.error_rows?.length ? 10 : 0 }}>
                  <span>Total rows: <strong>{csvResult.total_rows}</strong></span>
                  <span>Inserted: <strong>{csvResult.inserted}</strong></span>
                  <span>Skipped (duplicates): <strong>{csvResult.skipped}</strong></span>
                  <span>Errors: <strong>{csvResult.errors}</strong></span>
                </div>
                {csvResult.skipped_tickets?.length > 0 && (
                  <div style={{ fontSize: 11, marginTop: 8 }}>
                    <div style={{ fontWeight: 500, marginBottom: 4 }}>Skipped ticket IDs:</div>
                    <div style={{ fontFamily: 'monospace', color: '#854F0B' }}>{csvResult.skipped_tickets.join(', ')}</div>
                  </div>
                )}
                {csvResult.error_rows?.length > 0 && (
                  <div style={{ fontSize: 11, marginTop: 8 }}>
                    <div style={{ fontWeight: 500, marginBottom: 4 }}>Error details:</div>
                    {csvResult.error_rows.map((er, i) => (
                      <div key={i} style={{ color: '#b83232' }}>Row {er.row}: {er.reason}</div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {csvResult?.uploadError && (
              <div style={{ background: '#FDECEA', border: '1px solid #E24B4A', borderRadius: 2, padding: 12, fontSize: 13, color: '#b83232' }}>
                ❌ {csvResult.uploadError}
              </div>
            )}
          </div>

          {/* Right: instructions card */}
          <div style={{ background: '#F5F2EB', border: '1px solid #E0DDD4', borderRadius: 2, padding: 16 }}>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 14, color: 'var(--navy)', marginBottom: 12 }}>CSV Format Guide</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 10 }}>
              Your CSV must have exactly these 4 column headers:
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
              {[
                ['Issue Key', 'Jira ticket ID (e.g. CRM-142)'],
                ['Title', 'Ticket title'],
                ['Description', 'Ticket description (optional)'],
                ['Project ID', 'From project reference table above'],
              ].map(([col, desc]) => (
                <div key={col} style={{ fontSize: 11 }}>
                  <code style={{ fontWeight: 700, color: 'var(--navy)', marginRight: 6 }}>{col}</code>
                  <span style={{ color: 'var(--muted)' }}>→ {desc}</span>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 14 }}>
              Duplicate Issue Keys will be skipped automatically.<br />
              Rows with invalid Project IDs will be reported as errors.
            </div>
            <button
              onClick={handleDownloadTemplate}
              style={{
                width: '100%', padding: '8px 14px',
                background: 'transparent', border: '1px solid #2A6B52',
                color: '#2A6B52', borderRadius: 2,
                fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 500,
                letterSpacing: 0.5, cursor: 'pointer', transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#2A6B52'; e.currentTarget.style.color = '#fff'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#2A6B52'; }}
            >
              ⬇ Download CSV Template
            </button>
          </div>
        </div>
      </div>

      {/* ── 3. Add Single Ticket Form ── */}
      <div className="card" style={{ background: '#FDFBF7', border: '1px solid #E0DDD4' }}>
        <div style={{ fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 16 }}>
          Add New Ticket
        </div>
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

      {/* ── 4. Existing Tickets Table ── */}
      <div className="card" style={{ background: '#FDFBF7', border: '1px solid #E0DDD4' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--muted)' }}>
            Jira Tickets &mdash; <span style={{ color: 'var(--navy)', fontWeight: 600 }}>{filteredTickets.length}</span> showing
          </div>
        </div>

        {/* Search + filter bar */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: 10, marginBottom: 14 }}>
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by ticket ID or title…"
            style={{ width: '100%' }}
          />
          <select value={filterProject} onChange={e => setFilterProject(e.target.value)} style={{ width: '100%' }}>
            <option value="">All Projects</option>
            {projects.map(p => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
          </select>
        </div>

        {filteredTickets.length === 0
          ? <p style={{ color: 'var(--muted)', fontSize: 13 }}>{tickets.length === 0 ? 'No tickets yet.' : 'No tickets match your search.'}</p>
          : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr>
                    {['Ticket ID', 'Project', 'Title', 'Description', 'Linked', ''].map((h, i) => (
                      <th key={i} style={{ padding: '6px 10px', textAlign: 'left', fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--muted)', borderBottom: '1px solid #E0DDD4', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredTickets.map(t => (
                    <tr key={t.id} style={{ borderBottom: '0.5px solid #E0DDD4' }}>
                      <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontWeight: 600, color: 'var(--navy)', whiteSpace: 'nowrap' }}>{t.ticket_id}</td>
                      <td style={{ padding: '8px 10px', color: 'var(--muted)', whiteSpace: 'nowrap' }}>{t.project_name}</td>
                      <td style={{ padding: '8px 10px', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</td>
                      <td style={{ padding: '8px 10px', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--muted)' }}>
                        {t.description ? (t.description.length > 60 ? t.description.slice(0, 60) + '…' : t.description) : '—'}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'center', color: 'var(--muted)' }}>{t.linked_entries}</td>
                      <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
                        <button onClick={() => openEdit(t)} style={{ background: 'transparent', border: '1px solid #E0DDD4', color: 'var(--navy)', fontSize: 10, padding: '3px 10px', cursor: 'pointer', borderRadius: 2, marginRight: 6 }}>Edit</button>
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

      {/* ── Edit modal ── */}
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

      {/* ── Delete confirmation ── */}
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

      {/* ── Toast ── */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 1100, padding: '12px 20px', background: '#2A6B52', color: '#fff', borderRadius: 2, fontSize: 13, fontWeight: 500, boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}>
          {toast}
        </div>
      )}
    </div>
  );
}
