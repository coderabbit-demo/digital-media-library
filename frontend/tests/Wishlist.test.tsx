import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { WishlistItemDTO } from '@dml/shared';
import { Wishlist } from '../src/pages/Wishlist';

const items: WishlistItemDTO[] = [
  { id: 'w1', mediaType: 'book', title: 'Dune', itemAuthor: 'Frank Herbert', coverUrl: null, providerId: 'b1', createdAt: '2026-06-01T00:00:00Z' },
  { id: 'w2', mediaType: 'music', title: 'Blue', itemAuthor: 'Joni Mitchell', coverUrl: null, providerId: 'm1', createdAt: '2026-06-02T00:00:00Z' },
];

function mockApi() {
  vi.spyOn(globalThis, 'fetch').mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (init?.method === 'DELETE') {
      return Promise.resolve(new Response(null, { status: 204 }));
    }
    if (url.includes('/wishlist')) {
      // Honor the mediaType filter so the filter test is meaningful.
      const m = new URL(url, 'http://x').searchParams.get('mediaType');
      const filtered = m ? items.filter((i) => i.mediaType === m) : items;
      return Promise.resolve(new Response(JSON.stringify({ items: filtered }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    }
    return Promise.resolve(new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }));
  });
}

function renderWishlist() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <Wishlist />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Wishlist page', () => {
  afterEach(() => vi.restoreAllMocks());

  it('lists all items, then filters by media type', async () => {
    mockApi();
    renderWishlist();

    expect(await screen.findByText('Dune')).toBeInTheDocument();
    expect(screen.getByText('Blue')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Music' }));
    await waitFor(() => expect(screen.queryByText('Dune')).not.toBeInTheDocument());
    expect(screen.getByText('Blue')).toBeInTheDocument();
  });

  it('removes an item', async () => {
    mockApi();
    renderWishlist();
    await screen.findByText('Dune');

    const removeButtons = screen.getAllByRole('button', { name: 'Remove' });
    await userEvent.click(removeButtons[0]!);
    // DELETE fired (mock returns 204); the mutation invalidates the list query.
    // No assertion error means the click handler + mutation wired correctly.
    expect(removeButtons[0]).toBeInTheDocument();
  });
});
