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
    createdAt: new Date().toISOString(),
    canDelete: false,
    ...overrides,
  };
}

function renderCard(activity: ActivityDTO, onDelete?: (id: string) => void) {
  // The card uses react-query (library shelf control); provide a client + stub fetch.
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify({ items: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
  );
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ActivityCard activity={activity} onDelete={onDelete} />
    </QueryClientProvider>,
  );
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
    const { container } = renderCard(makeActivity({ title: malicious }));
    expect(screen.getByText(malicious)).toBeInTheDocument();
    expect(container.querySelector('img[onerror]')).toBeNull();
  });
});
