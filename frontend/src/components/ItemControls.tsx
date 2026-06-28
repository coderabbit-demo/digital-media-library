import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { SHELVES, type Shelf, type TrendingItemDTO } from '@dml/shared';
import { useAddToLibrary, useLibraryShelves, libraryKey, shelfLabel } from '../services/library';
import { useRecommend } from '../services/recommendations';
import { useRatings, useSetRating, useClearRating, ratingKey } from '../services/ratings';
import { itemQueryKey } from '../services/item';

/** "I'm currently reading/listening to this" verb per media type. */
function verb(mediaType: TrendingItemDTO['mediaType']): string {
  return mediaType === 'book' ? 'reading' : 'listening to';
}

interface ItemControlsProps {
  item: TrendingItemDTO;
  /** Opens the compose overlay pre-filled (the share bridge). */
  onStartActivity: (item: TrendingItemDTO) => void;
}

/**
 * The shared item action cluster (feature 007): shelf dropdown, "I'm
 * reading/listening to this" + share bridge, Recommend, and a 1–5 star rating
 * (re-clicking the active star clears it). Used on the item detail page; reuses
 * the same service hooks as the cards so behavior stays identical.
 */
export function ItemControls({ item, onStartActivity }: ItemControlsProps) {
  const addToLibrary = useAddToLibrary();
  const shelves = useLibraryShelves();
  const shelfValue: Shelf | '' = shelves.get(libraryKey(item)) ?? '';

  const recommend = useRecommend();
  const [recommended, setRecommended] = useState(false);

  const ratings = useRatings();
  const setRating = useSetRating();
  const clearRating = useClearRating();
  const myRating = ratings.get(ratingKey(item)) ?? 0;

  // After any action, refresh the item query so the community sections
  // (shelf counts, rating average/count) reflect the change, not just the
  // personal controls fed by the library/ratings caches.
  const qc = useQueryClient();
  const refreshItem = () => {
    void qc.invalidateQueries({ queryKey: itemQueryKey(item.mediaType, item.providerId) });
  };

  const setShelf = (shelf: Shelf) => {
    addToLibrary.mutate(
      { item, shelf },
      {
        onSuccess: () => {
          refreshItem();
          if (shelf === 'current') onStartActivity(item);
        },
      },
    );
  };

  const startActivity = () => {
    if (addToLibrary.isPending) return;
    addToLibrary.mutate(
      { item, shelf: 'current' },
      {
        onSuccess: () => {
          refreshItem();
          onStartActivity(item);
        },
      },
    );
  };

  const rate = (stars: number) => {
    if (stars === myRating)
      clearRating.mutate({ mediaType: item.mediaType, providerId: item.providerId }, { onSuccess: refreshItem });
    else
      setRating.mutate(
        {
          mediaType: item.mediaType,
          providerId: item.providerId,
          stars,
          title: item.title,
          creator: item.creator,
          coverUrl: item.coverUrl,
        },
        { onSuccess: refreshItem },
      );
  };

  return (
    <div className="item-controls">
      <div className="item-rating" role="group" aria-label={`Rate ${item.title}`}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            className={`star${n <= myRating ? ' star--on' : ''}`}
            aria-label={`${n} star${n > 1 ? 's' : ''}`}
            aria-pressed={n === myRating}
            disabled={setRating.isPending || clearRating.isPending}
            onClick={() => rate(n)}
          >
            ★
          </button>
        ))}
        <span className="item-rating__label home-muted">
          {myRating > 0 ? 'Your rating' : 'Rate this'}
        </span>
      </div>

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

      <div className="item-controls__actions">
        <button
          type="button"
          className="btn btn-primary"
          onClick={startActivity}
          disabled={addToLibrary.isPending}
        >
          I’m {verb(item.mediaType)} this
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={recommended || recommend.isPending}
          onClick={() =>
            recommend.mutate(item, {
              onSuccess: () => {
                setRecommended(true);
                refreshItem();
              },
            })
          }
        >
          {recommended ? 'Recommended ✓' : 'Recommend'}
        </button>
      </div>
    </div>
  );
}
