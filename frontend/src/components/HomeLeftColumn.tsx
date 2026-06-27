import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MEDIA_TYPES, type MediaType } from '@dml/shared';
import { useHome } from '../services/home';

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
 * Home left column: the user's "Currently reading/listening" list — their My
 * Library `current` shelf (so it always matches My Library) — with a media-type
 * filter, simple counts, and quick links. Backed by `GET /api/home`.
 */
export function HomeLeftColumn({ onPostUpdate }: { onPostUpdate: () => void }) {
  const { data, isLoading } = useHome();
  const [filter, setFilter] = useState<MediaType | 'all'>('all');

  const items = (data?.current ?? []).filter((i) => filter === 'all' || i.mediaType === filter);

  return (
    <div className="home-panel">
      <h2 className="home-panel__title">Currently reading / listening</h2>

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

      {isLoading ? (
        <p className="home-muted" role="status">
          Loading…
        </p>
      ) : items.length > 0 ? (
        <ul className="home-media-list">
          {items.map((item) => (
            <li key={item.id} className="home-media-item">
              {item.coverUrl ? (
                <img className="home-media-item__cover" src={item.coverUrl} alt="" referrerPolicy="no-referrer" />
              ) : (
                <span className="home-media-item__cover home-media-item__cover--ph" aria-hidden="true">
                  {item.title.charAt(0).toUpperCase()}
                </span>
              )}
              <span className="home-media-item__text">
                <span className="home-media-item__title">{item.title}</span>
                {item.itemAuthor ? (
                  <span className="home-media-item__author">{item.itemAuthor}</span>
                ) : null}
                <span className="badge badge--sm" data-media={item.mediaType}>
                  {MEDIA_BADGE[item.mediaType]}
                </span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="home-muted">
          {filter === 'all'
            ? 'Nothing here yet. Mark something as currently reading/listening from Discover, Search, or My Library.'
            : 'Nothing of this type on your Currently shelf.'}
        </p>
      )}

      <div className="home-counts">
        <span>
          <strong>{data?.counts.currentlyOn ?? 0}</strong> current
        </span>
        <span>
          <strong>{data?.counts.wishlisted ?? 0}</strong> want to read
        </span>
      </div>

      <div className="home-quick-links">
        <button type="button" className="btn btn-primary" onClick={onPostUpdate}>
          Post an update
        </button>
        <Link to="/library" className="btn">
          Open My Library
        </Link>
      </div>
    </div>
  );
}
