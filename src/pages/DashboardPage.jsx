import { useState, useEffect, useCallback } from 'react';
import { useAuth }        from '../context/AuthContext';
import api                from '../api/client';
import WorkEntryForm      from '../components/WorkEntryForm';
import WorkLogTable       from '../components/WorkLogTable';

export default function DashboardPage() {
  const { user }    = useAuth();
  const [entries, setEntries]   = useState([]);
  const [loading, setLoading]   = useState(true);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/work-entries');
      setEntries(data);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const totalActual   = entries.reduce((s, e) => s + parseFloat(e.actual_hours),   0);
  const totalBillable = entries.reduce((s, e) => s + parseFloat(e.billable_hours),  0);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 26, marginBottom: 4 }}>Work Log</h1>
          <p style={{ color: 'var(--muted)', fontSize: 13 }}>
            {user.is_admin
              ? `All team entries — ${entries.length} record${entries.length !== 1 ? 's' : ''}`
              : `Your entries, ${user.name}`}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <StatCard label="Total Actual Hrs"   value={totalActual.toFixed(2)}   />
          {user.is_admin && (
            <StatCard label="Total Billable Hrs" value={totalBillable.toFixed(2)} admin />
          )}
        </div>
      </div>

      <WorkEntryForm onSuccess={fetchEntries} />
      <div className="divider" />

      {loading
        ? <p style={{ color: 'var(--muted)', fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', padding: '24px 0' }}>Loading…</p>
        : <WorkLogTable entries={entries} onDelete={fetchEntries} />
      }
    </div>
  );
}

function StatCard({ label, value, admin }) {
  return (
    <div style={{
      background:    admin ? 'var(--admin-bg)'     : 'var(--card)',
      border:        `1px solid ${admin ? 'var(--admin-border)' : 'var(--border)'}`,
      borderRadius:  2,
      padding:       '12px 20px',
      textAlign:     'right',
      minWidth:      140,
    }}>
      <span className="label" style={{ color: admin ? 'var(--green)' : 'var(--muted)' }}>
        {label}
      </span>
      <p style={{
        fontFamily: 'var(--font-heading)',
        fontSize:   22,
        color:      admin ? 'var(--green)' : 'var(--navy)',
        marginTop:  2,
      }}>
        {value}
      </p>
    </div>
  );
}
