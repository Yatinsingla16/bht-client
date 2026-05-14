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
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function formatWeekLabel(start, end) {
  const s = `${start.getDate()} ${MONTHS[start.getMonth()].slice(0, 3)}`;
  const e = `${end.getDate()} ${MONTHS[end.getMonth()].slice(0, 3)} ${end.getFullYear()}`;
  return `${s} – ${e}`;
}