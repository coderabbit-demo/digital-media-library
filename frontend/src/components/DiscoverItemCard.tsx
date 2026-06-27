import type { TrendingItemDTO } from '@dml/shared';

/** Verb for the "start an activity" CTA based on media type. */
function verb(mediaType: TrendingItemDTO['mediaType']): string {
  return mediaType === 'book' ? 'reading' : 'listening to';
}

interface DiscoverItemCardProps {
  item: TrendingItemDTO;
  onStartActivity: (item: TrendingItemDTO) => void;
}

/**
 * A single trending item: cover (or initial placeholder), title, creator, and a
 * "start an activity" action. All provider-sourced text renders as plain text.
 */
export function DiscoverItemCard({ item, onStartActivity }: DiscoverItemCardProps) {
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
        <button
          type="button"
          className="btn btn-primary discover-card__cta"
          onClick={() => onStartActivity(item)}
        >
          I’m {verb(item.mediaType)} this
        </button>
      </div>
    </article>
  );
}
