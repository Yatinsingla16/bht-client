import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import { formatDate } from './reportUtils';

export default function WorkLogTable({ entries, onDelete }) {
  const { user } = useAuth();

  async function handleDelete(id) {
    if (!window.confirm('Delete this entry?')) return;
    try {
      await api.delete(`/work-entries/${id}`);
      onDelete();
    } catch {
      alert('Could not delete entry.');
    }
  }

  if (!entries.length) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--muted)' }}>
        <p style={{ fontSize: 11, letterSpacing: 3, textTransform: 'uppercase' }}>No Entries Yet</p>
        <p style={{ fontSize: 13, marginTop: 8 }}>Use the button above to log your first work entry.</p>
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            {user.is_admin && <th>Team Member</th>}
            <th>Project</th>
            <th>Ticket ID</th>
            <th>Activity</th>
            <th>What did you do?</th>
            <th style={{ textAlign: 'right' }}>Actual Hrs</th>
            {user.is_admin && <th style={{ textAlign: 'right', color: 'var(--green)' }}>Mult.</th>}
            {user.is_admin && <th style={{ textAlign: 'right', color: 'var(--green)' }}>Billable Hrs</th>}
            <th>Notes</th>
            <th style={{ width: 32 }}></th>
          </tr>
        </thead>
        <tbody>
          {entries.map(e => (
            <tr key={e.id}>
              <td style={{ whiteSpace: 'nowrap', color: 'var(--muted)', fontSize: 13 }}>
                {formatDate(e.date)}
              </td>
              {user.is_admin && (
                <td>
                  {e.user_name}
                  <span style={{ color: 'var(--muted)', fontSize: 10, letterSpacing: 2, marginLeft: 6 }}>
                    {e.user_role}
                  </span>
                </td>
              )}
              <td>{e.project_name}</td>
              <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--amber)' }}>
                {e.jira_ticket_code || e.ticket_id || '—'}
              </td>
              <td style={{ fontSize: 13, color: 'var(--muted)' }}>{e.activity_type || '—'}</td>
              <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {e.work_description || '—'}
              </td>
              <td style={{ textAlign: 'right' }}>
                {parseFloat(e.actual_hours).toFixed(2)}
              </td>
              {user.is_admin && (
                <td style={{ textAlign: 'right', color: 'var(--green)', fontSize: 13 }}>
                  {parseFloat(e.multiplier).toFixed(2)}×
                </td>
              )}
              {user.is_admin && (
                <td style={{ textAlign: 'right', fontWeight: 500, color: 'var(--green)' }}>
                  {parseFloat(e.billable_hours).toFixed(2)}
                </td>
              )}
              <td style={{
                maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis',
                whiteSpace: 'nowrap', color: 'var(--muted)', fontSize: 13,
              }}>
                {e.notes || '—'}
              </td>
              <td>
                {(user.is_admin || e.user_id === user.id) && (
                  <button
                    onClick={() => handleDelete(e.id)}
                    title="Delete entry"
                    style={{
                      background: 'transparent', border: 'none',
                      color: 'var(--muted)', fontSize: 13, cursor: 'pointer',
                      padding: '2px 6px', lineHeight: 1,
                    }}
                  >✕</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
