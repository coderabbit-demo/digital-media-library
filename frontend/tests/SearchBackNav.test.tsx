import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { Search } from '../src/pages/Search';

const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));

function mockApi() {
  vi.spyOn(globalThis, 'fetch').mockImplementation((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/search')) {
      return json({
        category: 'book',
        query: 'dune',
        items: [
          { mediaType: 'book', title: 'Dune', creator: 'Frank Herbert', coverUrl: null, providerId: 'b1', genre: null, description: null, providerUrl: null },
        ],
      });
    }
    if (url.includes('/ratings')) return json({ ratings: [] });
    return json({ items: [] });
  });
}

function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="loc">{loc.pathname + loc.search}</div>;
}

function renderAt(initial: string, qc: QueryClient) {
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[initial]}>
        <Routes>
          <Route path="/search" element={<Search />} />
        </Routes>
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Search back-navigation (FR-014)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('puts the submitted query in the URL', async () => {
    mockApi();
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    renderAt('/search', qc);

    await userEvent.type(screen.getByLabelText('Search query'), 'dune');
    await userEvent.click(screen.getByRole('button', { name: 'Search' }));

    expect(await screen.findByText('Dune')).toBeInTheDocument();
    expect(screen.getByTestId('loc').textContent).toContain('q=dune');
  });

  it('restores the query and results when arriving back at a search URL', async () => {
    mockApi();
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    // Simulates pressing back from an item: the Search route remounts at its URL.
    renderAt('/search?category=books&q=dune', qc);

    // The form reflects the active search and results are shown (not cleared).
    expect(screen.getByLabelText('Search query')).toHaveValue('dune');
    expect(await screen.findByText('Dune')).toBeInTheDocument();
  });
});
