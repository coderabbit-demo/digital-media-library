import type { ActivityDTO, MediaType } from '@dml/shared';
import { relativeTime } from '../utils/time';

const MEDIA_LABELS: Record<MediaType, string> = {
  book: 'Reading',
  music: 'Listening to',
  audiobook: 'Listening to',
};

const MEDIA_BADGE: Record<MediaType, string> = {
  book: 'Book',
  music: 'Music',
  audiobook: 'Audiobook',
};

interface ActivityCardProps {
  activity: ActivityDTO;
  onDelete?: (id: string) => void;
  deleting?: boolean;
}

/**
 * A single feed entry. All user-provided text (display name, title, itemAuthor)
 * is rendered through React's default escaping as plain text — never as markup
 * (FR-018). The delete control only renders when the API says canDelete.
 */
export function ActivityCard({ activity, onDelete, deleting = false }: ActivityCardProps) {
  const { author, mediaType, title, itemAuthor, createdAt, canDelete } = activity;

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
          <span className="activity-card__verb"> {MEDIA_LABELS[mediaType]}</span>
          <span className="badge" data-media={mediaType}>
            {MEDIA_BADGE[mediaType]}
          </span>
        </div>

        <p className="activity-card__title">{title}</p>
        {itemAuthor ? <p className="activity-card__item-author">by {itemAuthor}</p> : null}

        <div className="activity-card__meta">
          <time dateTime={createdAt} title={new Date(createdAt).toLocaleString()}>
            {relativeTime(createdAt)}
          </time>
          {canDelete && onDelete ? (
            <button
              type="button"
              className="btn btn-ghost activity-card__delete"
              onClick={() => onDelete(activity.id)}
              disabled={deleting}
              aria-label="Delete this update"
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}
