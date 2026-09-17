import { createContext, useContext, useState, useCallback } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem('civic_token'));
  const [role, setRole] = useState(localStorage.getItem('civic_role'));
  const [profile, setProfile] = useState(() => {
    const raw = localStorage.getItem('civic_profile');
    return raw ? JSON.parse(raw) : null;
  });

  const login = useCallback((newToken, newRole, newProfile) => {
    localStorage.setItem('civic_token', newToken);
    localStorage.setItem('civic_role', newRole);
    localStorage.setItem('civic_profile', JSON.stringify(newProfile));
    setToken(newToken);
    setRole(newRole);
    setProfile(newProfile);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('civic_token');
    localStorage.removeItem('civic_role');
    localStorage.removeItem('civic_profile');
    setToken(null);
    setRole(null);
    setProfile(null);
  }, []);

  return (
    <AuthContext.Provider value={{ token, role, profile, login, logout, isAuthed: !!token }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
