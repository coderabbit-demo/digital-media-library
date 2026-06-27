import { useState, type FormEvent } from 'react';
import {
  ITEM_AUTHOR_MAX_LENGTH,
  MEDIA_TYPES,
  TITLE_MAX_LENGTH,
  createActivitySchema,
  type MediaType,
} from '@dml/shared';
import { ApiError } from '../services/api';
import { useCreateActivity } from '../services/feed';

const MEDIA_OPTIONS: { value: MediaType; label: string }[] = [
  { value: 'book', label: 'Book' },
  { value: 'music', label: 'Music' },
  { value: 'audiobook', label: 'Audiobook' },
];

/**
 * Compose form for a "currently reading/listening" update. Client-side
 * validation mirrors createActivitySchema from @dml/shared; on success the
 * activity is optimistically added to the feed. A 429 rate-limit response
 * (FR-019) surfaces a friendly retry message.
 */
export interface ComposeInitial {
  mediaType?: MediaType;
  title?: string;
  itemAuthor?: string;
}

export function PostUpdateForm({
  onPosted,
  initial,
}: { onPosted?: () => void; initial?: ComposeInitial } = {}) {
  const createActivity = useCreateActivity();

  const [mediaType, setMediaType] = useState<MediaType>(initial?.mediaType ?? MEDIA_TYPES[0]);
  const [title, setTitle] = useState(initial?.title ?? '');
  const [itemAuthor, setItemAuthor] = useState(initial?.itemAuthor ?? '');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [rateLimited, setRateLimited] = useState(false);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setValidationError(null);
    setRateLimited(false);

    const parsed = createActivitySchema.safeParse({
      mediaType,
      title,
      itemAuthor: itemAuthor.trim() === '' ? null : itemAuthor,
    });

    if (!parsed.success) {
      const first = parsed.error.issues[0];
      setValidationError(first?.message ?? 'Please check your input and try again.');
      return;
    }

    createActivity.mutate(parsed.data, {
      onSuccess: () => {
        setTitle('');
        setItemAuthor('');
        setMediaType(MEDIA_TYPES[0]);
        onPosted?.();
      },
      onError: (err) => {
        if (err instanceof ApiError && err.isRateLimited) {
          setRateLimited(true);
          return;
        }
        setValidationError(
          err instanceof Error ? err.message : 'Something went wrong posting your update.',
        );
      },
    });
  };

  return (
    <form className="card post-form" onSubmit={handleSubmit} noValidate>
      <h2 className="post-form__heading">Share what you’re into right now</h2>

      <div className="post-form__row">
        <div className="post-form__field post-form__field--media md3-field">
          <select
            id="pf-media"
            value={mediaType}
            onChange={(e) => setMediaType(e.target.value as MediaType)}
            aria-label="Media type"
          >
            {MEDIA_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <span className="md3-field__label" aria-hidden="true">
            Media type
          </span>
        </div>

        <div className="post-form__field post-form__field--title md3-field">
          <input
            id="pf-title"
            type="text"
            value={title}
            maxLength={TITLE_MAX_LENGTH}
            placeholder=" "
            onChange={(e) => setTitle(e.target.value)}
            aria-label="Title"
          />
          <span className="md3-field__label" aria-hidden="true">
            Title
          </span>
        </div>
      </div>

      <div className="post-form__field md3-field">
        <input
          id="pf-author"
          type="text"
          value={itemAuthor}
          maxLength={ITEM_AUTHOR_MAX_LENGTH}
          placeholder=" "
          onChange={(e) => setItemAuthor(e.target.value)}
          aria-label="Author or artist"
        />
        <span className="md3-field__label" aria-hidden="true">
          Author / artist (optional)
        </span>
      </div>

      {validationError ? (
        <p className="post-form__error" role="alert">
          {validationError}
        </p>
      ) : null}

      {rateLimited ? (
        <p className="post-form__error" role="alert">
          You’re posting a little too fast. You can share up to 10 updates a minute — please
          try again in a moment.
        </p>
      ) : null}

      <div className="post-form__actions">
        <button type="submit" className="btn btn-primary" disabled={createActivity.isPending}>
          {createActivity.isPending ? 'Posting…' : 'Post update'}
        </button>
      </div>
    </form>
  );
}
