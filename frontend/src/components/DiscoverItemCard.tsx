import { useState } from 'react';
import type { TrendingItemDTO } from '@dml/shared';
import { useRecommend } from '../services/recommendations';
import { useAddToLibrary, useLibraryKeys, libraryKey } from '../services/library';

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

  const addToLibrary = useAddToLibrary();
  const libraryKeys = useLibraryKeys();
  const [justSaved, setJustSaved] = useState(false);
  const saved = justSaved || libraryKeys.has(libraryKey(item));

  // "I'm reading/listening to this" shelves the item as Currently Reading (the
  // required state change); only once that succeeds do we open the compose overlay
  // to optionally share it.
  const startActivity = () => {
    addToLibrary.mutate(
      { item, shelf: 'current' },
      {
        onSuccess: () => {
          setJustSaved(true);
          onStartActivity(item);
        },
      },
    );
  };

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
        <div className="card-links">
          <button type="button" className="card-link card-link--primary" onClick={startActivity}>
            I’m {verb(item.mediaType)} this
          </button>
          <button
            type="button"
            className="card-link"
            disabled={recommended || recommend.isPending}
            onClick={() => recommend.mutate(item, { onSuccess: () => setRecommended(true) })}
          >
            {recommended ? 'Recommended ✓' : 'Recommend'}
          </button>
          <button
            type="button"
            className="card-link"
            disabled={saved || addToLibrary.isPending}
            onClick={() => addToLibrary.mutate({ item }, { onSuccess: () => setJustSaved(true) })}
          >
            {saved ? 'In Library ✓' : 'Add to Library'}
          </button>
        </div>
      </div>
    </article>
  );
}
