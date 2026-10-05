import React from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { HeroSection } from '@/components/home/HeroSection';
import { PlansGrid } from '@/components/home/PlansGrid';
import { StepsSection } from '@/components/home/StepsSection';
import { FeaturesSection } from '@/components/home/FeaturesSection';
import { EarningCalculator } from '@/components/calculator/EarningCalculator';
import { Footer } from '@/components/layout/Footer';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] flex flex-col justify-between selection:bg-blue-600 selection:text-white transition-colors duration-200">
      {/* Top Navigation */}
      <Navbar />

      <main className="flex-1">
        {/* 1. Hero with Glow & 3D Visual */}
        <HeroSection />

        {/* 2. Investment Plans Grid */}
        <PlansGrid />

        {/* 3. Steps to Start Earning */}
        <StepsSection />

        {/* 4. Interactive Calculator Showcase */}
        <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <EarningCalculator />
        </section>

        {/* 5. Features & Security */}
        <FeaturesSection />
      </main>

      {/* Platform Footer */}
      <Footer />
    </div>
  );
}
