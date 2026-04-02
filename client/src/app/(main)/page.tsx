import HeroBanner from '@/components/main/HeroBanner';
import PopularCities from '@/components/main/PopularCities';
import ExchangeRate from '@/components/main/ExchangeRate';
import Community from '@/components/main/Community';
import FAQ from '@/components/main/FAQ';

export default function Home() {
  return (
    <main>
      <HeroBanner />
      <PopularCities />
      <ExchangeRate />
      <Community />
      <FAQ />
    </main>
  );
}
