import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  MEDIA_TYPES,
  SHELVES,
  type ItemDetailDTO,
  type MediaType,
  type ShelfCountsDTO,
  type TrendingItemDTO,
} from '@dml/shared';
import { useItem } from '../services/item';
import { ItemControls } from '../components/ItemControls';
import { ComposeDialog } from '../components/ComposeDialog';
import type { ComposeInitial } from '../components/PostUpdateForm';
import { relativeTime } from '../utils/time';
import { shelfLabel } from '../services/library';

const MEDIA_BADGE: Record<MediaType, string> = {
  book: 'Book',
  music: 'Music',
  audiobook: 'Audiobook',
  podcast: 'Podcast',
};

/** Characters of synopsis shown before "Show more". */
const DESC_PREVIEW = 320;

/** Build the controls' item payload from provider detail (genres → first genre). */
function toTrendingItem(item: ItemDetailDTO): TrendingItemDTO {
  return {
    mediaType: item.mediaType,
    title: item.title,
    creator: item.creator,
    coverUrl: item.coverUrl,
    providerId: item.providerId,
    genre: item.genres[0] ?? null,
    description: item.description,
    providerUrl: item.providerUrl,
  };
}

/**
 * Item detail page (feature 007): a deep-linkable, Goodreads-style page for a
 * single media item — cover, title, creator, synopsis, genres, the shared item
 * controls, and community context (average rating, per-shelf counts, recent
 * activity). All provider/user text renders as plain text.
 */
export function ItemPage() {
  const params = useParams<{ mediaType: string; providerId: string }>();
  const [descExpanded, setDescExpanded] = useState(false);
  const [compose, setCompose] = useState<ComposeInitial | null>(null);

  const validType = MEDIA_TYPES.includes(params.mediaType as MediaType);
  const mediaType = params.mediaType as MediaType;
  const providerId = params.providerId ?? '';

  const { data, isLoading, isError, error, refetch } = useItem(mediaType, providerId);

  if (!validType) return <NotFound />;
  if (isLoading) {
    return (
      <p className="feed-status" role="status">
        Loading…
      </p>
    );
  }
  if (isError && error?.status === 404) return <NotFound />;
  if (isError || !data) {
    return (
      <div className="feed-status feed-status--error" role="alert">
        <p>We couldn’t load this item.</p>
        <button type="button" className="btn" onClick={() => void refetch()}>
          Try again
        </button>
      </div>
    );
  }

  const { item, detailAvailable, stats } = data;
  const longDesc = !!item?.description && item.description.length > DESC_PREVIEW;
  const shownDesc =
    item?.description && longDesc && !descExpanded
      ? `${item.description.slice(0, DESC_PREVIEW).trimEnd()}…`
      : item?.description;

  const startActivity = (it: TrendingItemDTO) =>
    setCompose({
      mediaType: it.mediaType,
      title: it.title,
      itemAuthor: it.creator ?? undefined,
      coverUrl: it.coverUrl,
      providerId: it.providerId,
      description: it.description,
      providerUrl: it.providerUrl,
    });

  const previewUrl = item?.providerUrl && /^https?:\/\//i.test(item.providerUrl) ? item.providerUrl : null;

  return (
    <div className="item-page">
      <article className="item-hero">
        <div className="item-hero__cover">
          {item?.coverUrl ? (
            <img src={item.coverUrl} alt="" referrerPolicy="no-referrer" />
          ) : (
            <div className="item-hero__cover-ph" aria-hidden="true">
              {(item?.title ?? '?').charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        <div className="item-hero__main">
          <span className="badge badge--sm" data-media={mediaType}>
            {MEDIA_BADGE[mediaType]}
          </span>
          <h1 className="item-hero__title">{item?.title ?? 'Item'}</h1>
          {item?.creator ? <p className="item-hero__creator">{item.creator}</p> : null}
          {item?.series ? <p className="item-hero__series home-muted">{item.series}</p> : null}

          <RatingSummary average={stats.ratingAverage} count={stats.ratingCount} />

          {!detailAvailable ? (
            <p className="item-hero__detail-note home-muted" role="status">
              Full details are temporarily unavailable.{' '}
              <button type="button" className="card-link" onClick={() => void refetch()}>
                Try again
              </button>
            </p>
          ) : null}

          {item ? (
            <>
              {shownDesc ? (
                <p className="item-hero__desc">
                  {shownDesc}{' '}
                  {longDesc ? (
                    <button type="button" className="card-link" onClick={() => setDescExpanded((v) => !v)}>
                      {descExpanded ? 'Show less' : 'Show more'}
                    </button>
                  ) : null}
                </p>
              ) : null}

              {item.genres.length > 0 ? (
                <ul className="item-genres" aria-label="Genres">
                  {item.genres.map((g) => (
                    <li key={g} className="chip chip--sm item-genre">
                      {g}
                    </li>
                  ))}
                </ul>
              ) : null}

              <ItemControls item={toTrendingItem(item)} onStartActivity={startActivity} />

              {previewUrl ? (
                <a className="card-link" href={previewUrl} target="_blank" rel="noreferrer noopener">
                  View on provider
                </a>
              ) : null}
            </>
          ) : null}
        </div>
      </article>

      <section className="item-community" aria-label="Community">
        <ShelfCounts counts={stats.shelfCounts} mediaType={mediaType} />
        <div className="item-activity">
          <h2 className="item-section__title">Recent activity</h2>
          {stats.recentActivity.length === 0 ? (
            <p className="home-muted">No activity yet.</p>
          ) : (
            <ul className="item-activity__list">
              {stats.recentActivity.map((a) => (
                <li key={a.id} className="item-activity__item">
                  <span className="item-activity__author">{a.author.displayName}</span>
                  {a.note ? <span className="item-activity__note"> — {a.note}</span> : null}
                  <span className="home-muted item-activity__time"> · {relativeTime(a.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <ComposeDialog open={compose !== null} initial={compose ?? undefined} onClose={() => setCompose(null)} />
    </div>
  );
}

function RatingSummary({ average, count }: { average: number | null; count: number }) {
  if (count === 0 || average === null) {
    return <p className="item-rating-summary home-muted">No ratings yet</p>;
  }
  return (
    <p className="item-rating-summary">
      <span className="item-rating-summary__avg">{average.toFixed(1)}</span>
      <span className="home-muted">
        {' '}
        · {count} rating{count === 1 ? '' : 's'}
      </span>
    </p>
  );
}

function ShelfCounts({ counts, mediaType }: { counts: ShelfCountsDTO; mediaType: MediaType }) {
  return (
    <div className="item-shelfcounts">
      <h2 className="item-section__title">On readers’ shelves</h2>
      <ul className="item-shelfcounts__list">
        {SHELVES.map((s) => (
          <li key={s} className="item-shelfcounts__item">
            <span className="item-shelfcounts__n">{counts[s]}</span>
            <span className="home-muted">{shelfLabel(s, mediaType)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function NotFound() {
  return (
    <div className="feed-empty">
      <h2>We couldn’t find this item</h2>
      <p>
        It may no longer be available. <Link to="/">Back to home</Link>.
      </p>
    </div>
  );
}
