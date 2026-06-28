import { useState } from 'react';
import { SHELVES, type Shelf, type TrendingItemDTO } from '@dml/shared';
import { useRecommend } from '../services/recommendations';
import { useAddToLibrary, useLibraryShelves, libraryKey, shelfLabel } from '../services/library';
import { ItemLink } from './ItemLink';

/** Verb for the "start an activity" CTA based on media type. */
function verb(mediaType: TrendingItemDTO['mediaType']): string {
  return mediaType === 'book' ? 'reading' : 'listening to';
}

interface DiscoverItemCardProps {
  item: TrendingItemDTO;
  onStartActivity: (item: TrendingItemDTO) => void;
}

/**
 * A single trending/search item: cover (or initial placeholder), title, creator,
 * and the same controls as a My Library card — a shelf dropdown, a "currently
 * reading/listening" primary action, and a recommend action. All provider-sourced
 * text renders as plain text.
 */
export function DiscoverItemCard({ item, onStartActivity }: DiscoverItemCardProps) {
  const recommend = useRecommend();
  const [recommended, setRecommended] = useState(false);

  const addToLibrary = useAddToLibrary();
  const shelves = useLibraryShelves();
  const shelfValue: Shelf | '' = shelves.get(libraryKey(item)) ?? '';

  // Picking a shelf adds/moves the item there. Choosing Currently Reading also
  // offers to share it (the same bridge as My Library).
  const setShelf = (shelf: Shelf) => {
    addToLibrary.mutate(
      { item, shelf },
      { onSuccess: () => shelf === 'current' && onStartActivity(item) },
    );
  };

  // "I'm reading/listening to this" shelves the item as Currently Reading (the
  // required state change); only once that succeeds do we open the compose overlay
  // to optionally share it.
  const startActivity = () => {
    if (addToLibrary.isPending) return;
    addToLibrary.mutate({ item, shelf: 'current' }, { onSuccess: () => onStartActivity(item) });
  };

  return (
    <article className="discover-card">
      <ItemLink mediaType={item.mediaType} providerId={item.providerId} className="discover-card__cover-link">
        {item.coverUrl ? (
          <img className="discover-card__cover" src={item.coverUrl} alt="" referrerPolicy="no-referrer" />
        ) : (
          <div className="discover-card__cover discover-card__cover--placeholder" aria-hidden="true">
            {item.title.charAt(0).toUpperCase()}
          </div>
        )}
      </ItemLink>
      <div className="discover-card__body">
        <p className="discover-card__title">
          <ItemLink mediaType={item.mediaType} providerId={item.providerId} className="item-titlelink">
            {item.title}
          </ItemLink>
        </p>
        {item.creator ? <p className="discover-card__creator">{item.creator}</p> : null}
        <div className="discover-card__actions">
          <label className="library-shelf-select">
            <span className="sr-only">Shelf for {item.title}</span>
            <select
              value={shelfValue}
              disabled={addToLibrary.isPending}
              onChange={(e) => setShelf(e.target.value as Shelf)}
            >
              <option value="" disabled>
                Add to shelf…
              </option>
              {SHELVES.map((s) => (
                <option key={s} value={s}>
                  {shelfLabel(s, item.mediaType)}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="btn btn-primary discover-card__cta"
            onClick={startActivity}
            disabled={addToLibrary.isPending}
          >
            I’m {verb(item.mediaType)} this
          </button>
          <button
            type="button"
            className="btn btn-ghost discover-card__wishlist"
            disabled={recommended || recommend.isPending}
            onClick={() => recommend.mutate(item, { onSuccess: () => setRecommended(true) })}
          >
            {recommended ? 'Recommended ✓' : 'Recommend'}
          </button>
        </div>
      </div>
    </article>
  );
}
