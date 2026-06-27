import { useState } from 'react';
import heroImage from '../assets/hero.jpg';
import { FeedList } from '../components/FeedList';
import { ComposeDialog } from '../components/ComposeDialog';
import { HomeLeftColumn } from '../components/HomeLeftColumn';
import { RecommendationsPanel } from '../components/RecommendationsPanel';

/**
 * Three-column home page (FR-003): left = the user's own current items, counts,
 * and quick links; center = a hero banner above the community feed; right =
 * recommendations (empty in this feature). Composing an update opens an overlay
 * (the "Post an update" action in the left column). Columns stack on narrow
 * viewports.
 */
export function HomeFeed() {
  const [composeOpen, setComposeOpen] = useState(false);

  return (
    <div className="home-grid">
      <aside className="home-col home-col--left" aria-label="Your activity">
        <HomeLeftColumn onPostUpdate={() => setComposeOpen(true)} />
      </aside>

      <section className="home-col home-col--center" aria-label="Community feed">
        <img className="home-hero" src={heroImage} alt="" />
        <FeedList />
      </section>

      <aside className="home-col home-col--right" aria-label="Recommendations">
        <RecommendationsPanel />
      </aside>

      <ComposeDialog open={composeOpen} onClose={() => setComposeOpen(false)} />
    </div>
  );
}
