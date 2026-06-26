import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PostUpdateForm } from '../src/components/PostUpdateForm';

function renderForm() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <PostUpdateForm />
    </QueryClientProvider>,
  );
}

describe('PostUpdateForm', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('shows a validation error and does not call the API when title is empty', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    renderForm();

    await userEvent.click(screen.getByRole('button', { name: /post update/i }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('submits to the API when given a valid title', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'a1',
          author: { id: 'u1', displayName: 'You', avatarUrl: null },
          mediaType: 'book',
          title: 'Dune',
          itemAuthor: null,
          createdAt: new Date().toISOString(),
          canDelete: true,
        }),
        { status: 201, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    renderForm();
    await userEvent.type(screen.getByLabelText('Title'), 'Dune');
    await userEvent.click(screen.getByRole('button', { name: /post update/i }));

    expect(fetchSpy).toHaveBeenCalled();
    const [, init] = fetchSpy.mock.calls[0]!;
    expect(init?.method).toBe('POST');
    expect(init?.credentials).toBe('include');
  });
});
