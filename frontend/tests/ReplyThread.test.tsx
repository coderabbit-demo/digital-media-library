import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReplyThreadDTO } from '@dml/shared';
import { ReplyThread } from '../src/components/ReplyThread';

const thread: ReplyThreadDTO = {
  activityId: 'a1',
  count: 2,
  replies: [
    { id: 'r1', activityId: 'a1', parentId: null, author: { id: 'u1', displayName: 'Ada', avatarUrl: null }, body: 'Top reply', createdAt: '2026-06-01T00:00:00Z', deleted: false, canDelete: true },
    { id: 'r2', activityId: 'a1', parentId: 'r1', author: { id: 'u2', displayName: 'Bob', avatarUrl: null }, body: 'Nested reply', createdAt: '2026-06-01T01:00:00Z', deleted: false, canDelete: false },
  ],
};

function mockApi() {
  const calls: { url: string; init?: RequestInit }[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    if (url.includes('/replies') && init?.method === 'POST') {
      return Promise.resolve(new Response(JSON.stringify({ id: 'r3' }), { status: 201, headers: { 'Content-Type': 'application/json' } }));
    }
    if (url.includes('/replies')) {
      return Promise.resolve(new Response(JSON.stringify(thread), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    }
    return Promise.resolve(new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }));
  });
  return calls;
}

function renderThread() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ReplyThread activityId="a1" />
    </QueryClientProvider>,
  );
}

describe('ReplyThread', () => {
  afterEach(() => vi.restoreAllMocks());

  it('renders nested replies with authors', async () => {
    mockApi();
    renderThread();
    expect(await screen.findByText('Top reply')).toBeInTheDocument();
    expect(screen.getByText('Nested reply')).toBeInTheDocument();
    expect(screen.getByText('Ada')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('posts a top-level reply', async () => {
    const calls = mockApi();
    renderThread();
    await screen.findByText('Top reply');

    await userEvent.type(screen.getByLabelText('Reply'), 'My new reply');
    await userEvent.click(screen.getByRole('button', { name: 'Post reply' }));

    await waitFor(() => {
      const post = calls.find((c) => c.url.includes('/activities/a1/replies') && c.init?.method === 'POST');
      expect(post).toBeTruthy();
      expect(JSON.parse(String(post!.init!.body))).toMatchObject({ body: 'My new reply', parentId: null });
    });
  });
});
