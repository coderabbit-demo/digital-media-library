import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ActivityDTO } from '@dml/shared';
import { ActivityCard } from '../src/components/ActivityCard';

function makeActivity(overrides: Partial<ActivityDTO> = {}): ActivityDTO {
  return {
    id: 'a1',
    author: { id: 'u1', displayName: 'Ada Lovelace', avatarUrl: null },
    mediaType: 'book',
    title: 'The Left Hand of Darkness',
    itemAuthor: 'Ursula K. Le Guin',
    note: null,
    replyCount: 0,
    coverUrl: null,
    providerId: null,
    description: null,
    providerUrl: null,
    likeCount: 0,
    likedByMe: false,
    createdAt: new Date().toISOString(),
    canDelete: false,
    ...overrides,
  };
}

function renderCard(activity: ActivityDTO, onDelete?: (id: string) => void) {
  // The card uses react-query (library/ratings/likes); provide a client + stub fetch.
  const calls: { url: string; init?: RequestInit }[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    const body = String(input).includes('/ratings') ? { ratings: [] } : { items: [] };
    return Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } }));
  });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <ActivityCard activity={activity} onDelete={onDelete} />
    </QueryClientProvider>,
  );
  return { calls };
}

describe('ActivityCard', () => {
  afterEach(() => vi.restoreAllMocks());

  it('renders author, title, item author and media badge', () => {
    renderCard(makeActivity());
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('The Left Hand of Darkness')).toBeInTheDocument();
    expect(screen.getByText(/Ursula K\. Le Guin/)).toBeInTheDocument();
    expect(screen.getByText('Book')).toBeInTheDocument();
  });

  it('hides the delete control when canDelete is false', () => {
    renderCard(makeActivity({ canDelete: false }), vi.fn());
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
  });

  it('shows the delete control and calls onDelete when canDelete is true', async () => {
    const onDelete = vi.fn();
    renderCard(makeActivity({ canDelete: true }), onDelete);
    const btn = screen.getByRole('button', { name: /delete/i });
    await userEvent.click(btn);
    expect(onDelete).toHaveBeenCalledWith('a1');
  });

  it('renders HTML-like text as plain text, never as markup (FR-018)', () => {
    const malicious = '<img src=x onerror=alert(1)>';
    renderCard(makeActivity({ title: malicious }));
    expect(screen.getByText(malicious)).toBeInTheDocument();
    expect(document.querySelector('img[onerror]')).toBeNull();
  });

  it('likes an update and rates an item with a provider id', async () => {
    const { calls } = renderCard(makeActivity({ providerId: 'b1', likeCount: 0, likedByMe: false }));

    await userEvent.click(screen.getByRole('button', { name: /Like/ }));
    const like = calls.find((c) => c.url.includes('/activities/a1/like') && c.init?.method === 'POST');
    expect(like).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: '4 stars' }));
    const rate = calls.find((c) => c.url.includes('/ratings') && c.init?.method === 'PUT');
    expect(rate).toBeTruthy();
    expect(JSON.parse(String(rate!.init!.body))).toMatchObject({ providerId: 'b1', stars: 4 });
  });
});
