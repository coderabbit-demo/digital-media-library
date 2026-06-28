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

  const openCompose = (item: LibraryItemDTO) =>
    setCompose({
      mediaType: item.mediaType,
      title: item.title,
      itemAuthor: item.itemAuthor ?? undefined,
      coverUrl: item.coverUrl,
      providerId: item.providerId,
      description: item.description,
      providerUrl: item.providerUrl,
    });

  const onMove = (item: LibraryItemDTO, next: Shelf) => {
    if (next === item.shelf) return;
    move.mutate(
      { id: item.id, shelf: next },
      {
        // Bridge: moving to Currently Reading offers to share an update to the feed.
        onSuccess: () => {
          if (next === 'current') openCompose(item);
        },
      },
    );
  };

  // "I'm reading/listening to this": move onto the Currently Reading shelf (the
  // required state change), then open the compose overlay to optionally share an
  // update. If already on that shelf, just open compose.
  const markCurrent = (item: LibraryItemDTO) => {
    if (item.shelf === 'current') {
      openCompose(item);
      return;
    }
    move.mutate({ id: item.id, shelf: 'current' }, { onSuccess: () => openCompose(item) });
  };

  const items = data?.items ?? [];

  const renderCard = (item: LibraryItemDTO) => (
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
            <select value={item.shelf} disabled={move.isPending} onChange={(e) => onMove(item, e.target.value as Shelf)}>
              {SHELVES.map((s) => (
                <option key={s} value={s}>
                  {shelfLabel(s, item.mediaType)}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="btn btn-primary discover-card__cta" onClick={() => markCurrent(item)}>
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
  );

  // "All" view reads as a Goodreads-style collection: items grouped into shelf
  // sections (active shelves first), each with a count. A specific shelf shows a
  // flat grid, since the chosen filter chip already names it.
  const SECTION_ORDER: Shelf[] = ['current', 'want', 'done', 'dnf'];
  const sections = SECTION_ORDER.map((s) => ({ shelf: s, items: items.filter((i) => i.shelf === s) })).filter(
    (g) => g.items.length > 0,
  );

  return (
    <div className="discover-page">
      <div className="library-header">
        <h1 className="discover-page__title">My Library</h1>
        {!isLoading && !isError ? (
          <span className="library-header__count">
            {items.length} {items.length === 1 ? 'item' : 'items'}
          </span>
        ) : null}
      </div>

      <div className="library-filters">
        <div className="filter-row">
          <span className="filter-row__label" id="lib-shelf-label">
            Shelf
          </span>
          <div className="wishlist-filters" role="group" aria-labelledby="lib-shelf-label">
            <button
              type="button"
              className={`chip${shelf === 'all' ? ' chip--active' : ''}`}
              aria-pressed={shelf === 'all'}
              onClick={() => setShelf('all')}
            >
              All
            </button>
            {SHELVES.map((s) => (
              <button
                key={s}
                type="button"
                className={`chip${shelf === s ? ' chip--active' : ''}`}
                aria-pressed={shelf === s}
                onClick={() => setShelf(s)}
              >
                {SHELF_TAB_LABELS[s]}
              </button>
            ))}
          </div>
        </div>

        <div className="filter-row">
          <span className="filter-row__label" id="lib-media-label">
            Media
          </span>
          <div className="wishlist-filters" role="group" aria-labelledby="lib-media-label">
            <button
              type="button"
              className={`chip${mediaType === 'all' ? ' chip--active' : ''}`}
              aria-pressed={mediaType === 'all'}
              onClick={() => setMediaType('all')}
            >
              All
            </button>
            {MEDIA_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                className={`chip${mediaType === t ? ' chip--active' : ''}`}
                aria-pressed={mediaType === t}
                onClick={() => setMediaType(t)}
              >
                {TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>
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
      ) : shelf === 'all' ? (
        sections.map((group) => (
          <section key={group.shelf} className="library-section" aria-label={SHELF_TAB_LABELS[group.shelf]}>
            <h2 className="library-section__title">
              {SHELF_TAB_LABELS[group.shelf]}
              <span className="library-section__count">{group.items.length}</span>
            </h2>
            <div className="discover-grid">{group.items.map(renderCard)}</div>
          </section>
        ))
      ) : (
        <div className="discover-grid">{items.map(renderCard)}</div>
      )}

      <ComposeDialog open={compose !== null} initial={compose ?? undefined} onClose={() => setCompose(null)} />
    </div>
  );
}
