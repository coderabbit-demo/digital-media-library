import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DISCOVER_CATEGORIES, type DiscoverCategory, type TrendingItemDTO } from '@dml/shared';
import { useSearch } from '../services/search';
import { DiscoverItemCard } from '../components/DiscoverItemCard';
import { ComposeDialog } from '../components/ComposeDialog';
import type { ComposeInitial } from '../components/PostUpdateForm';

const CATEGORY_LABELS: Record<DiscoverCategory, string> = {
  books: 'Books',
  music: 'Music',
  audiobooks: 'Audiobooks',
  podcasts: 'Podcasts',
};

/**
 * Search page: pick a category, type a query, and search media via the cached,
 * provider-backed endpoint. Each result can be recommended or seed an activity.
 */
export function Search() {
  // The submitted (category, query) pair lives in the URL so results survive
  // navigation away and back (e.g. opening an item, then pressing back) and are
  // shareable. The query cache (keyed by category+query) restores them instantly.
  const [searchParams, setSearchParams] = useSearchParams();
  const paramCategory = searchParams.get('category');
  const submittedCategory: DiscoverCategory = DISCOVER_CATEGORIES.includes(paramCategory as DiscoverCategory)
    ? (paramCategory as DiscoverCategory)
    : 'books';
  const submittedQuery = searchParams.get('q') ?? '';

  // Live form inputs, seeded from the URL so the form reflects the active search.
  const [category, setCategory] = useState<DiscoverCategory>(submittedCategory);
  const [input, setInput] = useState(submittedQuery);
  const [compose, setCompose] = useState<ComposeInitial | null>(null);

  // Keep the form in sync when the submitted search changes via history
  // navigation (back/forward between /search?… entries). Typing only changes the
  // local inputs, not the submitted values, so this never fights the user.
  useEffect(() => {
    setCategory(submittedCategory);
    setInput(submittedQuery);
  }, [submittedCategory, submittedQuery]);

  const { data, isFetching, isError, refetch } = useSearch(submittedCategory, submittedQuery);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchParams({ category, q: input });
  };

  const startActivity = (item: TrendingItemDTO) =>
    setCompose({
      mediaType: item.mediaType,
      title: item.title,
      itemAuthor: item.creator ?? undefined,
      coverUrl: item.coverUrl,
      providerId: item.providerId,
      description: item.description,
      providerUrl: item.providerUrl,
    });

  const items = data?.items ?? [];
  const hasQuery = submittedQuery.trim().length > 0;

  return (
    <div className="discover-page">
      <h1 className="discover-page__title">Search</h1>

      <form className="search-form" onSubmit={submit} role="search">
        <select
          className="search-form__category"
          aria-label="Category"
          value={category}
          onChange={(e) => setCategory(e.target.value as DiscoverCategory)}
        >
          {DISCOVER_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
        <input
          className="search-form__input"
          type="search"
          aria-label="Search query"
          placeholder="Search by title or creator…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button type="submit" className="btn btn-primary" disabled={!input.trim()}>
          Search
        </button>
      </form>

      {!hasQuery ? (
        <p className="feed-status">Search for a title or creator to get started.</p>
      ) : isFetching ? (
        <p className="feed-status" role="status">
          Searching…
        </p>
      ) : isError ? (
        <div className="feed-status feed-status--error" role="alert">
          <p>Search failed. Please try again.</p>
          <button type="button" className="btn" onClick={() => void refetch()}>
            Try again
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="feed-empty">
          <h2>No results</h2>
          <p>
            No {CATEGORY_LABELS[submittedCategory].toLowerCase()} matched “{submittedQuery}”. Try
            different terms.
          </p>
        </div>
      ) : (
        <div className="discover-grid">
          {items.map((item) => (
            <DiscoverItemCard key={item.providerId} item={item} onStartActivity={startActivity} />
          ))}
        </div>
      )}

      <ComposeDialog
        open={compose !== null}
        initial={compose ?? undefined}
        onClose={() => setCompose(null)}
      />
    </div>
  );
}
