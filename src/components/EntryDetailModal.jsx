import { ROLE_COLORS, ROLE_LABELS, formatDateFull, formatDateTime, pct } from './reportUtils';

export default function EntryDetailModal({ entry, onClose, jiraLogged }) {
  const rc        = ROLE_COLORS[entry.user_role] || { bg: '#eee', color: '#333' };
  const isLogged  = Boolean(jiraLogged);
  const hasTicket = Boolean(entry.jira_ticket_code || entry.jira_title);

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(26,47,69,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 2, width: '100%', maxWidth: 540, boxShadow: '0 8px 32px rgba(26,47,69,0.22)', maxHeight: '90vh', overflowY: 'auto' }}
      >
        {/* Header */}
        <div style={{ background: 'var(--navy)', padding: '12px 16px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', borderBottom: '2px solid var(--green)', position: 'sticky', top: 0 }}>
          <div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 16, color: '#fff', marginBottom: 3 }}>
              {hasTicket ? entry.jira_ticket_code : 'Work Entry'}
            </div>
            <div style={{ fontSize: 9, color: '#8aa5bc', letterSpacing: 1.5, textTransform: 'uppercase' }}>
              {formatDateFull(entry.date)} · {entry.project_name}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.25)', color: 'rgba(255,255,255,0.7)', fontSize: 18, lineHeight: 1, padding: '1px 8px 3px', cursor: 'pointer', borderRadius: 2, flexShrink: 0, marginLeft: 12 }}>×</button>
        </div>

        <div style={{ padding: 18 }}>

          {/* ── Section 1: Jira Ticket Info ── */}
          <div style={{ marginBottom: 18, paddingBottom: 18, borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 12 }}>Jira Ticket</div>
            {hasTicket ? (
              <div style={{ background: '#EEF4FB', border: '1px solid #85B7EB', borderRadius: 2, padding: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px', marginBottom: 10 }}>
                  <SField label="Ticket ID"  value={<code style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)' }}>{entry.jira_ticket_code}</code>} />
                  <SField label="Project"    value={entry.jira_project_name || entry.project_name} />
                  <SField label="Title"      value={entry.jira_title || '—'} span />
                </div>
                {entry.jira_description && (
                  <div style={{ paddingTop: 10, borderTop: '1px solid #85B7EB' }}>
                    <div style={{ fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color: '#185FA5', marginBottom: 6 }}>Description</div>
                    <div style={{ fontSize: 12, color: '#333', lineHeight: 1.65, maxHeight: 120, overflowY: 'auto' }}>{entry.jira_description}</div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic' }}>No Jira ticket linked to this entry.</div>
            )}
          </div>

          {/* ── Section 2: Work Entry Details ── */}
          <div style={{ marginBottom: 18, paddingBottom: 18, borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 12 }}>Work Entry</div>

            {/* Person */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 1, fontSize: 9, fontWeight: 500, background: rc.bg, color: rc.color }}>
                {ROLE_LABELS[entry.user_role] || entry.user_role}
              </span>
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--navy)' }}>{entry.user_name}</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px' }}>
              <SField label="Date"          value={formatDateFull(entry.date)} />
              <SField label="Activity"      value={entry.activity_type || '—'} />
              <SField label="Actual Hours"  value={`${parseFloat(entry.actual_hours).toFixed(2)} hrs`} />
              <SField label="Billable Hours" value={`${parseFloat(entry.billable_hours).toFixed(2)} hrs`} green />
              <SField label="Multiplier"    value={pct(entry.multiplier)} pill />
            </div>

            {/* What did you do */}
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>What did you do?</div>
              {entry.work_description
                ? <p style={{ fontSize: 12, color: 'var(--navy)', lineHeight: 1.65, margin: 0 }}>{entry.work_description}</p>
                : <p style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic', margin: 0 }}>No description recorded.</p>
              }
            </div>
          </div>

          {/* ── Section 3: Jira Status ── */}
          <div>
            <div style={{ padding: '12px 14px', background: isLogged ? '#EAF3DE' : 'var(--bg)', border: `1px solid ${isLogged ? '#97C459' : 'var(--border)'}`, borderRadius: 2 }}>
              <div style={{ fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color: isLogged ? '#3B6D11' : 'var(--muted)', marginBottom: 10 }}>Jira Status</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 24px' }}>
                <SField label="Jira Logged"    value={isLogged ? 'Yes' : 'No'} highlight={isLogged} />
                <SField label="Jira Logged By" value={entry.jira_logged_by || '—'} />
                <SField label="Jira Logged At" value={formatDateTime(entry.jira_logged_at)} span />
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

function SField({ label, value, green, pill, span, highlight }) {
  return (
    <div style={span ? { gridColumn: '1 / -1' } : {}}>
      <div style={{ fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 4 }}>{label}</div>
      {pill
        ? <span style={{ background: '#EAF3DE', color: '#3B6D11', fontSize: 11, fontWeight: 500, padding: '2px 10px', borderRadius: 8 }}>{value}</span>
        : typeof value === 'string'
          ? <div style={{ fontSize: green || highlight ? 15 : 12, color: highlight ? '#27500A' : green ? 'var(--green)' : 'var(--navy)', fontWeight: green || highlight ? 600 : 400 }}>{value}</div>
          : value
      }
    </div>
  );
}
