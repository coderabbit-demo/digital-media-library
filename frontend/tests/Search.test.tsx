import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { SearchPageDTO } from '@dml/shared';
import { Search } from '../src/pages/Search';

const page: SearchPageDTO = {
  category: 'book',
  query: 'dune',
  items: [
    { mediaType: 'book', title: 'Dune', creator: 'Frank Herbert', coverUrl: null, providerId: 'b1', genre: 'Fiction', description: null, providerUrl: null },
  ],
};

function mockApi() {
  vi.spyOn(globalThis, 'fetch').mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes('/search')) {
      return Promise.resolve(new Response(JSON.stringify(page), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    }
    if (url.includes('/recommendations') && init?.method === 'POST') {
      return Promise.resolve(new Response(JSON.stringify({ id: 'r1' }), { status: 201, headers: { 'Content-Type': 'application/json' } }));
    }
    return Promise.resolve(new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }));
  });
}

function renderSearch() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <Search />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Search page', () => {
  afterEach(() => vi.restoreAllMocks());

  it('shows a prompt before searching', () => {
    mockApi();
    renderSearch();
    expect(screen.getByText(/search for a title or creator/i)).toBeInTheDocument();
  });

  it('runs a search and renders results, then recommends one', async () => {
    mockApi();
    renderSearch();

    await userEvent.type(screen.getByLabelText('Search query'), 'dune');
    await userEvent.click(screen.getByRole('button', { name: 'Search' }));

    expect(await screen.findByText('Dune')).toBeInTheDocument();
    expect(screen.getByText('Frank Herbert')).toBeInTheDocument();

    const recommend = screen.getByRole('button', { name: 'Recommend' });
    await userEvent.click(recommend);
    expect(await screen.findByRole('button', { name: /recommended/i })).toBeInTheDocument();
  });
});
