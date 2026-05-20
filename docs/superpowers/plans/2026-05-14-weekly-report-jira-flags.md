# Weekly Report Module + Monthly Report Jira Update

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an admin-only Weekly Report tab with per-entry Jira logging checkboxes and a bulk-save flow, and update the Monthly Report to show Jira status read-only with a full-detail modal.

**Architecture:** Three columns added to `work_entries` via ALTER TABLE; two new Express routes handle weekly fetch and bulk CASE WHEN update; shared `EntryDetailModal` and `reportUtils` modules serve both report components; `WeeklyReport` manages checkbox state locally and sends one PATCH on save.

**Tech Stack:** Express 5 · mysql2 parameterised queries · React 19 · React Router 7 · plain inline CSS matching existing `var(--navy)` / `var(--green)` / `var(--card)` theme variables.

---

## File Map

**bht-server**
| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `schema.sql` | Add ALTER TABLE migration block |
| Modify | `src/routes/reports.js` | Add GET /weekly · PATCH /weekly/jira-flag |

**bht-client**
| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/components/reportUtils.js` | Shared constants + formatters for both reports |
| Create | `src/components/EntryDetailModal.jsx` | Shared read-only detail modal with Jira section |
| Create | `src/components/WeeklyReport.jsx` | Weekly report: checkboxes, save button, toast |
| Create | `src/pages/WeeklyReportPage.jsx` | Thin page wrapper |
| Modify | `src/components/MonthlyReport.jsx` | Jira column, count note, swap to EntryDetailModal |
| Modify | `src/components/Navbar.jsx` | Add Weekly Report tab |
| Modify | `src/App.jsx` | Add /weekly-report AdminRoute |

---

## Task 1 — Database Migration

**Files:**
- Modify: `bht-server/schema.sql`

- [ ] **Step 1: Append migration block to schema.sql**

Add at the end of `bht-server/schema.sql`:

```sql
-- Migration: add Jira logging columns to work_entries
ALTER TABLE work_entries
  ADD COLUMN jira_logged    BOOLEAN       DEFAULT FALSE,
  ADD COLUMN jira_logged_at TIMESTAMP     NULL,
  ADD COLUMN jira_logged_by VARCHAR(255)  NULL;
```

- [ ] **Step 2: Run the migration against local MySQL**

```bash
mysql -u root -p billable_hours -e "
  ALTER TABLE work_entries
    ADD COLUMN IF NOT EXISTS jira_logged    BOOLEAN      DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS jira_logged_at TIMESTAMP    NULL,
    ADD COLUMN IF NOT EXISTS jira_logged_by VARCHAR(255) NULL;
"
```

Expected: no error. Verify:

```bash
mysql -u root -p billable_hours -e "DESCRIBE work_entries;" | grep jira
```

Expected output shows three `jira_*` rows.

- [ ] **Step 3: Commit**

```bash
cd /Users/yatinsingla/work/bht-server
git add schema.sql
git commit -m "feat: add jira_logged columns to work_entries"
```

---

## Task 2 — Server: GET /api/reports/weekly

**Files:**
- Modify: `bht-server/src/routes/reports.js`

- [ ] **Step 1: Add the weekly GET route**

Open `bht-server/src/routes/reports.js`. Append before `module.exports = router;`:

```js
// GET /api/reports/weekly?week_start=2026-05-11&project_id=1
router.get('/weekly', authenticate, requireAdmin, async (req, res) => {
  const { project_id, week_start } = req.query;
  if (!week_start)
    return res.status(400).json({ error: 'week_start required' });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(week_start))
    return res.status(400).json({ error: 'week_start must be YYYY-MM-DD' });

  try {
    let sql = `
      SELECT we.*, u.name AS user_name, u.role AS user_role, p.name AS project_name
      FROM   work_entries we
      JOIN   users    u ON we.user_id    = u.id
      JOIN   projects p ON we.project_id = p.id
      WHERE  we.date >= ? AND we.date < DATE_ADD(?, INTERVAL 7 DAY)
    `;
    const params = [week_start, week_start];

    if (project_id) {
      sql += ' AND we.project_id = ?';
      params.push(parseInt(project_id));
    }

    sql += ' ORDER BY we.date ASC, u.name ASC';
    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});
```

- [ ] **Step 2: Smoke-test manually**

```bash
cd /Users/yatinsingla/work/bht-server
npm run dev
# In another terminal (with a valid admin JWT from login):
curl -s "http://localhost:3000/api/reports/weekly?week_start=2026-05-11" \
  -H "Authorization: Bearer <token>" | head -c 400
```

Expected: JSON array (empty `[]` is fine if no entries that week).

---

## Task 3 — Server: PATCH /api/reports/weekly/jira-flag

**Files:**
- Modify: `bht-server/src/routes/reports.js`

- [ ] **Step 1: Add the jira-flag PATCH route**

Append before `module.exports = router;` (after the GET /weekly route):

```js
// PATCH /api/reports/weekly/jira-flag
// Body: { updates: [{ id: 1, jira_logged: true }, { id: 2, jira_logged: false }] }
router.patch('/weekly/jira-flag', authenticate, requireAdmin, async (req, res) => {
  const { updates } = req.body;
  if (!Array.isArray(updates) || updates.length === 0)
    return res.status(400).json({ error: 'updates array required' });
  if (!updates.every(u => Number.isInteger(u.id) && typeof u.jira_logged === 'boolean'))
    return res.status(400).json({ error: 'Each update must have id (int) and jira_logged (bool)' });

  const adminName = req.user.name;
  const ids       = updates.map(u => u.id);

  // Fully-parameterised CASE WHEN — no string interpolation of user data
  const loggedCase = updates.map(() => 'WHEN id = ? THEN ?').join(' ');
  const atCase     = updates.map(() => 'WHEN id = ? THEN ?').join(' ');
  const byCase     = updates.map(() => 'WHEN id = ? THEN ?').join(' ');
  const inHoles    = ids.map(() => '?').join(',');

  const loggedParams = updates.flatMap(u => [u.id, u.jira_logged ? 1 : 0]);
  const atParams     = updates.flatMap(u => [u.id, u.jira_logged ? new Date() : null]);
  const byParams     = updates.flatMap(u => [u.id, u.jira_logged ? adminName : null]);

  const sql = `
    UPDATE work_entries
    SET
      jira_logged    = CASE ${loggedCase} END,
      jira_logged_at = CASE ${atCase}     END,
      jira_logged_by = CASE ${byCase}     END
    WHERE id IN (${inHoles})
  `;

  try {
    await db.query(sql, [...loggedParams, ...atParams, ...byParams, ...ids]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});
```

- [ ] **Step 2: Smoke-test the PATCH**

```bash
curl -s -X PATCH "http://localhost:3000/api/reports/weekly/jira-flag" \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"updates":[{"id":1,"jira_logged":true}]}' 
```

Expected: `{"success":true}`. Verify in MySQL:

```bash
mysql -u root -p billable_hours -e "SELECT id, jira_logged, jira_logged_at, jira_logged_by FROM work_entries WHERE id=1;"
```

- [ ] **Step 3: Commit**

```bash
cd /Users/yatinsingla/work/bht-server
git add src/routes/reports.js
git commit -m "feat: add GET /weekly and PATCH /weekly/jira-flag report routes"
```

---

## Task 4 — Client: Shared Report Utilities

**Files:**
- Create: `bht-client/src/components/reportUtils.js`

- [ ] **Step 1: Create the shared utilities file**

Create `bht-client/src/components/reportUtils.js`:

```js
export const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

export const ROLE_LABELS = {
  BA: 'BA', DEV: 'Developer', US: 'US Consultant', PM: 'Project Manager',
};

export const ROLE_COLORS = {
  BA:  { bg: '#e8f0ec', color: '#2A6B52' },
  DEV: { bg: '#e8ecf5', color: '#1A3A5C' },
  US:  { bg: '#f5ede2', color: '#9A6020' },
  PM:  { bg: '#f0eaf5', color: '#5A2A82' },
};

export function formatDate(dateStr) {
  const [, mm, dd] = String(dateStr).slice(0, 10).split('-');
  return `${parseInt(dd)} ${MONTHS[parseInt(mm) - 1].slice(0, 3)}`;
}

export function formatDateFull(dateStr) {
  const [yyyy, mm, dd] = String(dateStr).slice(0, 10).split('-');
  return `${parseInt(dd)} ${MONTHS[parseInt(mm) - 1]} ${yyyy}`;
}

export function formatDateTime(ts) {
  if (!ts) return 'Not logged yet';
  const d = new Date(ts);
  return d.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function pct(mult) {
  return `+${Math.round((parseFloat(mult) - 1) * 100)}%`;
}

// Returns array of { start: Date, end: Date } for last n Monday-start weeks
export function getLastNWeeks(n) {
  const today = new Date();
  const dow   = today.getDay();
  const daysBack = dow === 0 ? 6 : dow - 1;
  const thisMonday = new Date(today);
  thisMonday.setDate(today.getDate() - daysBack);
  thisMonday.setHours(0, 0, 0, 0);

  return Array.from({ length: n }, (_, i) => {
    const start = new Date(thisMonday);
    start.setDate(thisMonday.getDate() - i * 7);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { start, end };
  });
}

export function toYMD(d) {
  return d.toISOString().slice(0, 10);
}

export function formatWeekLabel(start, end) {
  const s = `${start.getDate()} ${MONTHS[start.getMonth()].slice(0, 3)}`;
  const e = `${end.getDate()} ${MONTHS[end.getMonth()].slice(0, 3)} ${end.getFullYear()}`;
  return `${s} – ${e}`;
}
```

---

## Task 5 — Client: EntryDetailModal Component

**Files:**
- Create: `bht-client/src/components/EntryDetailModal.jsx`

This modal is used by both MonthlyReport (jiraLogged = entry.jira_logged from DB) and WeeklyReport (jiraLogged = live checkbox state). It is always read-only.

- [ ] **Step 1: Create EntryDetailModal.jsx**

Create `bht-client/src/components/EntryDetailModal.jsx`:

```jsx
import { MONTHS, ROLE_COLORS, ROLE_LABELS, formatDateFull, formatDateTime, pct } from './reportUtils';

export default function EntryDetailModal({ entry, onClose, jiraLogged }) {
  const rc        = ROLE_COLORS[entry.user_role] || { bg: '#eee', color: '#333' };
  const isLogged  = Boolean(jiraLogged);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(26,47,69,0.55)',
        zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        onClick={ev => ev.stopPropagation()}
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 2,
          width: '100%', maxWidth: 520,
          boxShadow: '0 8px 32px rgba(26,47,69,0.22)',
          maxHeight: '90vh', overflowY: 'auto',
        }}
      >
        {/* Header */}
        <div style={{
          background: 'var(--navy)', padding: '12px 16px',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          borderBottom: '2px solid var(--green)',
          position: 'sticky', top: 0,
        }}>
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
              background: 'transparent', border: '1px solid rgba(255,255,255,0.25)',
              color: 'rgba(255,255,255,0.7)', fontSize: 18, lineHeight: '1',
              padding: '1px 8px 3px', cursor: 'pointer', borderRadius: 2,
              flexShrink: 0, marginLeft: 12,
            }}
          >×</button>
        </div>

        {/* Body */}
        <div style={{ padding: 18 }}>
          {/* Person */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, paddingBottom: 14, borderBottom: '1px solid var(--border)' }}>
            <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 1, fontSize: 9, fontWeight: 500, background: rc.bg, color: rc.color }}>
              {ROLE_LABELS[entry.user_role] || entry.user_role}
            </span>
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--navy)' }}>{entry.user_name}</span>
          </div>

          {/* Fields */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 24px' }}>
            <MF label="Date"           value={formatDateFull(entry.date)} />
            <MF label="Project"        value={entry.project_name} />
            <MF label="Jira Ticket ID" value={entry.ticket_id || '—'} mono />
            <MF label="Activity Type"  value={entry.activity_type || '—'} />
            <MF label="Actual Hours"   value={`${parseFloat(entry.actual_hours).toFixed(2)} hrs`} />
            <MF label="Billable Hours" value={`${parseFloat(entry.billable_hours).toFixed(2)} hrs`} green />
            <MF label="Multiplier %"   value={pct(entry.multiplier)} pill />
            <MF label="Ticket Title"   value={entry.ticket_title || '—'} span />
          </div>

          {/* Notes */}
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
            <div style={{ fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>Notes</div>
            {entry.notes
              ? <p style={{ fontSize: 12, color: 'var(--navy)', lineHeight: 1.65, margin: 0 }}>{entry.notes}</p>
              : <p style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic', margin: 0 }}>No notes recorded.</p>
            }
          </div>

          {/* Jira section */}
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
            <div style={{
              padding: '12px 14px',
              background: isLogged ? '#EAF3DE' : 'var(--bg)',
              border: `1px solid ${isLogged ? '#97C459' : 'var(--border)'}`,
              borderRadius: 2,
            }}>
              <div style={{ fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color: isLogged ? '#3B6D11' : 'var(--muted)', marginBottom: 10 }}>
                Jira Status
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 24px' }}>
                <MF label="Jira Logged" value={isLogged ? 'Yes' : 'No'} highlight={isLogged} />
                <MF label="Logged By"   value={entry.jira_logged_by || '—'} />
                <MF label="Logged At"   value={formatDateTime(entry.jira_logged_at)} span />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MF({ label, value, green, mono, pill, span, highlight }) {
  return (
    <div style={span ? { gridColumn: '1 / -1' } : {}}>
      <div style={{ fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 4 }}>{label}</div>
      {pill
        ? <span style={{ background: '#EAF3DE', color: '#3B6D11', fontSize: 11, fontWeight: 500, padding: '2px 10px', borderRadius: 8 }}>{value}</span>
        : <div style={{
            fontSize:   green || highlight ? 15 : 12,
            color:      highlight ? '#27500A' : green ? 'var(--green)' : 'var(--navy)',
            fontWeight: green || highlight ? 600 : 400,
            fontFamily: green ? 'var(--font-heading)' : mono ? 'monospace' : 'inherit',
          }}>{value}</div>
      }
    </div>
  );
}
```

---

## Task 6 — Client: Update MonthlyReport

**Files:**
- Modify: `bht-client/src/components/MonthlyReport.jsx`

Changes needed:
1. Import from `reportUtils` instead of defining constants inline
2. Replace the inline `EntryModal` with `EntryDetailModal`
3. Add Jira Logged column (✅/❌, read-only) as the 9th column
4. Add "X of Y entries logged in Jira" note below summary cards
5. Pass `jiraLogged={entry.jira_logged}` to the modal

- [ ] **Step 1: Replace MonthlyReport.jsx**

Write the complete updated file `bht-client/src/components/MonthlyReport.jsx`:

```jsx
import { useState, useEffect, useMemo } from 'react';
import api from '../api/client';
import EntryDetailModal from './EntryDetailModal';
import {
  MONTHS, ROLE_LABELS, ROLE_COLORS,
  formatDate, formatDateFull, pct,
} from './reportUtils';

export default function MonthlyReport() {
  const [projects, setProjects]         = useState([]);
  const [filters, setFilters]           = useState({
    project_id: '',
    month:      new Date().getMonth() + 1,
    year:       new Date().getFullYear(),
  });
  const [entries, setEntries]           = useState([]);
  const [loading, setLoading]           = useState(false);
  const [fetched, setFetched]           = useState(false);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [hoveredRow, setHoveredRow]     = useState(null);

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
      if (!byProject[e.project_id])
        byProject[e.project_id] = { name: e.project_name, byUser: {} };
      const proj = byProject[e.project_id];
      if (!proj.byUser[e.user_id])
        proj.byUser[e.user_id] = { name: e.user_name, role: e.user_role, entries: [] };
      proj.byUser[e.user_id].entries.push(e);
    }
    return byProject;
  }, [entries]);

  const totalActual    = entries.reduce((s, e) => s + parseFloat(e.actual_hours),  0);
  const totalBillable  = entries.reduce((s, e) => s + parseFloat(e.billable_hours), 0);
  const totalExtra     = totalBillable - totalActual;
  const memberCount    = new Set(entries.map(e => e.user_id)).size;
  const jiraCount      = entries.filter(e => e.jira_logged).length;

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
                <SummaryCard type="blue" label="Total Entries"  value={entries.length}              sub={`across ${memberCount} member${memberCount !== 1 ? 's' : ''}`} />
                <SummaryCard type="def"  label="Actual Hours"   value={totalActual.toFixed(2)}      sub="hrs logged" />
                <SummaryCard type="grn"  label="Billable Hours" value={totalBillable.toFixed(2)}    sub="hrs to invoice" />
                <SummaryCard type="amb"  label="Extra Hours"    value={`+${totalExtra.toFixed(2)}`} sub="multiplier gain" />
              </div>

              {/* Jira count note */}
              <div style={{ padding: '8px 18px', borderBottom: '1px solid var(--border)', background: '#F5F2EB' }}>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                  <strong style={{ color: jiraCount === entries.length ? 'var(--green)' : 'var(--navy)' }}>
                    {jiraCount} of {entries.length}
                  </strong>
                  {' '}entries logged in Jira
                </span>
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
                      <div style={{ background: 'var(--navy)', padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 12, fontWeight: 500, color: '#fff', letterSpacing: 0.3 }}>{proj.name}</span>
                        <span style={{ fontSize: 10, color: '#8aa5bc' }}>{allEntries.length} entries · {monthLabel} {filters.year}</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 1, background: 'var(--border)', borderBottom: '1px solid var(--border)' }}>
                        <MetaCell label="Actual hrs"   value={projActual.toFixed(2)} />
                        <MetaCell label="Billable hrs" value={projBillable.toFixed(2)} green />
                        <MetaCell label="Extra hrs"    value={`+${projExtra.toFixed(2)}`} />
                      </div>

                      {Object.entries(proj.byUser).map(([userId, person], idx) => {
                        const personActual   = person.entries.reduce((s, e) => s + parseFloat(e.actual_hours),   0);
                        const personBillable = person.entries.reduce((s, e) => s + parseFloat(e.billable_hours), 0);
                        const rc = ROLE_COLORS[person.role] || { bg: '#eee', color: '#333' };

                        return (
                          <div key={userId} style={{ borderTop: idx === 0 ? 'none' : '1px solid var(--border)' }}>
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
                                <col style={{ width: 72 }} />
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
                                  <Th center>Jira</Th>
                                </tr>
                              </thead>
                              <tbody>
                                {person.entries.map(e => (
                                  <tr
                                    key={e.id}
                                    onClick={() => setSelectedEntry(e)}
                                    onMouseEnter={() => setHoveredRow(e.id)}
                                    onMouseLeave={() => setHoveredRow(null)}
                                    style={{
                                      cursor: 'pointer',
                                      background: e.jira_logged
                                        ? '#EAF3DE'
                                        : hoveredRow === e.id ? 'var(--hover-row)' : 'transparent',
                                      transition: 'background 0.1s',
                                    }}
                                  >
                                    <td style={tdStyle}><span style={{ fontSize: 10, color: 'var(--muted)' }}>{formatDate(e.date)}</span></td>
                                    <td style={tdStyle}><code style={{ fontSize: 9, color: 'var(--muted)' }}>{e.ticket_id || '—'}</code></td>
                                    <td style={{ ...tdStyle, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.ticket_title || '—'}</td>
                                    <td style={{ ...tdStyle, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.activity_type || '—'}</td>
                                    <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 500 }}>{parseFloat(e.actual_hours).toFixed(2)}</td>
                                    <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 600, color: 'var(--green)', fontFamily: 'var(--font-heading)', fontSize: 12 }}>{parseFloat(e.billable_hours).toFixed(2)}</td>
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
                                    <td style={{ ...tdStyle, textAlign: 'center', fontSize: 14 }}>
                                      {e.jira_logged ? '✅' : '❌'}
                                    </td>
                                  </tr>
                                ))}
                                <tr style={{ background: '#EAF3DE', borderTop: '1px solid #97C459' }}>
                                  <td colSpan={4} style={{ ...tdStyle, textAlign: 'right', color: 'var(--muted)', fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', fontWeight: 500 }}>
                                    {person.name} subtotal
                                  </td>
                                  <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 600 }}>{personActual.toFixed(2)}</td>
                                  <td style={{ ...tdStyle, textAlign: 'center', color: 'var(--green)', fontFamily: 'var(--font-heading)', fontSize: 13, fontWeight: 500 }}>{personBillable.toFixed(2)}</td>
                                  <td style={tdStyle} /><td style={tdStyle} /><td style={tdStyle} />
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
        <EntryDetailModal
          entry={selectedEntry}
          jiraLogged={Boolean(selectedEntry.jira_logged)}
          onClose={() => setSelectedEntry(null)}
        />
      )}
    </div>
  );
}

/* ── Small sub-components ── */

const tdStyle = {
  padding: '6px 8px', borderBottom: '0.5px solid var(--border)',
  verticalAlign: 'middle', color: 'var(--navy)',
};

function Th({ children, center, green }) {
  return (
    <th style={{
      padding: '5px 8px', textAlign: center ? 'center' : 'left',
      fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase',
      color: green ? 'var(--green)' : 'var(--muted)',
      borderBottom: '0.5px solid var(--border)', whiteSpace: 'nowrap',
      background: 'var(--card)',
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
```

- [ ] **Step 2: Verify dev server builds without error**

```bash
cd /Users/yatinsingla/work/bht-client && npm run dev 2>&1 | head -20
```

Expected: Vite ready, no errors.

- [ ] **Step 3: Manual check in browser**

Open `http://localhost:5173/report`. Generate a monthly report. Confirm:
- 9 columns (Notes + Jira at end)
- Jira logged rows have green `#EAF3DE` background
- "X of Y entries logged in Jira" note appears below summary cards
- Clicking a row opens the new modal with Project, Ticket Title, and Jira Status section

---

## Task 7 — Client: WeeklyReport Component

**Files:**
- Create: `bht-client/src/components/WeeklyReport.jsx`

State design:
- `entries`: raw array from DB (source of truth for jira DB state)
- `jiraState`: `{ [id]: boolean }` — live checkbox state, initialized from `entries` on fetch
- `saving`: boolean
- `toast`: string | null (auto-cleared after 3s)
- On save: compute changed entries where `jiraState[e.id] !== Boolean(e.jira_logged)`, PATCH, re-fetch, re-init jiraState

- [ ] **Step 1: Create WeeklyReport.jsx**

Create `bht-client/src/components/WeeklyReport.jsx`:

```jsx
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

  useEffect(() => {
    api.get('/projects').then(r => setProjects(r.data)).catch(() => {});
  }, []);

  function set(field, val) { setFilters(f => ({ ...f, [field]: val })); }

  const fetchReport = useCallback(async (flt = filters) => {
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
    } catch {
      setEntries([]);
      setJiraState({});
    } finally {
      setLoading(false);
    }
  }, [filters]);

  function toggleJira(id) {
    setJiraState(s => ({ ...s, [id]: !s[id] }));
  }

  async function handleSave() {
    const changed = entries
      .filter(e => jiraState[e.id] !== Boolean(e.jira_logged))
      .map(e => ({ id: e.id, jira_logged: jiraState[e.id] }));

    if (changed.length === 0) return;

    setSaving(true);
    try {
      await api.patch('/reports/weekly/jira-flag', { updates: changed });
      showToast('Jira flags saved successfully');
      await fetchReport(filters);
    } catch {
      showToast('Save failed — please try again');
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

  const totalActual    = entries.reduce((s, e) => s + parseFloat(e.actual_hours),  0);
  const totalBillable  = entries.reduce((s, e) => s + parseFloat(e.billable_hours), 0);
  const totalExtra     = totalBillable - totalActual;

  const selectedWeek   = WEEKS.find(w => toYMD(w.start) === filters.week_start) || WEEKS[0];
  const weekLabel      = formatWeekLabel(selectedWeek.start, selectedWeek.end);
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
                  Click any row · check boxes to log Jira
                </div>
              </div>

              {/* Summary cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, padding: '16px 18px', borderBottom: '1px solid var(--border)' }}>
                <SummaryCard type="blue" label="Total Entries"  value={entries.length}              sub={`${Object.keys(grouped).length} member(s)`} />
                <SummaryCard type="def"  label="Actual Hours"   value={totalActual.toFixed(2)}      sub="hrs logged" />
                <SummaryCard type="grn"  label="Billable Hours" value={totalBillable.toFixed(2)}    sub="hrs to invoice" />
                <SummaryCard type="amb"  label="Extra Hours"    value={`+${totalExtra.toFixed(2)}`} sub="multiplier gain" />
              </div>

              {/* Person groups */}
              <div style={{ padding: '0 18px 80px' }}>
                {Object.entries(grouped).map(([userId, person], pidx) => {
                  const personActual   = person.entries.reduce((s, e) => s + parseFloat(e.actual_hours),   0);
                  const personBillable = person.entries.reduce((s, e) => s + parseFloat(e.billable_hours), 0);
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
                          <col style={{ width: 52 }} />
                          <col style={{ width: 86 }} />
                        </colgroup>
                        <thead>
                          <tr>
                            <Th>Date</Th>
                            <Th>Ticket ID</Th>
                            <Th>Title</Th>
                            <Th>Activity</Th>
                            <Th center>Actual</Th>
                            <Th center green>Billable</Th>
                            <Th center green>+%</Th>
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
                                <td
                                  style={{ ...tdStyle, cursor: 'pointer' }}
                                  onClick={() => setSelectedEntry(e)}
                                >
                                  <span style={{ fontSize: 10, color: 'var(--muted)' }}>{formatDate(e.date)}</span>
                                </td>
                                <td
                                  style={{ ...tdStyle, cursor: 'pointer' }}
                                  onClick={() => setSelectedEntry(e)}
                                >
                                  <code style={{ fontSize: 9, color: 'var(--muted)' }}>{e.ticket_id || '—'}</code>
                                </td>
                                <td
                                  style={{ ...tdStyle, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer' }}
                                  onClick={() => setSelectedEntry(e)}
                                >
                                  {e.ticket_title || '—'}
                                </td>
                                <td
                                  style={{ ...tdStyle, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer' }}
                                  onClick={() => setSelectedEntry(e)}
                                >
                                  {e.activity_type || '—'}
                                </td>
                                <td
                                  style={{ ...tdStyle, textAlign: 'center', fontWeight: 500, cursor: 'pointer' }}
                                  onClick={() => setSelectedEntry(e)}
                                >
                                  {parseFloat(e.actual_hours).toFixed(2)}
                                </td>
                                <td
                                  style={{ ...tdStyle, textAlign: 'center', fontWeight: 600, color: 'var(--green)', fontFamily: 'var(--font-heading)', fontSize: 12, cursor: 'pointer' }}
                                  onClick={() => setSelectedEntry(e)}
                                >
                                  {parseFloat(e.billable_hours).toFixed(2)}
                                </td>
                                <td
                                  style={{ ...tdStyle, cursor: 'pointer' }}
                                  onClick={() => setSelectedEntry(e)}
                                >
                                  <span style={{ background: '#EAF3DE', color: '#3B6D11', fontSize: 9, fontWeight: 500, padding: '1px 5px', borderRadius: 8 }}>
                                    {pct(e.multiplier)}
                                  </span>
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
                          <tr style={{ background: '#EAF3DE', borderTop: '1px solid #97C459' }}>
                            <td colSpan={4} style={{ ...tdStyle, textAlign: 'right', color: 'var(--muted)', fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', fontWeight: 500 }}>
                              {person.name} subtotal
                            </td>
                            <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 600 }}>{personActual.toFixed(2)}</td>
                            <td style={{ ...tdStyle, textAlign: 'center', color: 'var(--green)', fontFamily: 'var(--font-heading)', fontSize: 13, fontWeight: 500 }}>{personBillable.toFixed(2)}</td>
                            <td style={tdStyle} /><td style={tdStyle} />
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

      {/* Sticky Save button */}
      {fetched && !loading && entries.length > 0 && (
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            position:      'fixed',
            bottom:        24,
            right:         24,
            zIndex:        900,
            padding:       '12px 24px',
            background:    saving ? '#2A6B52' : 'var(--navy)',
            color:         '#fff',
            border:        'none',
            borderRadius:  2,
            fontFamily:    'var(--font-body)',
            fontSize:      12,
            fontWeight:    500,
            letterSpacing: 1,
            textTransform: 'uppercase',
            cursor:        saving ? 'default' : 'pointer',
            boxShadow:     '0 4px 16px rgba(26,47,69,0.3)',
            transition:    'background 0.2s',
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
          position:      'fixed',
          bottom:        80,
          right:         24,
          zIndex:        1100,
          padding:       '12px 20px',
          background:    '#2A6B52',
          color:         '#fff',
          borderRadius:  2,
          fontSize:      13,
          fontWeight:    500,
          boxShadow:     '0 4px 16px rgba(0,0,0,0.2)',
          animation:     'fadeIn 0.2s ease',
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

function Th({ children, center, green }) {
  return (
    <th style={{
      padding: '5px 8px', textAlign: center ? 'center' : 'left',
      fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase',
      color: green ? 'var(--green)' : 'var(--muted)',
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
```

---

## Task 8 — Client: Page, Route, and Navbar

**Files:**
- Create: `bht-client/src/pages/WeeklyReportPage.jsx`
- Modify: `bht-client/src/App.jsx`
- Modify: `bht-client/src/components/Navbar.jsx`

- [ ] **Step 1: Create WeeklyReportPage.jsx**

Create `bht-client/src/pages/WeeklyReportPage.jsx`:

```jsx
import WeeklyReport from '../components/WeeklyReport';

export default function WeeklyReportPage() {
  return <WeeklyReport />;
}
```

- [ ] **Step 2: Add route in App.jsx**

In `bht-client/src/App.jsx`, add the import and the new route.

Add import at top (after existing imports):

```jsx
import WeeklyReportPage from './pages/WeeklyReportPage';
```

Add this route inside `<Routes>` after the `/report` route:

```jsx
<Route path="/weekly-report" element={
  <AdminRoute><Layout><WeeklyReportPage /></Layout></AdminRoute>
} />
```

- [ ] **Step 3: Add Weekly Report tab in Navbar.jsx**

In `bht-client/src/components/Navbar.jsx`, add the new tab after the existing "Monthly Report" tab:

```jsx
{isAdmin && (
  <NavTab to="/weekly-report" active={location.pathname === '/weekly-report'}>Weekly Report</NavTab>
)}
```

The tab order in the nav becomes: **Work Log → Weekly Report → Monthly Report**

Per spec: Weekly Report sits between Daily Log (Work Log) and Monthly Report.

- [ ] **Step 4: Verify routing and nav**

```bash
npm run dev
```

Open `http://localhost:5173`. Login as admin. Confirm:
- Navbar shows: Work Log | Weekly Report | Monthly Report
- `/weekly-report` renders the filter bar
- Non-admin users cannot see the Weekly Report tab or access `/weekly-report` (redirects to `/`)

- [ ] **Step 5: Commit all client changes**

```bash
cd /Users/yatinsingla/work/bht-client
git add src/components/reportUtils.js \
        src/components/EntryDetailModal.jsx \
        src/components/WeeklyReport.jsx \
        src/components/MonthlyReport.jsx \
        src/components/Navbar.jsx \
        src/pages/WeeklyReportPage.jsx \
        src/App.jsx \
        docs/superpowers/plans/2026-05-14-weekly-report-jira-flags.md
git commit -m "feat: add Weekly Report module and update Monthly Report with Jira logging"
```

---

## Self-Review Against Spec

| Spec Item | Covered By |
|-----------|-----------|
| ALTER TABLE jira_logged/at/by | Task 1 |
| GET /reports/weekly grouped by person, includes jira fields | Task 2 |
| PATCH /weekly/jira-flag single CASE WHEN query, never loops | Task 3 |
| Monthly report includes jira fields (via existing /work-entries we.*) | automatic once DB migrated |
| Shared report utils (MONTHS, ROLE_COLORS, formatters, week helpers) | Task 4 |
| EntryDetailModal with all required fields + Jira section | Task 5 |
| Monthly report: Jira column ✅/❌ read-only | Task 6 |
| Monthly report: "X of Y entries logged in Jira" note | Task 6 |
| Monthly report: row bg #EAF3DE when jira_logged | Task 6 |
| Monthly modal: all fields, Jira section, green highlight if logged | Task 5 + 6 |
| Weekly Report tab — Admin only | Task 8 (AdminRoute) |
| Tab order: Work Log → Weekly Report → Monthly Report | Task 8 |
| Week dropdown: last 8 weeks, Monday-start, formatted label | Task 4 (getLastNWeeks) + Task 7 |
| Weekly table: 8 columns including Jira Logged checkbox | Task 7 |
| Jira logged rows: bg #EAF3DE | Task 7 |
| No auto-save on checkbox change | Task 7 (toggleJira only updates local state) |
| Sticky Save button, fixed bottom right | Task 7 |
| Single PATCH call for all changed entries | Task 7 (handleSave) |
| Green toast, auto-dismiss 3s | Task 7 (showToast) |
| Report auto-refresh after save, same filters | Task 7 (fetchReport called after PATCH) |
| Weekly modal: live jira state (jiraState[id] passed as prop) | Task 7 + Task 5 |
| Weekly modal: all required fields | Task 5 |
| jira_logged_by = admin name from JWT | Task 3 (req.user.name) |
| jira_logged_at = NOW() on true, NULL on false | Task 3 (atParams logic) |
| Team members never see jira fields | Admin-only routes + API middleware |
| All bulk saves use ONE single DB query | Task 3 (CASE WHEN) |
| Theme: navy/cream/green/border variables | All tasks use var(--navy) etc. |
