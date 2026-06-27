import { useHome } from '../services/home';
import { relativeTime } from '../utils/time';

/**
 * Home right column. Recommendations are user-generated only (feature 004); in
 * feature 002 this is always empty and shows an inviting empty state — never
 * auto-generated picks.
 */
export function RecommendationsPanel() {
  const { data } = useHome();
  const recommendations = data?.recommendations ?? [];

  return (
    <div className="home-panel">
      <h2 className="home-panel__title">Recommendations</h2>

      {recommendations.length === 0 ? (
        <p className="home-muted">
          No recommendations yet. When people recommend books, music, audiobooks, and
          podcasts, they’ll show up here.
        </p>
      ) : (
        <ul className="home-rec-list">
          {recommendations.map((rec) => (
            <li key={rec.id} className="home-rec-item">
              <span className="home-own-item__title">{rec.title}</span>
              {rec.itemAuthor ? (
                <span className="home-own-item__author">by {rec.itemAuthor}</span>
              ) : null}
              <span className="home-muted">
                {rec.recommender.displayName} · {relativeTime(rec.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
