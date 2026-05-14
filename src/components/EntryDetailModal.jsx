import { ROLE_COLORS, ROLE_LABELS, formatDateFull, formatDateTime, pct } from './reportUtils';

export default function EntryDetailModal({ entry, onClose, jiraLogged }) {
  const rc       = ROLE_COLORS[entry.user_role] || { bg: '#eee', color: '#333' };
  const isLogged = Boolean(jiraLogged);

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

          {/* Fields grid */}
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
