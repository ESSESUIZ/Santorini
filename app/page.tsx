import { SiteNav } from '../components/SiteNav';
import { InstagramContact } from '../components/InstagramContact';
import { HomeHeroCarousel } from '../components/HomeHeroCarousel';

export default function Home() {
  return <main className="home-page">
    <SiteNav />
    <div className="home-story">
      <HomeHeroCarousel />
      <InstagramContact continuous />
    </div>
  </main>;
}
