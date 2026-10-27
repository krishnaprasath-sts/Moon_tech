import React from 'react';
import Link from 'next/link';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  withoutLink?: boolean;
}

export const Logo: React.FC<LogoProps> = ({ className = '', size = 'md', withoutLink = false }) => {
  const iconSizes = {
    sm: 'w-7 h-7',
    md: 'w-8 h-8',
    lg: 'w-10 h-10',
  };

  const textSizes = {
    sm: 'text-base',
    md: 'text-lg',
    lg: 'text-xl',
  };

  const content = (
    <>
      {/* Clyvus Ventures emblem: a rising trend line inside a rounded tile */}
      <div className={`relative ${iconSizes[size]} flex items-center justify-center flex-shrink-0`}>
        <div className="absolute inset-0 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 opacity-80 blur-xs group-hover:opacity-100 transition duration-300" />
        <div className="relative w-full h-full rounded-xl bg-zinc-950 dark:bg-[#09090b] border border-zinc-700/50 dark:border-white/10 flex items-center justify-center p-1.5 shadow-xs">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className="w-full h-full text-blue-500 group-hover:text-blue-400 transition duration-300"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            {/* Upward trend with a highlighted final point */}
            <path d="M4 17.5 9.5 12l3.5 3.5L20 8" />
            <path d="M15 8h5v5" />
            <circle cx="20" cy="8" r="1.6" fill="currentColor" />
          </svg>
        </div>
      </div>

      <span
        className={`font-bold tracking-tight leading-none whitespace-nowrap text-zinc-950 dark:text-white transition-colors ${textSizes[size]}`}
      >
        Clyvus Ventures
      </span>
    </>
  );

  if (withoutLink) {
    return (
      <div className={`inline-flex items-center gap-2.5 group select-none ${className}`}>
        {content}
      </div>
    );
  }

  return (
    <Link href="/" className={`inline-flex items-center gap-2.5 group ${className}`}>
      {content}
    </Link>
  );
};
