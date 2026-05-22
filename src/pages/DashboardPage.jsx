import { useState, useEffect, useCallback } from 'react';
import { useAuth }        from '../context/AuthContext';
import api                from '../api/client';
import WorkEntryForm      from '../components/WorkEntryForm';
import WorkLogTable       from '../components/WorkLogTable';

function toLocalYMD(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function mondayOfWeek() {
  const d   = new Date();
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return toLocalYMD(d);
}

function firstOfMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

export default function DashboardPage() {
  const { user } = useAuth();

  const [entries,     setEntries]     = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [dateFrom,    setDateFrom]    = useState(() => toLocalYMD());
  const [dateTo,      setDateTo]      = useState(() => toLocalYMD());
  const [activeQuick, setActiveQuick] = useState('today');

  const fetchEntries = useCallback(async (from, to) => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (from) p.set('date_from', from);
      if (to)   p.set('date_to',   to);
      const { data } = await api.get(`/work-entries?${p}`);
      setEntries(data);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = toLocalYMD();
    fetchEntries(t, t);
  }, [fetchEntries]);

  function applyToday() {
    const t = toLocalYMD();
    setDateFrom(t); setDateTo(t); setActiveQuick('today');
    fetchEntries(t, t);
  }

  function applyThisWeek() {
    const from = mondayOfWeek(), to = toLocalYMD();
    setDateFrom(from); setDateTo(to); setActiveQuick('week');
    fetchEntries(from, to);
  }

  function applyThisMonth() {
    const from = firstOfMonth(), to = toLocalYMD();
    setDateFrom(from); setDateTo(to); setActiveQuick('month');
    fetchEntries(from, to);
  }

  function handleDateFromChange(val) {
    setDateFrom(val); setActiveQuick(null);
    fetchEntries(val, dateTo);
  }

  function handleDateToChange(val) {
    setDateTo(val); setActiveQuick(null);
    fetchEntries(dateFrom, val);
  }

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

      <WorkEntryForm onSuccess={() => fetchEntries(dateFrom, dateTo)} />
      <div className="divider" />

      <div style={{ border: '1px solid #E0DDD4', borderRadius: 2 }}>

        {/* Filter bar */}
        <div style={{
          background: '#FDFBF7',
          borderBottom: '1px solid #E0DDD4',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
            <DateInput label="From" value={dateFrom} onChange={handleDateFromChange} />
            <DateInput label="To"   value={dateTo}   onChange={handleDateToChange}   />
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <QuickBtn label="Today"      active={activeQuick === 'today'} onClick={applyToday}     />
              <QuickBtn label="This Week"  active={activeQuick === 'week'}  onClick={applyThisWeek}  />
              <QuickBtn label="This Month" active={activeQuick === 'month'} onClick={applyThisMonth} />
              <button
                onClick={applyToday}
                style={{
                  background: 'transparent', border: 'none',
                  color: '#2A6B52', fontSize: 12, cursor: 'pointer',
                  fontFamily: 'var(--font-body)', padding: '4px 6px',
                  textDecoration: 'none',
                }}
                onMouseEnter={e => { e.currentTarget.style.textDecoration = 'underline'; }}
                onMouseLeave={e => { e.currentTarget.style.textDecoration = 'none'; }}
              >
                Clear Filter
              </button>
            </div>
          </div>
          <div style={{ fontSize: 11, color: '#7A7870' }}>
            Showing {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
          </div>
        </div>

        {/* Table area */}
        {loading
          ? <p style={{ color: 'var(--muted)', fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', padding: '24px 16px' }}>Loading…</p>
          : <WorkLogTable entries={entries} onDelete={() => fetchEntries(dateFrom, dateTo)} />
        }

      </div>
    </div>
  );
}

function DateInput({ label, value, onChange }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <label style={{ fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color: '#7A7870' }}>{label}</label>
      <input
        type="date"
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          border: '1px solid #E0DDD4', borderRadius: 2,
          background: '#F5F2EB', padding: '4px 8px',
          fontFamily: 'var(--font-body)', fontSize: 12,
          outline: 'none', color: 'var(--navy)',
        }}
        onFocus={e => { e.target.style.borderColor = '#2A6B52'; }}
        onBlur={e => { e.target.style.borderColor = '#E0DDD4'; }}
      />
    </div>
  );
}

function QuickBtn({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? 'var(--navy)' : 'transparent',
        color: active ? '#fff' : '#1A2F45',
        border: '1px solid #1A2F45',
        borderRadius: 2,
        fontSize: 11,
        letterSpacing: 1,
        textTransform: 'uppercase',
        padding: '4px 10px',
        cursor: 'pointer',
        fontFamily: 'var(--font-body)',
      }}
      onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'var(--navy)'; e.currentTarget.style.color = '#fff'; } }}
      onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#1A2F45'; } }}
    >
      {label}
    </button>
  );
}

function StatCard({ label, value, admin }) {
  return (
    <div style={{
      background:   admin ? 'var(--admin-bg)'    : 'var(--card)',
      border:       `1px solid ${admin ? 'var(--admin-border)' : 'var(--border)'}`,
      borderRadius: 2,
      padding:      '12px 20px',
      textAlign:    'right',
      minWidth:     140,
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
