import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('af_user');
      return stored ? JSON.parse(stored) : null;
    } catch { return null; }
  });
  const [loading, setLoading] = useState(true);

  const validateSession = useCallback(async () => {
    const token = localStorage.getItem('af_token');
    if (!token) { setLoading(false); return; }
    try {
      const { data } = await api.get('/auth/me');
      setUser(data.user);
      localStorage.setItem('af_user', JSON.stringify(data.user));
    } catch {
      localStorage.removeItem('af_token');
      localStorage.removeItem('af_user');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { validateSession(); }, [validateSession]);

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('af_token', data.token);
    localStorage.setItem('af_user', JSON.stringify(data.user));
    setUser(data.user);
    return data;
  };

  const signup = async (name, email, password, phone) => {
    const { data } = await api.post('/auth/signup', { name, email, password, phone });
    localStorage.setItem('af_token', data.token);
    localStorage.setItem('af_user', JSON.stringify(data.user));
    setUser(data.user);
    return data;
  };

  const logout = () => {
    localStorage.removeItem('af_token');
    localStorage.removeItem('af_user');
    setUser(null);
  };

  const isAdmin = user?.role === 'Admin';
  const isAssetManager = user?.role === 'AssetManager' || isAdmin;
  const isDeptHead = user?.role === 'DepartmentHead' || isAdmin;
  const canManageAssets = isAdmin || user?.role === 'AssetManager';
  const canApprove = isAdmin || user?.role === 'AssetManager' || user?.role === 'DepartmentHead';

  return (
    <AuthContext.Provider value={{ user, login, signup, logout, loading, isAdmin, isAssetManager, isDeptHead, canManageAssets, canApprove }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
