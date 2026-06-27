import { useState } from 'react';
import { MEDIA_TYPES, SHELVES, type MediaType, type Shelf, type LibraryItemDTO } from '@dml/shared';
import {
  useLibrary,
  useMoveShelf,
  useRemoveFromLibrary,
  SHELF_TAB_LABELS,
  shelfLabel,
} from '../services/library';
import { ComposeDialog } from '../components/ComposeDialog';
import type { ComposeInitial } from '../components/PostUpdateForm';

const TYPE_LABELS: Record<MediaType, string> = {
  book: 'Books',
  music: 'Music',
  audiobook: 'Audiobooks',
  podcast: 'Podcasts',
};

const verb = (m: MediaType) => (m === 'book' ? 'reading' : 'listening to');

/**
 * "My Library": the user's private collection organized into Goodreads-style
 * shelves (Want to Read · Currently Reading · Read · Did Not Finish), with an
 * "All" view and a secondary media-type filter. Each item can be moved between
 * shelves, removed, or seed a "currently reading/listening" activity. Moving an
 * item to Currently Reading offers to share it to the feed (the 001 bridge).
 */
export function Library() {
  const [shelf, setShelf] = useState<Shelf | 'all'>('all');
  const [mediaType, setMediaType] = useState<MediaType | 'all'>('all');
  const [compose, setCompose] = useState<ComposeInitial | null>(null);

  const { data, isLoading, isError, refetch } = useLibrary({
    shelf: shelf === 'all' ? undefined : shelf,
    mediaType: mediaType === 'all' ? undefined : mediaType,
  });
  const move = useMoveShelf();
  const remove = useRemoveFromLibrary();

  const startActivity = (item: LibraryItemDTO) =>
    setCompose({ mediaType: item.mediaType, title: item.title, itemAuthor: item.itemAuthor ?? undefined });

  const onMove = (item: LibraryItemDTO, next: Shelf) => {
    if (next === item.shelf) return;
    move.mutate(
      { id: item.id, shelf: next },
      {
        // Bridge: moving to Currently Reading offers to share an update to the feed.
        onSuccess: () => {
          if (next === 'current') startActivity(item);
        },
      },
    );
  };

  const items = data?.items ?? [];

  return (
    <div className="discover-page">
      <h1 className="discover-page__title">My Library</h1>

      <div className="wishlist-filters" role="tablist" aria-label="Shelves">
        <button type="button" className={`chip${shelf === 'all' ? ' chip--active' : ''}`} onClick={() => setShelf('all')}>
          All
        </button>
        {SHELVES.map((s) => (
          <button key={s} type="button" className={`chip${shelf === s ? ' chip--active' : ''}`} onClick={() => setShelf(s)}>
            {SHELF_TAB_LABELS[s]}
          </button>
        ))}
      </div>

      <div className="wishlist-filters" aria-label="Filter by media type">
        <button type="button" className={`chip${mediaType === 'all' ? ' chip--active' : ''}`} onClick={() => setMediaType('all')}>
          All media
        </button>
        {MEDIA_TYPES.map((t) => (
          <button key={t} type="button" className={`chip${mediaType === t ? ' chip--active' : ''}`} onClick={() => setMediaType(t)}>
            {TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="feed-status" role="status">
          Loading your library…
        </p>
      ) : isError ? (
        <div className="feed-status feed-status--error" role="alert">
          <p>We couldn’t load your library.</p>
          <button type="button" className="btn" onClick={() => void refetch()}>
            Try again
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="feed-empty">
          <h2>Nothing here yet</h2>
          <p>Add items from Discover or Search, then organize them across your shelves.</p>
        </div>
      ) : (
        <div className="discover-grid">
          {items.map((item) => (
            <article key={item.id} className="discover-card">
              {item.coverUrl ? (
                <img className="discover-card__cover" src={item.coverUrl} alt="" referrerPolicy="no-referrer" />
              ) : (
                <div className="discover-card__cover discover-card__cover--placeholder" aria-hidden="true">
                  {item.title.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="discover-card__body">
                <p className="discover-card__title">{item.title}</p>
                {item.itemAuthor ? <p className="discover-card__creator">{item.itemAuthor}</p> : null}
                <div className="discover-card__actions">
                  <label className="library-shelf-select">
                    <span className="sr-only">Shelf for {item.title}</span>
                    <select
                      value={item.shelf}
                      disabled={move.isPending}
                      onChange={(e) => onMove(item, e.target.value as Shelf)}
                    >
                      {SHELVES.map((s) => (
                        <option key={s} value={s}>
                          {shelfLabel(s, item.mediaType)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button type="button" className="btn btn-primary discover-card__cta" onClick={() => startActivity(item)}>
                    I’m {verb(item.mediaType)} this
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost discover-card__wishlist"
                    disabled={remove.isPending}
                    onClick={() => remove.mutate(item.id)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <ComposeDialog open={compose !== null} initial={compose ?? undefined} onClose={() => setCompose(null)} />
    </div>
  );
}
