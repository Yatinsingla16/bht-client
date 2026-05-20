import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import logoIcon from '../assets/logo-icon.svg';

export default function Navbar() {
  const { user, logout, sessionRole } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  const displayRole = sessionRole || user?.role || '';
  const isAdmin = user?.is_admin;

  return (
    <div>
      <nav style={{
        background:     'var(--navy)',
        padding:        '10px 20px',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        borderBottom:   '2px solid var(--green)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src={logoIcon} alt="" style={{ height: 32, width: 'auto' }} />
          <div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 14, color: '#fff' }}>
              Chandika <span style={{ color: '#3D7A60', fontStyle: 'italic' }}>Innov.</span>
            </div>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: '#8aa5bc' }}>
              Billable Hours Tracker
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11, color: '#8aa5bc' }}>
            Signed in as <strong style={{ color: '#fff' }}>{user?.name}</strong>
          </span>
          <span style={{
            background:    'var(--green)',
            color:         '#fff',
            fontSize:      9,
            fontWeight:    500,
            letterSpacing: 1,
            textTransform: 'uppercase',
            padding:       '2px 7px',
            borderRadius:  1,
          }}>
            {isAdmin ? 'Admin' : displayRole}
          </span>
          <button
            onClick={handleLogout}
            style={{
              background:    'transparent',
              border:        '1px solid rgba(255,255,255,0.25)',
              color:         'rgba(255,255,255,0.8)',
              fontSize:      10,
              letterSpacing: 2,
              textTransform: 'uppercase',
              padding:       '5px 12px',
              cursor:        'pointer',
              borderRadius:  2,
              fontFamily:    'var(--font-body)',
            }}
          >
            Sign out
          </button>
        </div>
      </nav>

      <div style={{ display: 'flex', background: 'var(--card)', borderBottom: '1px solid var(--border)' }}>
        <NavTab to="/" active={location.pathname === '/'}>Work Log</NavTab>
        {isAdmin && (
          <NavTab to="/weekly-report" active={location.pathname === '/weekly-report'}>Weekly Report</NavTab>
        )}
        {isAdmin && (
          <NavTab to="/report" active={location.pathname === '/report'}>Monthly Report</NavTab>
        )}
      </div>
    </div>
  );
}

function NavTab({ to, children, active }) {
  return (
    <Link
      to={to}
      style={{
        padding:        '10px 18px',
        fontSize:       12,
        fontWeight:     500,
        color:          active ? 'var(--green)' : 'var(--muted)',
        textDecoration: 'none',
        borderBottom:   active ? '2px solid var(--green)' : '2px solid transparent',
        letterSpacing:  0.3,
        display:        'inline-block',
      }}
    >
      {children}
    </Link>
  );
}
