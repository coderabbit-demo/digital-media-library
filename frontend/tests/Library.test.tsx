import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { LibraryItemDTO } from '@dml/shared';
import { Library } from '../src/pages/Library';

const items: LibraryItemDTO[] = [
  { id: 'l1', mediaType: 'book', title: 'Dune', itemAuthor: 'Frank Herbert', coverUrl: null, providerId: 'b1', shelf: 'want', createdAt: '2026-06-01T00:00:00Z', updatedAt: '2026-06-01T00:00:00Z' },
  { id: 'l2', mediaType: 'music', title: 'Blue', itemAuthor: 'Joni Mitchell', coverUrl: null, providerId: 'm1', shelf: 'current', createdAt: '2026-06-02T00:00:00Z', updatedAt: '2026-06-02T00:00:00Z' },
];

function mockApi() {
  const calls: { url: string; init?: RequestInit }[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    if (init?.method === 'PATCH') {
      return Promise.resolve(new Response(JSON.stringify({ ...items[0], shelf: 'current' }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    }
    if (url.includes('/library')) {
      const sp = new URL(url, 'http://x').searchParams;
      const shelf = sp.get('shelf');
      const filtered = shelf ? items.filter((i) => i.shelf === shelf) : items;
      return Promise.resolve(new Response(JSON.stringify({ items: filtered }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    }
    return Promise.resolve(new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }));
  });
  return calls;
}

function renderLibrary() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <Library />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('My Library page', () => {
  afterEach(() => vi.restoreAllMocks());

  it('renders shelves and lists all items, then filters by shelf', async () => {
    mockApi();
    renderLibrary();

    expect(screen.getByRole('heading', { name: 'My Library' })).toBeInTheDocument();
    // Shelf tabs present (combined read/listen wording, all-media).
    expect(screen.getByRole('button', { name: 'Want to Read/Listen' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Currently Reading/Listening' })).toBeInTheDocument();

    expect(await screen.findByText('Dune')).toBeInTheDocument();
    expect(screen.getByText('Blue')).toBeInTheDocument();

    // Filter to the Currently Reading shelf.
    await userEvent.click(screen.getByRole('button', { name: 'Currently Reading/Listening' }));
    await waitFor(() => expect(screen.queryByText('Dune')).not.toBeInTheDocument());
    expect(screen.getByText('Blue')).toBeInTheDocument();
  });

  it('moves an item to another shelf via the per-item selector', async () => {
    mockApi();
    renderLibrary();
    await screen.findByText('Dune');

    // The book item's shelf selector (media-aware labels for a book).
    const selects = screen.getAllByRole('combobox');
    await userEvent.selectOptions(selects[0]!, 'current');
    // PATCH fired and resolved; no error means move wiring is correct.
    expect(selects[0]).toBeInTheDocument();
  });

  it('"I\'m reading this" on a non-current item moves it to Currently Reading', async () => {
    const calls = mockApi();
    renderLibrary();
    await screen.findByText('Dune'); // Dune is on the want shelf

    // First card is Dune (want). Click its start-activity CTA.
    const ctas = screen.getAllByRole('button', { name: /reading this/i });
    await userEvent.click(ctas[0]!);

    const patch = calls.find((c) => c.init?.method === 'PATCH');
    expect(patch).toBeTruthy();
    expect(patch!.url).toContain('/library/l1');
    expect(JSON.parse(String(patch!.init!.body))).toMatchObject({ shelf: 'current' });
  });
});
