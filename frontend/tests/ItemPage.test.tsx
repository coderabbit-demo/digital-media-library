import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ItemPageDTO } from '@dml/shared';
import { ItemPage } from '../src/pages/ItemPage';

function makePage(overrides: Partial<ItemPageDTO> = {}): ItemPageDTO {
  return {
    detailAvailable: true,
    item: {
      mediaType: 'book',
      providerId: 'b1',
      title: 'Project Hail Mary',
      creator: 'Andy Weir',
      coverUrl: null,
      description: 'A lone astronaut must save the earth.',
      genres: ['Science Fiction', 'Adventure'],
      providerUrl: 'https://books.google.com/books?id=b1',
      series: null,
      spotifyUrl: null,
    },
    stats: {
      ratingAverage: 4.4,
      ratingCount: 1200,
      shelfCounts: { want: 5, current: 2, done: 9, dnf: 1 },
      recentActivity: [
        { id: 'a1', author: { id: 'u1', displayName: 'Ada Lovelace', avatarUrl: null }, note: 'Loving it', createdAt: new Date().toISOString() },
      ],
    },
    ...overrides,
  };
}

const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));

function renderItem(page: ItemPageDTO | null, initial = '/item/book/b1') {
  const calls: { url: string; init?: RequestInit }[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    if (url.includes('/items/')) {
      return page ? json(page) : json({ error: 'not_found', message: 'nope' }, 404);
    }
    if (url.includes('/ratings')) return json({ ratings: [] });
    return json({ items: [] }); // library shelves
  });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[initial]}>
        <Routes>
          <Route path="/item/:mediaType/:providerId" element={<ItemPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { calls };
}

describe('ItemPage', () => {
  afterEach(() => vi.restoreAllMocks());

  it('renders the item detail: title, creator, badge, genres', async () => {
    renderItem(makePage());
    expect(await screen.findByRole('heading', { name: 'Project Hail Mary' })).toBeInTheDocument();
    expect(screen.getByText('Andy Weir')).toBeInTheDocument();
    expect(screen.getByText('Book')).toBeInTheDocument();
    expect(screen.getByText('Science Fiction')).toBeInTheDocument();
    // The provider link names the actual provider (derived from the URL host).
    expect(screen.getByRole('link', { name: 'View on Google Books' })).toBeInTheDocument();
  });

  it('truncates a long synopsis behind "Show more"', async () => {
    const long = 'x'.repeat(400);
    renderItem(makePage({ item: { ...makePage().item!, description: long } }));
    const toggle = await screen.findByRole('button', { name: /show more/i });
    expect(toggle).toBeInTheDocument();
    await userEvent.click(toggle);
    expect(screen.getByRole('button', { name: /show less/i })).toBeInTheDocument();
  });

  it('renders community sections: average, count, shelf counts, recent activity', async () => {
    renderItem(makePage());
    expect(await screen.findByText('4.4')).toBeInTheDocument();
    expect(screen.getByText(/1200 ratings/)).toBeInTheDocument();
    expect(screen.getByText('On readers’ shelves')).toBeInTheDocument();
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText(/Loving it/)).toBeInTheDocument();
  });

  it('shows empty states when there is no community data', async () => {
    renderItem(
      makePage({
        stats: {
          ratingAverage: null,
          ratingCount: 0,
          shelfCounts: { want: 0, current: 0, done: 0, dnf: 0 },
          recentActivity: [],
        },
      }),
    );
    expect(await screen.findByText(/no ratings yet/i)).toBeInTheDocument();
    expect(screen.getByText(/no activity yet/i)).toBeInTheDocument();
  });

  it('renders a not-found state for an unresolvable item', async () => {
    renderItem(null);
    expect(await screen.findByText(/couldn’t find this item/i)).toBeInTheDocument();
  });

  it('renders provider/user text as plain text (no markup)', async () => {
    const payload = '<img src=x onerror=alert(1)>';
    renderItem(makePage({ item: { ...makePage().item!, description: payload } }));
    expect(await screen.findByText(payload)).toBeInTheDocument();
  });

  it('exposes the shared controls (rating, shelf, recommend)', async () => {
    renderItem(makePage());
    expect(await screen.findByRole('button', { name: '4 stars' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reading this/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Recommend' })).toBeInTheDocument();
  });
});
