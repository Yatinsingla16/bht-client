import { useState, useEffect, useMemo } from 'react';
import api from '../api/client';

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

function formatDate(dateStr) {
  const [, mm, dd] = String(dateStr).slice(0, 10).split('-');
  return `${parseInt(dd)} ${MONTHS[parseInt(mm) - 1].slice(0, 3)}`;
}

function formatDateFull(dateStr) {
  const [yyyy, mm, dd] = String(dateStr).slice(0, 10).split('-');
  return `${parseInt(dd)} ${MONTHS[parseInt(mm) - 1]} ${yyyy}`;
}

function pct(mult) {
  return `+${Math.round((parseFloat(mult) - 1) * 100)}%`;
}

const ROLE_LABELS = { BA: 'BA', DEV: 'Developer', US: 'US Consultant', PM: 'Project Manager' };
const ROLE_COLORS = {
  BA:  { bg: '#e8f0ec', color: '#2A6B52' },
  DEV: { bg: '#e8ecf5', color: '#1A3A5C' },
  US:  { bg: '#f5ede2', color: '#9A6020' },
  PM:  { bg: '#f0eaf5', color: '#5A2A82' },
};

export default function MonthlyReport() {
  const [projects, setProjects]       = useState([]);
  const [filters, setFilters]         = useState({
    project_id: '',
    month:      new Date().getMonth() + 1,
    year:       new Date().getFullYear(),
  });
  const [entries, setEntries]         = useState([]);
  const [loading, setLoading]         = useState(false);
  const [fetched, setFetched]         = useState(false);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [hoveredRow, setHoveredRow]   = useState(null);

  useEffect(() => {
    api.get('/projects').then(r => setProjects(r.data)).catch(() => {});
  }, []);

  function set(field, val) { setFilters(f => ({ ...f, [field]: val })); }

  async function fetchReport() {
    setLoading(true);
    setFetched(true);
    try {
      const params = new URLSearchParams({
        month: filters.month,
        year:  filters.year,
        ...(filters.project_id && { project_id: filters.project_id }),
      });
      const { data } = await api.get(`/work-entries?${params}`);
      setEntries(data);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }

  const grouped = useMemo(() => {
    const byProject = {};
    for (const e of entries) {
      if (!byProject[e.project_id]) {
        byProject[e.project_id] = { name: e.project_name, byUser: {} };
      }
      const proj = byProject[e.project_id];
      if (!proj.byUser[e.user_id]) {
        proj.byUser[e.user_id] = { name: e.user_name, role: e.user_role, entries: [] };
      }
      proj.byUser[e.user_id].entries.push(e);
    }
    return byProject;
  }, [entries]);

  const totalActual   = entries.reduce((s, e) => s + parseFloat(e.actual_hours),   0);
  const totalBillable = entries.reduce((s, e) => s + parseFloat(e.billable_hours),  0);
  const totalExtra    = totalBillable - totalActual;
  const memberCount   = new Set(entries.map(e => e.user_id)).size;

  const monthLabel      = MONTHS[filters.month - 1];
  const selectedProject = filters.project_id ? projects.find(p => p.id == filters.project_id) : null;

  return (
    <div>
      {/* Filter bar */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 10, marginBottom: 20, alignItems: 'end' }}>
        <div>
          <label className="label">Project</label>
          <select value={filters.project_id} onChange={e => set('project_id', e.target.value)} style={{ width: '100%', borderColor: 'var(--green)' }}>
            <option value="">All Projects</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Month</label>
          <select value={filters.month} onChange={e => set('month', parseInt(e.target.value))} style={{ width: '100%', borderColor: 'var(--green)' }}>
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Year</label>
          <select value={filters.year} onChange={e => set('year', parseInt(e.target.value))} style={{ width: '100%', borderColor: 'var(--green)' }}>
            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <button
          onClick={fetchReport}
          disabled={loading}
          style={{
            padding:       '9px 20px',
            background:    'var(--navy)',
            color:         '#fff',
            border:        'none',
            fontFamily:    'var(--font-body)',
            fontSize:      11,
            fontWeight:    500,
            letterSpacing: 1,
            textTransform: 'uppercase',
            borderRadius:  2,
            cursor:        loading ? 'default' : 'pointer',
            whiteSpace:    'nowrap',
          }}
        >
          {loading ? 'Loading…' : 'Generate →'}
        </button>
      </div>

      {fetched && !loading && (
        entries.length === 0
          ? <p style={{ color: 'var(--muted)', fontSize: 13, padding: '24px 0' }}>No entries found for the selected period.</p>
          : (
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 2, overflow: 'hidden' }}>

              {/* Report header */}
              <div style={{ background: 'var(--navy)', padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '2px solid var(--green)' }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-heading)', fontSize: 18, color: '#fff' }}>
                    {selectedProject ? selectedProject.name : 'All Projects'}
                  </div>
                  <div style={{ fontSize: 10, color: '#8aa5bc', letterSpacing: 1, textTransform: 'uppercase', marginTop: 2 }}>
                    {monthLabel} {filters.year} · Billing Report
                  </div>
                </div>
                <div style={{ fontSize: 10, color: '#8aa5bc', fontStyle: 'italic' }}>
                  Click any row to view full details
                </div>
              </div>

              {/* Summary cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, padding: '16px 18px', borderBottom: '1px solid var(--border)' }}>
                <SummaryCard type="blue" label="Total Entries"  value={entries.length}           sub={`across ${memberCount} member${memberCount !== 1 ? 's' : ''}`} />
                <SummaryCard type="def"  label="Actual Hours"   value={totalActual.toFixed(2)}   sub="hrs logged" />
                <SummaryCard type="grn"  label="Billable Hours" value={totalBillable.toFixed(2)} sub="hrs to invoice" />
                <SummaryCard type="amb"  label="Extra Hours"    value={`+${totalExtra.toFixed(2)}`} sub="multiplier gain" />
              </div>

              {/* Project sections */}
              <div style={{ padding: '0 18px 16px' }}>
                {Object.entries(grouped).map(([projId, proj]) => {
                  const allEntries   = Object.values(proj.byUser).flatMap(u => u.entries);
                  const projActual   = allEntries.reduce((s, e) => s + parseFloat(e.actual_hours),   0);
                  const projBillable = allEntries.reduce((s, e) => s + parseFloat(e.billable_hours), 0);
                  const projExtra    = projBillable - projActual;

                  return (
                    <div key={projId} style={{ marginTop: 16, border: '1px solid var(--border)', borderRadius: 2, overflow: 'hidden' }}>

                      {/* Project head */}
                      <div style={{ background: 'var(--navy)', padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 12, fontWeight: 500, color: '#fff', letterSpacing: 0.3 }}>{proj.name}</span>
                        <span style={{ fontSize: 10, color: '#8aa5bc' }}>{allEntries.length} entries · {monthLabel} {filters.year}</span>
                      </div>

                      {/* Project meta */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 1, background: 'var(--border)', borderBottom: '1px solid var(--border)' }}>
                        <MetaCell label="Actual hrs"   value={projActual.toFixed(2)} />
                        <MetaCell label="Billable hrs" value={projBillable.toFixed(2)} green />
                        <MetaCell label="Extra hrs"    value={`+${projExtra.toFixed(2)}`} />
                      </div>

                      {/* Person groups */}
                      {Object.entries(proj.byUser).map(([userId, person], idx) => {
                        const personActual   = person.entries.reduce((s, e) => s + parseFloat(e.actual_hours),   0);
                        const personBillable = person.entries.reduce((s, e) => s + parseFloat(e.billable_hours), 0);
                        const rc = ROLE_COLORS[person.role] || { bg: '#eee', color: '#333' };

                        return (
                          <div key={userId} style={{ borderTop: idx === 0 ? 'none' : '1px solid var(--border)' }}>

                            {/* Person header */}
                            <div style={{ background: '#F5F2EB', padding: '6px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '0.5px solid var(--border)' }}>
                              <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--navy)', display: 'flex', alignItems: 'center', gap: 7 }}>
                                <span style={{ display: 'inline-block', padding: '1px 6px', borderRadius: 1, fontSize: 9, fontWeight: 500, background: rc.bg, color: rc.color }}>
                                  {ROLE_LABELS[person.role] || person.role}
                                </span>
                                {person.name}
                              </div>
                              <div style={{ fontSize: 10, color: 'var(--muted)' }}>
                                {person.entries.length} entries &nbsp;·&nbsp; {personActual.toFixed(2)} actual &nbsp;·&nbsp;{' '}
                                <strong style={{ color: 'var(--green)' }}>{personBillable.toFixed(2)} billable</strong>
                              </div>
                            </div>

                            {/* Entry table */}
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, tableLayout: 'fixed' }}>
                              <colgroup>
                                <col style={{ width: 68 }} />
                                <col style={{ width: 82 }} />
                                <col />
                                <col style={{ width: 162 }} />
                                <col style={{ width: 66 }} />
                                <col style={{ width: 72 }} />
                                <col style={{ width: 52 }} />
                                <col style={{ width: 56 }} />
                              </colgroup>
                              <thead>
                                <tr>
                                  <Th>Date</Th>
                                  <Th>Ticket</Th>
                                  <Th>Title</Th>
                                  <Th>Activity</Th>
                                  <Th center>Actual</Th>
                                  <Th center green>Billable</Th>
                                  <Th center green>+%</Th>
                                  <Th center>Notes</Th>
                                </tr>
                              </thead>
                              <tbody>
                                {person.entries.map(e => (
                                  <tr
                                    key={e.id}
                                    onClick={() => setSelectedEntry(e)}
                                    onMouseEnter={() => setHoveredRow(e.id)}
                                    onMouseLeave={() => setHoveredRow(null)}
                                    style={{ cursor: 'pointer', background: hoveredRow === e.id ? 'var(--hover-row)' : 'transparent', transition: 'background 0.1s' }}
                                  >
                                    <td style={tdStyle}>
                                      <span style={{ fontSize: 10, color: 'var(--muted)' }}>{formatDate(e.date)}</span>
                                    </td>
                                    <td style={tdStyle}>
                                      <code style={{ fontSize: 9, color: 'var(--muted)' }}>{e.ticket_id || '—'}</code>
                                    </td>
                                    <td style={{ ...tdStyle, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {e.ticket_title || '—'}
                                    </td>
                                    <td style={{ ...tdStyle, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {e.activity_type || '—'}
                                    </td>
                                    <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 500 }}>
                                      {parseFloat(e.actual_hours).toFixed(2)}
                                    </td>
                                    <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 600, color: 'var(--green)', fontFamily: 'var(--font-heading)', fontSize: 12 }}>
                                      {parseFloat(e.billable_hours).toFixed(2)}
                                    </td>
                                    <td style={tdStyle}>
                                      <span style={{ background: '#EAF3DE', color: '#3B6D11', fontSize: 9, fontWeight: 500, padding: '1px 5px', borderRadius: 8 }}>
                                        {pct(e.multiplier)}
                                      </span>
                                    </td>
                                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                                      {e.notes
                                        ? <span title={e.notes} style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: 'var(--amber)' }} />
                                        : <span style={{ color: 'var(--border)', fontSize: 10 }}>—</span>
                                      }
                                    </td>
                                  </tr>
                                ))}
                                <tr style={{ background: '#EAF3DE', borderTop: '1px solid #97C459' }}>
                                  <td colSpan={4} style={{ ...tdStyle, textAlign: 'right', color: 'var(--muted)', fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', fontWeight: 500 }}>
                                    {person.name} subtotal
                                  </td>
                                  <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 600 }}>{personActual.toFixed(2)}</td>
                                  <td style={{ ...tdStyle, textAlign: 'center', color: 'var(--green)', fontFamily: 'var(--font-heading)', fontSize: 13, fontWeight: 500 }}>{personBillable.toFixed(2)}</td>
                                  <td style={tdStyle} />
                                  <td style={tdStyle} />
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          )
      )}

      {selectedEntry && (
        <EntryModal entry={selectedEntry} onClose={() => setSelectedEntry(null)} />
      )}
    </div>
  );
}

function EntryModal({ entry, onClose }) {
  const rc = ROLE_COLORS[entry.user_role] || { bg: '#eee', color: '#333' };

  return (
    <div
      onClick={onClose}
      style={{
        position:       'fixed',
        inset:          0,
        background:     'rgba(26, 47, 69, 0.55)',
        zIndex:         1000,
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        padding:        20,
      }}
    >
      <div
        onClick={ev => ev.stopPropagation()}
        style={{
          background:  'var(--card)',
          border:      '1px solid var(--border)',
          borderRadius: 2,
          width:       '100%',
          maxWidth:    500,
          overflow:    'hidden',
          boxShadow:   '0 8px 32px rgba(26,47,69,0.22)',
        }}
      >
        {/* Modal header */}
        <div style={{ background: 'var(--navy)', padding: '12px 16px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', borderBottom: '2px solid var(--green)' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 16, color: '#fff', marginBottom: 3 }}>
              {entry.ticket_title || 'Work Entry'}
            </div>
            <div style={{ fontSize: 9, color: '#8aa5bc', letterSpacing: 1.5, textTransform: 'uppercase' }}>
              {formatDateFull(entry.date)} · {entry.project_name}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background:  'transparent',
              border:      '1px solid rgba(255,255,255,0.25)',
              color:       'rgba(255,255,255,0.7)',
              fontSize:    18,
              lineHeight:  '1',
              padding:     '1px 8px 3px',
              cursor:      'pointer',
              borderRadius: 2,
              flexShrink:  0,
              marginLeft:  12,
            }}
          >
            ×
          </button>
        </div>

        {/* Modal body */}
        <div style={{ padding: 18 }}>
          {/* Team member */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, paddingBottom: 14, borderBottom: '1px solid var(--border)' }}>
            <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 1, fontSize: 9, fontWeight: 500, background: rc.bg, color: rc.color }}>
              {ROLE_LABELS[entry.user_role] || entry.user_role}
            </span>
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--navy)' }}>{entry.user_name}</span>
          </div>

          {/* Fields grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 24px' }}>
            <ModalField label="Date"         value={formatDateFull(entry.date)} />
            <ModalField label="Ticket ID"    value={entry.ticket_id || '—'} mono />
            <ModalField label="Activity Type" value={entry.activity_type || '—'} span />
            <ModalField label="Actual Hours"   value={`${parseFloat(entry.actual_hours).toFixed(2)} hrs`} />
            <ModalField label="Billable Hours" value={`${parseFloat(entry.billable_hours).toFixed(2)} hrs`} green />
            <ModalField label="Multiplier"     value={pct(entry.multiplier)} pill span={false} />
          </div>

          {/* Notes */}
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
            <div style={{ fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>Notes</div>
            {entry.notes
              ? <p style={{ fontSize: 12, color: 'var(--navy)', lineHeight: 1.65, margin: 0 }}>{entry.notes}</p>
              : <p style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic', margin: 0 }}>No notes recorded.</p>
            }
          </div>
        </div>
      </div>
    </div>
  );
}

function ModalField({ label, value, green, mono, pill, span }) {
  return (
    <div style={span ? { gridColumn: '1 / -1' } : {}}>
      <div style={{ fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 4 }}>{label}</div>
      {pill
        ? <span style={{ background: '#EAF3DE', color: '#3B6D11', fontSize: 11, fontWeight: 500, padding: '2px 10px', borderRadius: 8 }}>{value}</span>
        : <div style={{
            fontSize:    green ? 15 : 12,
            color:       green ? 'var(--green)' : 'var(--navy)',
            fontWeight:  green ? 600 : 400,
            fontFamily:  green ? 'var(--font-heading)' : mono ? 'monospace' : 'inherit',
          }}>{value}</div>
      }
    </div>
  );
}

const tdStyle = {
  padding:       '6px 8px',
  borderBottom:  '0.5px solid var(--border)',
  verticalAlign: 'middle',
  color:         'var(--navy)',
};

function Th({ children, center, green }) {
  return (
    <th style={{
      padding:       '5px 8px',
      textAlign:     center ? 'center' : 'left',
      fontSize:      9,
      letterSpacing: 1.5,
      textTransform: 'uppercase',
      color:         green ? 'var(--green)' : 'var(--muted)',
      borderBottom:  '0.5px solid var(--border)',
      whiteSpace:    'nowrap',
      background:    'var(--card)',
    }}>
      {children}
    </th>
  );
}

function MetaCell({ label, value, green }) {
  return (
    <div style={{ background: 'var(--card)', padding: '8px 12px', textAlign: 'center' }}>
      <div style={{ fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 500, color: green ? 'var(--green)' : 'var(--navy)' }}>{value}</div>
    </div>
  );
}

function SummaryCard({ type, label, value, sub }) {
  const s = {
    blue: { bg: '#EEF4FB', border: '#85B7EB', lc: '#185FA5', vc: '#0C447C', sc: '#185FA5' },
    def:  { bg: 'var(--bg)', border: 'var(--border)', lc: 'var(--muted)', vc: 'var(--navy)', sc: 'var(--muted)' },
    grn:  { bg: '#EAF3DE', border: '#97C459', lc: '#3B6D11', vc: '#27500A', sc: '#3B6D11' },
    amb:  { bg: '#FAEEDA', border: '#EF9F27', lc: '#854F0B', vc: '#633806', sc: '#854F0B' },
  }[type];
  return (
    <div style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 2, padding: '12px 14px', textAlign: 'center' }}>
      <div style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: s.lc, marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-heading)', fontSize: 26, color: s.vc }}>{value}</div>
      <div style={{ fontSize: 10, color: s.sc, marginTop: 2 }}>{sub}</div>
    </div>
  );
}
