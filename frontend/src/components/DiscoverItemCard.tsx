import { useState } from 'react';
import type { TrendingItemDTO } from '@dml/shared';
import { useRecommend } from '../services/recommendations';
import { useAddToWishlist, useWishlistKeys, wishlistKey } from '../services/wishlist';

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
 * and actions to recommend it or start an activity. All provider-sourced text
 * renders as plain text.
 */
export function DiscoverItemCard({ item, onStartActivity }: DiscoverItemCardProps) {
  const recommend = useRecommend();
  const [recommended, setRecommended] = useState(false);

  const addToWishlist = useAddToWishlist();
  const wishlistKeys = useWishlistKeys();
  const [justSaved, setJustSaved] = useState(false);
  const saved = justSaved || wishlistKeys.has(wishlistKey(item));

  return (
    <article className="discover-card">
      {item.coverUrl ? (
        <img className="discover-card__cover" src={item.coverUrl} alt="" referrerPolicy="no-referrer" />
      ) : (
        <div className="discover-card__cover discover-card__cover--placeholder" aria-hidden="true">
          {item.title.charAt(0).toUpperCase()}
        </div>
      )}
      <div className="discover-card__body">
        <p className="discover-card__title">{item.title}</p>
        {item.creator ? <p className="discover-card__creator">{item.creator}</p> : null}
        <div className="discover-card__actions">
          <button
            type="button"
            className="btn btn-primary discover-card__cta"
            onClick={() => onStartActivity(item)}
          >
            I’m {verb(item.mediaType)} this
          </button>
          <button
            type="button"
            className="btn btn-ghost discover-card__recommend"
            disabled={recommended || recommend.isPending}
            onClick={() =>
              recommend.mutate(item, { onSuccess: () => setRecommended(true) })
            }
          >
            {recommended ? 'Recommended ✓' : 'Recommend'}
          </button>
          <button
            type="button"
            className="btn btn-ghost discover-card__wishlist"
            disabled={saved || addToWishlist.isPending}
            onClick={() => addToWishlist.mutate(item, { onSuccess: () => setJustSaved(true) })}
          >
            {saved ? 'Wishlisted ✓' : 'Add to Wishlist'}
          </button>
        </div>
      </div>
    </article>
  );
}
