import { useState } from 'react';
import { MEDIA_TYPES, type MediaType } from '@dml/shared';
import { useHome } from '../services/home';
import { useRemoveRecommendation } from '../services/recommendations';
import { relativeTime } from '../utils/time';

const MEDIA_BADGE: Record<MediaType, string> = {
  book: 'Book',
  music: 'Music',
  audiobook: 'Audiobook',
  podcast: 'Podcast',
};

const TYPE_LABELS: Record<MediaType, string> = {
  book: 'Books',
  music: 'Music',
  audiobook: 'Audiobooks',
  podcast: 'Podcasts',
};

/**
 * Home right column. Recommendations are user-generated only (feature 004) — never
 * auto-generated picks. Each shows a media-type badge and cover; the list can be
 * filtered by media type, and the user can remove recommendations they made.
 */
export function RecommendationsPanel() {
  const { data } = useHome();
  const removeRec = useRemoveRecommendation();
  const [filter, setFilter] = useState<MediaType | 'all'>('all');

  const all = data?.recommendations ?? [];
  const recommendations = all.filter((r) => filter === 'all' || r.mediaType === filter);

  return (
    <div className="home-panel">
      <h2 className="home-panel__title">Recommendations</h2>

      <div className="home-filters" role="tablist" aria-label="Filter by media type">
        <button
          type="button"
          className={`chip chip--sm${filter === 'all' ? ' chip--active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All
        </button>
        {MEDIA_TYPES.map((t) => (
          <button
            key={t}
            type="button"
            className={`chip chip--sm${filter === t ? ' chip--active' : ''}`}
            onClick={() => setFilter(t)}
          >
            {TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      {all.length === 0 ? (
        <p className="home-muted">
          No recommendations yet. When people recommend books, music, audiobooks, and
          podcasts, they’ll show up here.
        </p>
      ) : recommendations.length === 0 ? (
        <p className="home-muted">No {TYPE_LABELS[filter as MediaType].toLowerCase()} recommendations yet.</p>
      ) : (
        <ul className="home-media-list">
          {recommendations.map((rec) => (
            <li key={rec.id} className="home-media-item">
              {rec.coverUrl ? (
                <img className="home-media-item__cover" src={rec.coverUrl} alt="" referrerPolicy="no-referrer" />
              ) : (
                <span className="home-media-item__cover home-media-item__cover--ph" aria-hidden="true">
                  {rec.title.charAt(0).toUpperCase()}
                </span>
              )}
              <span className="home-media-item__text">
                <span className="home-media-item__title">{rec.title}</span>
                {rec.itemAuthor ? <span className="home-media-item__author">{rec.itemAuthor}</span> : null}
                <span className="badge badge--sm" data-media={rec.mediaType}>
                  {MEDIA_BADGE[rec.mediaType]}
                </span>
                <span className="home-muted home-media-item__meta">
                  {rec.recommender.displayName} · {relativeTime(rec.createdAt)}
                </span>
                {rec.canRemove ? (
                  <button
                    type="button"
                    className="card-link home-rec-item__remove"
                    disabled={removeRec.isPending}
                    onClick={() => removeRec.mutate(rec.id)}
                  >
                    Remove
                  </button>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
