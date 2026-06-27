import heroImage from '../assets/hero.jpg';
import { FeedList } from '../components/FeedList';
import { PostUpdateForm } from '../components/PostUpdateForm';
import { HomeLeftColumn } from '../components/HomeLeftColumn';
import { RecommendationsPanel } from '../components/RecommendationsPanel';

/**
 * Three-column home page (FR-003): left = the user's own current items, counts,
 * and quick links; center = a hero banner above the compose form and the
 * community feed; right = recommendations (empty in this feature). Each region
 * renders independently and the columns stack on narrow viewports.
 */
export function HomeFeed() {
  return (
    <div className="home-grid">
      <aside className="home-col home-col--left" aria-label="Your activity">
        <HomeLeftColumn />
      </aside>

      <section className="home-col home-col--center" aria-label="Community feed">
        <img className="home-hero" src={heroImage} alt="" />
        <PostUpdateForm />
        <FeedList />
      </section>

      <aside className="home-col home-col--right" aria-label="Recommendations">
        <RecommendationsPanel />
      </aside>
    </div>
  );
}
