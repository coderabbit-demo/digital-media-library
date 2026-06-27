import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { HomeData } from '@dml/shared';
import { HomeFeed } from '../src/pages/HomeFeed';

const home: HomeData = {
  current: [
    {
      id: 'l1',
      mediaType: 'book',
      title: 'Dune',
      itemAuthor: 'Frank Herbert',
      coverUrl: null,
      providerId: 'b1',
      shelf: 'current',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
  counts: { currentlyOn: 1, wishlisted: 0 },
  recommendations: [],
};

function mockApi() {
  vi.spyOn(globalThis, 'fetch').mockImplementation((input: RequestInfo | URL) => {
    const url = String(input);
    const json = (body: unknown, status = 200) =>
      Promise.resolve(
        new Response(JSON.stringify(body), {
          status,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    if (url.includes('/home')) return json(home);
    if (url.includes('/feed')) return json({ items: [], nextCursor: null });
    return json({});
  });
}

function renderHome() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <HomeFeed />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('HomeFeed (three-column home)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('renders the left column with the user\'s own items and counts', async () => {
    mockApi();
    renderHome();
    expect(await screen.findByText('Dune')).toBeInTheDocument();
    expect(screen.getByText('Currently reading / listening')).toBeInTheDocument();
    expect(screen.getByText('current')).toBeInTheDocument();
    expect(screen.getByText('want to read')).toBeInTheDocument();
  });

  it('renders the recommendations region with an empty state (no auto picks)', async () => {
    mockApi();
    renderHome();
    expect(await screen.findByText(/No recommendations yet/i)).toBeInTheDocument();
  });

  it('renders the center column with the hero banner and the community feed', async () => {
    mockApi();
    const { container } = renderHome();
    expect(container.querySelector('img.home-hero')).not.toBeNull();
    // Community feed empty state (from feature 001 FeedList).
    expect(await screen.findByText(/Your feed is quiet/i)).toBeInTheDocument();
  });

  it('opens the compose overlay when "Post an update" is clicked', async () => {
    mockApi();
    renderHome();
    // The compose form is not mounted until the overlay opens.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await userEvent.click(await screen.findByRole('button', { name: /post an update/i }));

    const dialog = await screen.findByRole('dialog', { name: /share what you’re doing now/i });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toBeInTheDocument();
  });
});
