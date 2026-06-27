import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { DiscoverPageDTO } from '@dml/shared';
import { Discover } from '../src/pages/Discover';

function mockDiscover(page: DiscoverPageDTO) {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify(page), { status: 200, headers: { 'Content-Type': 'application/json' } }),
  );
}

function renderDiscover(category: 'books' | 'podcasts' = 'books') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <Discover category={category} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const page = (overrides: Partial<DiscoverPageDTO> = {}): DiscoverPageDTO => ({
  category: 'book',
  stale: false,
  items: [
    { mediaType: 'book', title: 'Dune', creator: 'Frank Herbert', coverUrl: null, providerId: 'b1', genre: 'Fiction' },
  ],
  ...overrides,
});

describe('Discover page', () => {
  afterEach(() => vi.restoreAllMocks());

  it('renders trending items grouped under a genre section heading', async () => {
    mockDiscover(page());
    renderDiscover();
    expect(await screen.findByText('Dune')).toBeInTheDocument();
    expect(screen.getByText('Frank Herbert')).toBeInTheDocument();
    // Genre section heading is shown.
    expect(screen.getByRole('heading', { name: 'Fiction' })).toBeInTheDocument();
  });

  it('shows the stale banner when results are stale', async () => {
    mockDiscover(page({ stale: true }));
    renderDiscover();
    expect(await screen.findByText(/may be out of date/i)).toBeInTheDocument();
  });

  it('shows an unavailable state when there are no items', async () => {
    mockDiscover(page({ items: [] }));
    renderDiscover();
    expect(await screen.findByText(/temporarily unavailable/i)).toBeInTheDocument();
  });

  it('renders the podcasts category grouped by genre', async () => {
    mockDiscover({
      category: 'podcast',
      stale: false,
      items: [
        { mediaType: 'podcast', title: 'The Daily', creator: 'The New York Times', coverUrl: null, providerId: 'p1', genre: 'News' },
      ],
    });
    renderDiscover('podcasts');
    expect(await screen.findByText('The Daily')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'News' })).toBeInTheDocument();
  });
});
