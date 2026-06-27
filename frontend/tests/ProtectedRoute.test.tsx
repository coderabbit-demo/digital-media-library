import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '../src/components/ProtectedRoute';

function renderApp() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <div>protected content</div>
              </ProtectedRoute>
            }
          />
          <Route path="/signin" element={<div>sign in page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function mockMe(status: number, body: unknown) {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}

describe('ProtectedRoute', () => {
  afterEach(() => vi.restoreAllMocks());

  it('redirects to /signin when unauthenticated (401)', async () => {
    mockMe(401, { error: 'unauthenticated', message: 'no session' });
    renderApp();
    expect(await screen.findByText('sign in page')).toBeInTheDocument();
    expect(screen.queryByText('protected content')).not.toBeInTheDocument();
  });

  it('renders children when authenticated', async () => {
    mockMe(200, { id: 'u1', displayName: 'Ada', avatarUrl: null });
    renderApp();
    expect(await screen.findByText('protected content')).toBeInTheDocument();
    expect(screen.queryByText('sign in page')).not.toBeInTheDocument();
  });
});
