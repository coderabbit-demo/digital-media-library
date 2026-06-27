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
    { mediaType: 'book', title: 'Dune', creator: 'Frank Herbert', coverUrl: null, providerId: 'b1' },
  ],
};

function renderDiscover() {
  vi.spyOn(globalThis, 'fetch').mockImplementation((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/discover')) {
      return Promise.resolve(
        new Response(JSON.stringify(page), { status: 200, headers: { 'Content-Type': 'application/json' } }),
      );
    }
    return Promise.resolve(new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }));
  });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <Discover category="books" />
      </MemoryRouter>
    </QueryClientProvider>,
  );
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
});
