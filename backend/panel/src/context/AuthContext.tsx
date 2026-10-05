import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { User, UserRole } from '../types';
import { authApi } from '../api';
import { SESSION_EXPIRED_EVENT, TOKEN_STORAGE_KEY, USER_STORAGE_KEY, clearStoredSession } from '../api/client';
import { queryClient } from '../lib/queryClient';
import { getErrorStatus } from '../utils/finance';
import { useToast } from './ToastContext';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isSuperAdmin: boolean;
  // SUPER_ADMIN or ADMIN - the "manager" roles that can approve, reject, create and edit
  isAdmin: boolean;
  // EDITOR - read-only access
  isEditor: boolean;
  canApproveKyc: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STAFF_ROLES: string[] = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.EDITOR];

const readStoredToken = () => localStorage.getItem(TOKEN_STORAGE_KEY);

const readStoredUser = (): User | null => {
  try {
    const saved = localStorage.getItem(USER_STORAGE_KEY);
    return saved ? (JSON.parse(saved) as User) : null;
  } catch (e) {
    return null;
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(readStoredUser);
  const [token, setToken] = useState<string | null>(readStoredToken);
  // The stored token is validated once on start-up; without one there is nothing to check
  const [isLoading, setIsLoading] = useState<boolean>(() => !!readStoredToken());
  const isLoggingOut = useRef(false);

  const clearSession = useCallback(() => {
    clearStoredSession();
    setToken(null);
    setUser(null);
  }, []);

  // Validate the stored token so deep links (e.g. /customers/12) survive a refresh
  useEffect(() => {
    if (!readStoredToken()) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    const validate = async () => {
      try {
        const res = await authApi.getMe();
        if (cancelled) return;
        const me = res.data;
        if (!me || !STAFF_ROLES.includes(me.role)) {
          clearSession();
          return;
        }
        setUser(me);
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(me));
      } catch (err) {
        if (cancelled) return;
        const status = getErrorStatus(err);
        // A rejected token ends the session; a network blip keeps the cached user signed in
        if (status === 401 || status === 403 || !readStoredUser()) {
          clearSession();
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    validate();

    return () => {
      cancelled = true;
    };
  }, [clearSession]);

  // The API client raises this exactly once when a request is rejected with 401
  useEffect(() => {
    const handleExpired = () => {
      const wasLoggingOut = isLoggingOut.current;
      clearSession();
      if (!wasLoggingOut) {
        toast.warning('Your session has expired. Please sign in again.', 'Signed out');
      }
    };

    window.addEventListener(SESSION_EXPIRED_EVENT, handleExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleExpired);
  }, [clearSession, toast]);

  const isAuthenticated = !!token && !!user;

  // Drop every cached query when a session ends so the next user never sees stale data
  const wasAuthenticated = useRef(isAuthenticated);
  useEffect(() => {
    if (wasAuthenticated.current && !isAuthenticated) {
      queryClient.clear();
    }
    wasAuthenticated.current = isAuthenticated;
  }, [isAuthenticated]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await authApi.login({ email, password });
    if (!res.success || !res.data) {
      throw new Error(res.message || 'Unable to sign in');
    }

    const { user: userData, accessToken } = res.data;
    if (!STAFF_ROLES.includes(userData.role)) {
      throw new Error('This account does not have access to the admin panel');
    }

    localStorage.setItem(TOKEN_STORAGE_KEY, accessToken);
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userData));
    setUser(userData);
    setToken(accessToken);
  }, []);

  const logout = useCallback(async () => {
    isLoggingOut.current = true;
    try {
      await authApi.logout();
    } catch (e) {
      // The server session may already be gone - the local session is cleared regardless
    } finally {
      clearSession();
      isLoggingOut.current = false;
    }
  }, [clearSession]);

  const value = useMemo<AuthContextType>(() => {
    const isSuperAdmin = user?.role === UserRole.SUPER_ADMIN;
    const isAdmin = isSuperAdmin || user?.role === UserRole.ADMIN;
    const isEditor = user?.role === UserRole.EDITOR;

    return {
      user,
      token,
      isAuthenticated,
      isLoading,
      login,
      logout,
      isSuperAdmin,
      isAdmin,
      isEditor,
      canApproveKyc: isAdmin,
    };
  }, [user, token, isAuthenticated, isLoading, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
