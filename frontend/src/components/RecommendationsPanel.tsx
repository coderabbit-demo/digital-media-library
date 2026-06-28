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
  const [user, setUser] = useState<string>('all');

  const all = data?.recommendations ?? [];
  const byMedia = all.filter((r) => filter === 'all' || r.mediaType === filter);

  // People who've recommended within the current media filter — derived from the
  // live data, so the list stays in sync as recommendations come and go. A stale
  // selection (after the media filter changes) falls back to "anyone".
  const recommenders = Array.from(new Map(byMedia.map((r) => [r.recommender.id, r.recommender])).values()).sort(
    (a, b) => a.displayName.localeCompare(b.displayName),
  );
  const activeUser = recommenders.some((u) => u.id === user) ? user : 'all';
  const recommendations = byMedia.filter((r) => activeUser === 'all' || r.recommender.id === activeUser);

  return (
    <div className="home-panel">
      <h2 className="home-panel__title">Recommendations</h2>

      <div className="home-filters" role="group" aria-label="Filter by media type">
        <button
          type="button"
          className={`chip chip--sm${filter === 'all' ? ' chip--active' : ''}`}
          aria-pressed={filter === 'all'}
          onClick={() => setFilter('all')}
        >
          All
        </button>
        {MEDIA_TYPES.map((t) => (
          <button
            key={t}
            type="button"
            className={`chip chip--sm${filter === t ? ' chip--active' : ''}`}
            aria-pressed={filter === t}
            onClick={() => setFilter(t)}
          >
            {TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      {recommenders.length > 1 ? (
        <label className="home-rec-userfilter">
          <span className="sr-only">Filter recommendations by person</span>
          <select value={activeUser} onChange={(e) => setUser(e.target.value)}>
            <option value="all">Anyone</option>
            {recommenders.map((u) => (
              <option key={u.id} value={u.id}>
                {u.displayName}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {all.length === 0 ? (
        <p className="home-muted">
          No recommendations yet. When people recommend books, music, audiobooks, and
          podcasts, they’ll show up here.
        </p>
      ) : recommendations.length === 0 ? (
        <p className="home-muted">No recommendations match these filters.</p>
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
