import { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../api/client';
import EntryDetailModal from './EntryDetailModal';
import {
  MONTHS, ROLE_LABELS, ROLE_COLORS,
  formatDate, pct,
  getLastNWeeks, toYMD, formatWeekLabel,
} from './reportUtils';

const WEEKS = getLastNWeeks(8);

export default function WeeklyReport() {
  const [projects, setProjects]           = useState([]);
  const [filters, setFilters]             = useState({
    project_id: '',
    week_start: toYMD(WEEKS[0].start),
  });
  const [entries, setEntries]             = useState([]);
  const [jiraState, setJiraState]         = useState({});
  const [loading, setLoading]             = useState(false);
  const [fetched, setFetched]             = useState(false);
  const [saving, setSaving]               = useState(false);
  const [toast, setToast]                 = useState(null);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [hoveredRow, setHoveredRow]       = useState(null);
  const [billedHoursState, setBilledHoursState] = useState({});

  useEffect(() => {
    api.get('/projects').then(r => setProjects(r.data)).catch(() => {});
  }, []);

  function set(field, val) { setFilters(f => ({ ...f, [field]: val })); }

  const fetchReport = useCallback(async (flt) => {
    setLoading(true);
    setFetched(true);
    try {
      const params = new URLSearchParams({
        week_start: flt.week_start,
        ...(flt.project_id && { project_id: flt.project_id }),
      });
      const { data } = await api.get(`/reports/weekly?${params}`);
      setEntries(data);
      const init = {};
      data.forEach(e => { init[e.id] = Boolean(e.jira_logged); });
      setJiraState(init);
      const initBilled = {};
      data.forEach(e => {
        initBilled[e.id] = (e.billed_hours !== null && e.billed_hours !== undefined)
          ? String(parseFloat(e.billed_hours))
          : '';
      });
      setBilledHoursState(initBilled);
    } catch {
      setEntries([]);
      setJiraState({});
    } finally {
      setLoading(false);
    }
  }, []);

  function toggleJira(id) {
    setJiraState(s => ({ ...s, [id]: !s[id] }));
  }

  async function handleSave() {
    const jiraChanged = entries
      .filter(e => jiraState[e.id] !== Boolean(e.jira_logged))
      .map(e => ({ id: e.id, jira_logged: jiraState[e.id] }));

    const billedChanged = entries
      .filter(e => {
        const raw = billedHoursState[e.id] ?? '';
        const newVal = raw === '' ? null : parseFloat(raw);
        const origVal = (e.billed_hours !== null && e.billed_hours !== undefined)
          ? parseFloat(e.billed_hours) : null;
        if (newVal === null && origVal === null) return false;
        if (newVal === null || origVal === null) return true;
        return Math.abs(newVal - origVal) > 0.001;
      })
      .map(e => ({
        id: e.id,
        billed_hours: (billedHoursState[e.id] ?? '') === '' ? null : parseFloat(billedHoursState[e.id]),
      }));

    if (jiraChanged.length === 0 && billedChanged.length === 0) return;

    setSaving(true);
    try {
      const calls = [];
      if (jiraChanged.length > 0)
        calls.push(api.patch('/reports/weekly/jira-flag', { updates: jiraChanged }));
      if (billedChanged.length > 0)
        calls.push(api.patch('/reports/weekly/billed-hours', { updates: billedChanged }));
      await Promise.all(calls);
      showToast('Changes saved successfully');
      await fetchReport(filters);
    } catch {
      showToast('Save failed — please try again');
      await fetchReport(filters);
    } finally {
      setSaving(false);
    }
  }

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  const grouped = useMemo(() => {
    const map = {};
    for (const e of entries) {
      if (!map[e.user_id])
        map[e.user_id] = { name: e.user_name, role: e.user_role, entries: [] };
      map[e.user_id].entries.push(e);
    }
    return map;
  }, [entries]);

  const totalActual   = entries.reduce((s, e) => s + parseFloat(e.actual_hours),  0);
  const totalBillable = entries.reduce((s, e) => s + parseFloat(e.billable_hours), 0);
  const totalExtra    = totalBillable - totalActual;
  const billedEntriesAll = entries.filter(e => e.billed_hours !== null && e.billed_hours !== undefined);
  const totalBilled = billedEntriesAll.length > 0
    ? billedEntriesAll.reduce((s, e) => s + parseFloat(e.billed_hours), 0)
    : null;

  const selectedWeek    = WEEKS.find(w => toYMD(w.start) === filters.week_start) || WEEKS[0];
  const weekLabel       = formatWeekLabel(selectedWeek.start, selectedWeek.end);
  const selectedProject = filters.project_id ? projects.find(p => p.id == filters.project_id) : null;

  return (
    <div>
      {/* Filter bar */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 10, marginBottom: 20, alignItems: 'end' }}>
        <div>
          <label className="label">Project</label>
          <select value={filters.project_id} onChange={e => set('project_id', e.target.value)} style={{ width: '100%', borderColor: 'var(--green)' }}>
            <option value="">All Projects</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Week</label>
          <select value={filters.week_start} onChange={e => set('week_start', e.target.value)} style={{ width: '100%', borderColor: 'var(--green)' }}>
            {WEEKS.map(w => (
              <option key={toYMD(w.start)} value={toYMD(w.start)}>
                {formatWeekLabel(w.start, w.end)}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={() => fetchReport(filters)}
          disabled={loading}
          style={{
            padding: '9px 20px', background: 'var(--navy)', color: '#fff', border: 'none',
            fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 500,
            letterSpacing: 1, textTransform: 'uppercase', borderRadius: 2,
            cursor: loading ? 'default' : 'pointer', whiteSpace: 'nowrap',
          }}
        >
          {loading ? 'Loading…' : 'Generate →'}
        </button>
      </div>

      {fetched && !loading && (
        entries.length === 0
          ? <p style={{ color: 'var(--muted)', fontSize: 13, padding: '24px 0' }}>No entries found for this week.</p>
          : (
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 2, overflow: 'hidden' }}>

              {/* Report header */}
              <div style={{ background: 'var(--navy)', padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '2px solid var(--green)' }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-heading)', fontSize: 18, color: '#fff' }}>
                    {selectedProject ? selectedProject.name : 'All Projects'}
                  </div>
                  <div style={{ fontSize: 10, color: '#8aa5bc', letterSpacing: 1, textTransform: 'uppercase', marginTop: 2 }}>
                    {weekLabel} · Weekly Report
                  </div>
                </div>
                <div style={{ fontSize: 10, color: '#8aa5bc', fontStyle: 'italic' }}>
                  Click View to see details · check boxes to log Jira
                </div>
              </div>

              {/* Summary cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10, padding: '16px 18px', borderBottom: '1px solid var(--border)' }}>
                <SummaryCard type="blue" label="Total Entries"  value={entries.length}                                      sub={`${Object.keys(grouped).length} member(s)`} />
                <SummaryCard type="def"  label="Actual Hours"   value={totalActual.toFixed(2)}                              sub="hrs logged" />
                <SummaryCard type="grn"  label="Billable Hours" value={totalBillable.toFixed(2)}                            sub="hrs to invoice" />
                <SummaryCard type="amb"  label="Billed Hours"   value={totalBilled !== null ? totalBilled.toFixed(2) : '—'} sub="hrs invoiced" />
                <SummaryCard type="amb"  label="Extra Hours"    value={`+${totalExtra.toFixed(2)}`}                         sub="multiplier gain" />
              </div>

              {/* Person groups */}
              <div style={{ padding: '0 18px 80px' }}>
                {Object.entries(grouped).map(([userId, person]) => {
                  const personActual   = person.entries.reduce((s, e) => s + parseFloat(e.actual_hours),   0);
                  const personBillable = person.entries.reduce((s, e) => s + parseFloat(e.billable_hours), 0);
                  const billedEntries = person.entries.filter(e => e.billed_hours !== null && e.billed_hours !== undefined);
                  const personBilled = billedEntries.length > 0
                    ? billedEntries.reduce((s, e) => s + parseFloat(e.billed_hours), 0)
                    : null;
                  const rc = ROLE_COLORS[person.role] || { bg: '#eee', color: '#333' };

                  return (
                    <div key={userId} style={{ marginTop: 16, border: '1px solid var(--border)', borderRadius: 2, overflow: 'hidden' }}>
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
                          <col style={{ width: 88 }} />
                          <col />
                          <col style={{ width: 162 }} />
                          <col style={{ width: 66 }} />
                          <col style={{ width: 72 }} />
                          <col style={{ width: 80 }} />
                          <col style={{ width: 52 }} />
                          <col style={{ width: 56 }} />
                          <col style={{ width: 86 }} />
                        </colgroup>
                        <thead>
                          <tr>
                            <Th>Date</Th>
                            <Th>Jira Ticket</Th>
                            <Th>Jira Title</Th>
                            <Th>Activity</Th>
                            <Th center>Actual</Th>
                            <Th center green>Billable</Th>
                            <Th center amber>Billed</Th>
                            <Th center green>+%</Th>
                            <Th></Th>
                            <Th center>Jira Logged</Th>
                          </tr>
                        </thead>
                        <tbody>
                          {person.entries.map(e => {
                            const checked = Boolean(jiraState[e.id]);
                            return (
                              <tr
                                key={e.id}
                                onMouseEnter={() => setHoveredRow(e.id)}
                                onMouseLeave={() => setHoveredRow(null)}
                                style={{
                                  background: checked
                                    ? '#EAF3DE'
                                    : hoveredRow === e.id ? 'var(--hover-row)' : 'transparent',
                                  transition: 'background 0.1s',
                                }}
                              >
                                <td style={tdStyle}><span style={{ fontSize: 10, color: 'var(--muted)' }}>{formatDate(e.date)}</span></td>
                                <td style={tdStyle}><code style={{ fontSize: 9, color: 'var(--muted)' }}>{e.jira_ticket_code || e.ticket_id || '—'}</code></td>
                                <td style={{ ...tdStyle, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.jira_title || '—'}</td>
                                <td style={{ ...tdStyle, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.activity_type || '—'}</td>
                                <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 500 }}>{parseFloat(e.actual_hours).toFixed(2)}</td>
                                <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 600, color: 'var(--green)', fontFamily: 'var(--font-heading)', fontSize: 12 }}>{parseFloat(e.billable_hours).toFixed(2)}</td>
                                <td style={{ ...tdStyle, textAlign: 'center' }}>
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    value={billedHoursState[e.id] ?? ''}
                                    placeholder="—"
                                    onChange={ev => setBilledHoursState(s => ({ ...s, [e.id]: ev.target.value }))}
                                    style={{
                                      width: 70, border: '1px solid #E0DDD4', borderRadius: 2,
                                      background: '#FDFBF7', textAlign: 'center',
                                      fontFamily: 'var(--font-body)', fontSize: 11, padding: '3px 4px',
                                      outline: 'none',
                                    }}
                                    onFocus={ev => { ev.target.style.borderColor = '#2A6B52'; }}
                                    onBlur={ev => { ev.target.style.borderColor = '#E0DDD4'; }}
                                  />
                                </td>
                                <td style={tdStyle}>
                                  <span style={{ background: '#EAF3DE', color: '#3B6D11', fontSize: 9, fontWeight: 500, padding: '1px 5px', borderRadius: 8 }}>{pct(e.multiplier)}</span>
                                </td>
                                <td style={{ ...tdStyle, textAlign: 'center' }}>
                                  <button
                                    onClick={() => setSelectedEntry(e)}
                                    style={{ background: 'transparent', border: '1px solid var(--navy)', color: 'var(--navy)', fontSize: 9, padding: '2px 8px', cursor: 'pointer', borderRadius: 2, letterSpacing: 0.5, fontFamily: 'var(--font-body)' }}
                                  >
                                    View
                                  </button>
                                </td>
                                <td style={{ ...tdStyle, textAlign: 'center' }}>
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleJira(e.id)}
                                    style={{ accentColor: 'var(--green)', width: 14, height: 14, cursor: 'pointer' }}
                                  />
                                </td>
                              </tr>
                            );
                          })}
                          {/* Subtotal row */}
                          <tr style={{ background: '#F5F2EB', borderTop: '1px solid #E0DDD4' }}>
                            <td colSpan={4} style={{ ...tdStyle, textAlign: 'right', color: 'var(--muted)', fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', fontWeight: 600 }}>
                              {person.name} subtotal
                            </td>
                            <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 600, color: 'var(--navy)' }}>{personActual.toFixed(2)}</td>
                            <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 600, color: 'var(--green)' }}>{personBillable.toFixed(2)}</td>
                            <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 600, color: '#C8902A' }}>
                              {personBilled !== null ? personBilled.toFixed(2) : '—'}
                            </td>
                            <td style={tdStyle} /><td style={tdStyle} /><td style={tdStyle} />
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  );
                })}
              </div>
            </div>
          )
      )}

      {/* Sticky Save button — only shown when report is generated and has entries */}
      {fetched && !loading && entries.length > 0 && (
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            position: 'fixed', bottom: 24, right: 24, zIndex: 900,
            padding: '12px 24px',
            background: saving ? '#2A6B52' : 'var(--navy)',
            color: '#fff', border: 'none', borderRadius: 2,
            fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 500,
            letterSpacing: 1, textTransform: 'uppercase',
            cursor: saving ? 'default' : 'pointer',
            boxShadow: '0 4px 16px rgba(26,47,69,0.3)',
            transition: 'background 0.2s',
          }}
          onMouseEnter={e => { if (!saving) e.currentTarget.style.background = '#2A6B52'; }}
          onMouseLeave={e => { if (!saving) e.currentTarget.style.background = 'var(--navy)'; }}
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 80, right: 24, zIndex: 1100,
          padding: '12px 20px',
          background: '#2A6B52', color: '#fff', borderRadius: 2,
          fontSize: 13, fontWeight: 500,
          boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
        }}>
          {toast}
        </div>
      )}

      {selectedEntry && (
        <EntryDetailModal
          entry={selectedEntry}
          jiraLogged={jiraState[selectedEntry.id]}
          onClose={() => setSelectedEntry(null)}
        />
      )}
    </div>
  );
}

/* ── Sub-components ── */

const tdStyle = {
  padding: '6px 8px', borderBottom: '0.5px solid var(--border)',
  verticalAlign: 'middle', color: 'var(--navy)',
};

function Th({ children, center, green, amber }) {
  return (
    <th style={{
      padding: '5px 8px', textAlign: center ? 'center' : 'left',
      fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase',
      color: green ? 'var(--green)' : amber ? '#C8902A' : 'var(--muted)',
      borderBottom: '0.5px solid var(--border)', whiteSpace: 'nowrap',
      background: 'var(--card)',
    }}>
      {children}
    </th>
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
