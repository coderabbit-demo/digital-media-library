import { Link } from 'react-router-dom';
import type { MediaType } from '@dml/shared';
import { useHome } from '../services/home';
import { relativeTime } from '../utils/time';

const MEDIA_BADGE: Record<MediaType, string> = {
  book: 'Book',
  music: 'Music',
  audiobook: 'Audiobook',
  podcast: 'Podcast',
};

/**
 * Home left column: the user's own current "currently reading/listening" items,
 * simple counts, and quick links (post an update, open Wishlist). Backed by the
 * local-only `GET /api/home` payload. "Post an update" opens the compose overlay.
 */
export function HomeLeftColumn({ onPostUpdate }: { onPostUpdate: () => void }) {
  const { data, isLoading } = useHome();

  return (
    <div className="home-panel">
      <h2 className="home-panel__title">Currently reading / listening</h2>

      {isLoading ? (
        <p className="home-muted" role="status">
          Loading…
        </p>
      ) : data && data.ownItems.length > 0 ? (
        <ul className="home-own-list">
          {data.ownItems.map((item) => (
            <li key={item.id} className="home-own-item">
              <span className="badge" data-media={item.mediaType}>
                {MEDIA_BADGE[item.mediaType]}
              </span>
              <span className="home-own-item__title">{item.title}</span>
              {item.itemAuthor ? (
                <span className="home-own-item__author">by {item.itemAuthor}</span>
              ) : null}
              <time className="home-muted" dateTime={item.createdAt}>
                {relativeTime(item.createdAt)}
              </time>
            </li>
          ))}
        </ul>
      ) : (
        <p className="home-muted">
          You haven’t shared anything yet. Post what you’re currently reading or listening to.
        </p>
      )}

      <div className="home-counts">
        <span>
          <strong>{data?.counts.currentlyOn ?? 0}</strong> current
        </span>
        <span>
          <strong>{data?.counts.wishlisted ?? 0}</strong> wishlisted
        </span>
      </div>

      <div className="home-quick-links">
        <button type="button" className="btn btn-primary" onClick={onPostUpdate}>
          Post an update
        </button>
        <Link to="/wishlist" className="btn">
          Open Wishlist
        </Link>
      </div>
    </div>
  );
}
