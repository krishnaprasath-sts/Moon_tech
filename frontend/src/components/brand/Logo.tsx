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
      {/* Modern Minimalist MoonTech Geometric Emblem */}
      <div className={`relative ${iconSizes[size]} flex items-center justify-center flex-shrink-0`}>
        <div className="absolute inset-0 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 opacity-80 blur-xs group-hover:opacity-100 transition duration-300" />
        <div className="relative w-full h-full rounded-xl bg-zinc-950 dark:bg-[#09090b] border border-zinc-700/50 dark:border-white/10 flex items-center justify-center p-1.5 shadow-xs">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className="w-full h-full text-blue-500 group-hover:text-blue-400 transition duration-300"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {/* Minimalist modern crescent moon + node fusion */}
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" fill="currentColor" fillOpacity="0.18" />
            <circle cx="16.5" cy="7.5" r="1.5" fill="currentColor" />
          </svg>
        </div>
      </div>

      <div className="flex flex-col">
        <div className="flex items-center gap-1.5 leading-none">
          <span className={`font-bold tracking-tight text-zinc-950 dark:text-white transition-colors ${textSizes[size]}`}>
            MoonTech
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/20">
            Invest
          </span>
        </div>
      </div>
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
