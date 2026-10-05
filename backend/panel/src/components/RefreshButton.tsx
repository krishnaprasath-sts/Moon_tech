import React from 'react';
import { RotateCw } from 'lucide-react';
import { btnSecondaryClass } from './ui';

interface RefreshButtonProps {
  onClick: () => void;
  isFetching?: boolean;
  label?: string;
}

export const RefreshButton: React.FC<RefreshButtonProps> = ({ onClick, isFetching = false, label = 'Refresh' }) => (
  <button type="button" onClick={onClick} disabled={isFetching} className={btnSecondaryClass}>
    <RotateCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
    <span>{label}</span>
  </button>
);
