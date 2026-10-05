"use client";

import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { AUTH_CHANGE_EVENT, AuthUser, clearSession, loginUrl } from '@/lib/api';

/** Fired on this window after `writeStoredItem` so subscribed components re-read localStorage. */
const STORAGE_CHANGE_EVENT = 'moontech-storage-change';

function subscribe(onChange: () => void) {
  window.addEventListener('storage', onChange);
  window.addEventListener(AUTH_CHANGE_EVENT, onChange);
  window.addEventListener(STORAGE_CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(AUTH_CHANGE_EVENT, onChange);
    window.removeEventListener(STORAGE_CHANGE_EVENT, onChange);
  };
}

const subscribeNoop = () => () => {};

function readItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

const getToken = () => readItem('accessToken');
const getUserJson = () => readItem('user');
const getServerValue = () => null;

function parseUser(json: string | null): AuthUser | null {
  if (!json) return null;
  try {
    const parsed: unknown = JSON.parse(json);
    if (parsed && typeof parsed === 'object' && 'email' in parsed) return parsed as AuthUser;
    return null;
  } catch {
    return null;
  }
}

/** Call after storing a new session so mounted components pick it up. */
export function notifyAuthChange() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
}

/** True once the component has mounted in the browser (false during server render and hydration). */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribeNoop, () => true, () => false);
}

/**
 * Hydration-safe read of a localStorage key: `null` on the server and during
 * hydration, then the stored value. Re-renders after `writeStoredItem`.
 */
export function useStoredItem(key: string): string | null {
  const getSnapshot = useCallback(() => readItem(key), [key]);
  return useSyncExternalStore(subscribe, getSnapshot, getServerValue);
}

/** Writes (or removes, with `null`) a localStorage key and notifies `useStoredItem` subscribers. */
export function writeStoredItem(key: string, value: string | null): boolean {
  let stored = false;
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
    stored = true;
  } catch {
    // Storage may be blocked (private mode, quota); callers fall back to in-memory state
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(STORAGE_CHANGE_EVENT));
  return stored;
}

interface UseAuthOptions {
  /** Redirect visitors without a session to /login?redirect=<current path>. Default: true. */
  required?: boolean;
}

export interface AuthState {
  token: string | null;
  user: AuthUser | null;
  /** True until the browser session has been read (always true during server render). */
  loading: boolean;
  logout: () => void;
}

export function useAuth(options: UseAuthOptions = {}): AuthState {
  const required = options.required ?? true;
  const router = useRouter();

  const hydrated = useHydrated();
  const token = useSyncExternalStore(subscribe, getToken, getServerValue);
  const userJson = useSyncExternalStore(subscribe, getUserJson, getServerValue);
  const user = useMemo(() => parseUser(userJson), [userJson]);

  useEffect(() => {
    if (!required || !hydrated || token) return;
    const { pathname, search } = window.location;
    router.replace(loginUrl(`${pathname}${search}`));
  }, [required, hydrated, token, router]);

  const logout = useCallback(() => {
    // Clears accessToken + user and notifies every mounted subscriber (navbar badge, pages)
    clearSession();
    router.replace('/login');
  }, [router]);

  return { token: hydrated ? token : null, user: hydrated ? user : null, loading: !hydrated, logout };
}
