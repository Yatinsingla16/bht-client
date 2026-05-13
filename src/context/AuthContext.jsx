import { createContext, useContext, useState } from 'react';
import api from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('bht_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      localStorage.removeItem('bht_user');
      return null;
    }
  });

  const [sessionRole, setSessionRole] = useState(
    () => localStorage.getItem('bht_session_role') || null
  );

  async function login(name, password, role) {
    const { data } = await api.post('/auth/login', { name, password, role });
    localStorage.setItem('bht_token', data.token);
    localStorage.setItem('bht_user', JSON.stringify(data.user));
    const activeRole = role || data.user.role;
    localStorage.setItem('bht_session_role', activeRole);
    setUser(data.user);
    setSessionRole(activeRole);
  }

  function logout() {
    localStorage.removeItem('bht_token');
    localStorage.removeItem('bht_user');
    localStorage.removeItem('bht_session_role');
    setUser(null);
    setSessionRole(null);
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, sessionRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
