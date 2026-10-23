"use client";

import React from 'react';
import { useAuth } from '@/lib/useAuth';
import { FullPageMessage } from '@/components/ui/primitives';

/**
 * Renders its children only for a signed-in customer; visitors are sent to /login with a
 * redirect back here. Used on the investment pages, which are not public.
 */
export function RequireAuth({ children, message = 'Loading...' }: { children: React.ReactNode; message?: string }) {
  const { token, loading } = useAuth();
  if (loading || !token) return <FullPageMessage>{message}</FullPageMessage>;
  return <>{children}</>;
}
