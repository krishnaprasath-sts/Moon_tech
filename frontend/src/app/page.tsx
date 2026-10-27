import { Navbar } from '@/components/layout/Navbar';
import { HeroSection } from '@/components/home/HeroSection';
import { ProgramsSection } from '@/components/home/ProgramsSection';
import { StepsSection } from '@/components/home/StepsSection';
import { FeaturesSection } from '@/components/home/FeaturesSection';
import { FaqSection } from '@/components/home/FaqSection';
import { CtaSection } from '@/components/home/CtaSection';
import { Footer } from '@/components/layout/Footer';
import { ScrollReveal } from '@/components/home/ScrollReveal';

/**
 * Public home page: Clyvus Ventures as a stock market and trading training company. Plans, the
 * calculator and wallet features are only shown after login, and the word "invest" never
 * appears before login.
 */
export default function HomePage() {
  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] flex flex-col justify-between selection:bg-blue-600 selection:text-white transition-colors duration-200">
      <Navbar />

      <main className="flex-1">
        <HeroSection />
        <ProgramsSection />
        <StepsSection />
        <FeaturesSection />
        <FaqSection />
        <CtaSection />
      </main>

      <Footer />
      <ScrollReveal />
    </div>
  );
}
