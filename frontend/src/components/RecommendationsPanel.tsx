import { useHome } from '../services/home';
import { useRemoveRecommendation } from '../services/recommendations';
import { relativeTime } from '../utils/time';

/**
 * Home right column. Recommendations are user-generated only (feature 004) — never
 * auto-generated picks. The user can remove recommendations they made.
 */
export function RecommendationsPanel() {
  const { data } = useHome();
  const removeRec = useRemoveRecommendation();
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
              {rec.canRemove ? (
                <button
                  type="button"
                  className="btn btn-ghost home-rec-item__remove"
                  disabled={removeRec.isPending}
                  onClick={() => removeRec.mutate(rec.id)}
                >
                  Remove
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
