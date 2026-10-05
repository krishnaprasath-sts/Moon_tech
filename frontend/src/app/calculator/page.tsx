import React from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { EarningCalculator } from '@/components/calculator/EarningCalculator';
import { FloatingSupport } from '@/components/layout/FloatingSupport';

export default function CalculatorPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] flex flex-col justify-between selection:bg-blue-600 selection:text-white transition-colors duration-200">
      <Navbar />

      <main className="flex-1 py-14 sm:py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        {/* Ambient Subtle Glow */}
        <div className="relative">
          <div className="ambient-glow absolute -top-12 left-1/2 -translate-x-1/2 w-96 h-48 blur-[100px] pointer-events-none" />
          <EarningCalculator />
        </div>
      </main>

      <FloatingSupport />
      <Footer />
    </div>
  );
}
