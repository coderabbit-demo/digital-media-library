import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { DiscoverPageDTO } from '@dml/shared';
import { Discover } from '../src/pages/Discover';

const page: DiscoverPageDTO = {
  category: 'book',
  stale: false,
  items: [
    { mediaType: 'book', title: 'Dune', creator: 'Frank Herbert', coverUrl: null, providerId: 'b1', genre: 'Fiction', description: null, providerUrl: null },
  ],
};

function renderDiscover() {
  const calls: { url: string; init?: RequestInit }[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    if (url.includes('/discover')) {
      return Promise.resolve(
        new Response(JSON.stringify(page), { status: 200, headers: { 'Content-Type': 'application/json' } }),
      );
    }
    if (url.includes('/library') && init?.method === 'POST') {
      return Promise.resolve(
        new Response(JSON.stringify({ id: 'l1', shelf: 'current' }), { status: 201, headers: { 'Content-Type': 'application/json' } }),
      );
    }
    return Promise.resolve(new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }));
  });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <Discover category="books" />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { calls };
}

describe('Discover → start activity', () => {
  afterEach(() => vi.restoreAllMocks());

  it('opens the compose overlay pre-filled from a Discover item', async () => {
    renderDiscover();
    await userEvent.click(await screen.findByRole('button', { name: /reading this/i }));

    const dialog = await screen.findByRole('dialog', { name: /share what you’re doing now/i });
    // Title is pre-filled with the item's title.
    expect(within(dialog).getByLabelText('Title')).toHaveValue('Dune');
    // Author/artist is pre-filled with the item's creator.
    expect(within(dialog).getByLabelText('Author or artist')).toHaveValue('Frank Herbert');
  });

  it('also shelves the item as Currently Reading in My Library', async () => {
    const { calls } = renderDiscover();
    await userEvent.click(await screen.findByRole('button', { name: /reading this/i }));

    await screen.findByRole('dialog', { name: /share what you’re doing now/i });
    const post = calls.find((c) => c.url.includes('/library') && c.init?.method === 'POST');
    expect(post).toBeTruthy();
    expect(JSON.parse(String(post!.init!.body))).toMatchObject({ providerId: 'b1', shelf: 'current' });
  });
});
