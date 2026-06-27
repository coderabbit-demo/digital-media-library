import { useState } from 'react';
import { SHELVES, type ActivityDTO, type MediaType, type Shelf, type TrendingItemDTO } from '@dml/shared';
import { relativeTime } from '../utils/time';
import { ReplyThread } from './ReplyThread';
import { useAddToLibrary, useLibraryShelves, libraryKey, shelfLabel } from '../services/library';

/** "X is currently reading / listening to …" verb per media type. */
function currentlyVerb(mediaType: MediaType): string {
  return mediaType === 'book' ? 'is currently reading' : 'is currently listening to';
}

const MEDIA_BADGE: Record<MediaType, string> = {
  book: 'Book',
  music: 'Music',
  audiobook: 'Audiobook',
  podcast: 'Podcast',
};

/** How many characters of the synopsis to show before "Continue reading". */
const DESC_PREVIEW = 220;

interface ActivityCardProps {
  activity: ActivityDTO;
  onDelete?: (id: string) => void;
  deleting?: boolean;
}

/**
 * A feed entry, Goodreads-style: author line, cover, title/creator, a shelf
 * control, the author's note, the item synopsis (expandable), a Preview link,
 * and the conversation (comments). All user/provider text renders as plain text.
 */
export function ActivityCard({ activity, onDelete, deleting = false }: ActivityCardProps) {
  const { author, mediaType, title, itemAuthor, note, description, coverUrl, providerUrl, providerId, replyCount, createdAt, canDelete } =
    activity;

  const [showThread, setShowThread] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);

  const addToLibrary = useAddToLibrary();
  const shelves = useLibraryShelves();
  const shelfValue: Shelf | '' = providerId ? (shelves.get(libraryKey({ mediaType, providerId })) ?? '') : '';

  const setShelf = (shelf: Shelf) => {
    if (!providerId) return;
    const item: TrendingItemDTO = {
      mediaType,
      title,
      creator: itemAuthor,
      coverUrl,
      providerId,
      genre: null,
      description,
      providerUrl,
    };
    addToLibrary.mutate({ item, shelf });
  };

  // Only link out to http(s) provider URLs (defense-in-depth against bad schemes).
  const previewUrl = providerUrl && /^https?:\/\//i.test(providerUrl) ? providerUrl : null;

  const longDesc = !!description && description.length > DESC_PREVIEW;
  const shownDesc =
    description && longDesc && !descExpanded ? `${description.slice(0, DESC_PREVIEW).trimEnd()}…` : description;

  return (
    <article className="card activity-card">
      <div className="activity-card__avatar" aria-hidden="true">
        {author.avatarUrl ? (
          <img src={author.avatarUrl} alt="" referrerPolicy="no-referrer" />
        ) : (
          <span className="avatar-placeholder">{author.displayName.charAt(0).toUpperCase()}</span>
        )}
      </div>

      <div className="activity-card__body">
        <div className="activity-card__head">
          <span className="activity-card__author">{author.displayName}</span>
          <span className="activity-card__verb"> {currentlyVerb(mediaType)}</span>
          <span className="badge badge--sm" data-media={mediaType}>
            {MEDIA_BADGE[mediaType]}
          </span>
          <time className="activity-card__time home-muted" dateTime={createdAt} title={new Date(createdAt).toLocaleString()}>
            {relativeTime(createdAt)}
          </time>
        </div>

        <div className="activity-card__item">
          {coverUrl ? (
            <img className="activity-card__cover" src={coverUrl} alt="" referrerPolicy="no-referrer" />
          ) : null}
          <div className="activity-card__item-main">
            <p className="activity-card__title">{title}</p>
            {itemAuthor ? <p className="activity-card__item-author">by {itemAuthor}</p> : null}

            {providerId ? (
              <label className="activity-card__shelf">
                <span className="sr-only">Shelf for {title}</span>
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
                      {shelfLabel(s, mediaType)}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {note ? <p className="activity-card__note">{note}</p> : null}

            {description ? (
              <p className="activity-card__desc">
                {shownDesc}{' '}
                {longDesc ? (
                  <button
                    type="button"
                    className="card-link"
                    onClick={() => setDescExpanded((v) => !v)}
                  >
                    {descExpanded ? 'Show less' : 'Continue reading'}
                  </button>
                ) : null}
              </p>
            ) : null}
          </div>
        </div>

        <div className="activity-card__actions">
          <button
            type="button"
            className="card-link"
            aria-expanded={showThread}
            onClick={() => setShowThread((v) => !v)}
          >
            {replyCount > 0 ? `Comment (${replyCount})` : 'Comment'}
          </button>
          {previewUrl ? (
            <a className="card-link" href={previewUrl} target="_blank" rel="noreferrer noopener">
              Preview
            </a>
          ) : null}
          {canDelete && onDelete ? (
            <button
              type="button"
              className="card-link card-link--danger"
              onClick={() => onDelete(activity.id)}
              disabled={deleting}
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          ) : null}
        </div>

        {showThread ? <ReplyThread activityId={activity.id} /> : null}
      </div>
    </article>
  );
}
