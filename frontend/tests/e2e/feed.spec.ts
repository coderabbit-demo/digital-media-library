import { test, expect, type Page, type Route } from '@playwright/test';
import type { ActivityDTO, FeedPageDTO, ProfileDTO } from '@dml/shared';

/**
 * E2E smoke for the auth -> post -> see-in-feed flow.
 *
 * The real Google OAuth step is STUBBED: rather than driving Google's consent
 * screen, we intercept the app's own /api/* calls. The "Sign in with Google"
 * button redirects to /api/auth/google/login; we fulfill that as a redirect
 * straight to the SPA's /auth/callback (mimicking the backend setting a session
 * cookie), and we serve an authenticated /me from then on. This keeps the smoke
 * test hermetic and independent of real Google.
 *
 * Alternative for a real backend run: seed a test session cookie via
 * `context.addCookies([{ name: 'dml_session', value: '<signed test session>' }])`.
 */

const ME: ProfileDTO = {
  id: 'user-1',
  displayName: 'Test User',
  avatarUrl: null,
};

function activity(partial: Partial<ActivityDTO> & Pick<ActivityDTO, 'id' | 'title'>): ActivityDTO {
  return {
    author: { id: ME.id, displayName: ME.displayName, avatarUrl: null },
    mediaType: 'book',
    itemAuthor: null,
    note: null,
    replyCount: 0,
    coverUrl: null,
    providerId: null,
    description: null,
    providerUrl: null,
    createdAt: new Date().toISOString(),
    canDelete: true,
    ...partial,
  };
}

async function installApiStubs(page: Page) {
  // In-memory feed the stub mutates as the test posts.
  const feed: ActivityDTO[] = [];
  let authenticated = false;

  // Begin sign-in: backend would redirect to Google then back to the SPA.
  // We short-circuit straight to the SPA callback and mark the session active.
  await page.route('**/api/auth/google/login', async (route: Route) => {
    authenticated = true;
    await route.fulfill({
      status: 302,
      headers: { location: 'http://localhost:5173/auth/callback' },
      body: '',
    });
  });

  await page.route('**/api/me', async (route: Route) => {
    if (!authenticated) {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'unauthenticated', message: 'Not authenticated.' }),
      });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ME) });
  });

  await page.route('**/api/feed*', async (route: Route) => {
    const body: FeedPageDTO = { items: [...feed], nextCursor: null };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });

  await page.route('**/api/activities', async (route: Route) => {
    const payload = route.request().postDataJSON() as { mediaType: ActivityDTO['mediaType']; title: string };
    const created = activity({
      id: `srv-${feed.length + 1}`,
      title: payload.title,
      mediaType: payload.mediaType,
    });
    feed.unshift(created);
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify(created),
    });
  });

  await page.route('**/api/auth/logout', async (route: Route) => {
    authenticated = false;
    await route.fulfill({ status: 204, body: '' });
  });
}

test('sign in, post an update, and see it in the feed', async ({ page }) => {
  await installApiStubs(page);

  // Unauthenticated visitor is sent to sign-in.
  await page.goto('/');
  await expect(page.getByRole('button', { name: /sign in with google/i })).toBeVisible();

  // Sign in (stubbed OAuth) and land on the authenticated home feed.
  await page.getByRole('button', { name: /sign in with google/i }).click();

  // SC-005: initial feed visible within 2s of landing authenticated.
  const feedStart = Date.now();
  await expect(page.getByRole('heading', { name: /digital media library/i })).toBeVisible();
  await expect(page.getByText(/your feed is quiet/i)).toBeVisible();
  const feedElapsed = Date.now() - feedStart;
  expect(feedElapsed).toBeLessThan(2000);

  // Post a new update.
  const title = 'Project Hail Mary';
  await page.getByLabel('Title').fill(title);

  const postStart = Date.now();
  await page.getByRole('button', { name: /post update/i }).click();

  // SC-004: the posted update appears at the top of the feed within 3s.
  await expect(page.getByText(title)).toBeVisible();
  const postElapsed = Date.now() - postStart;
  expect(postElapsed).toBeLessThan(3000);

  // It is attributed to the author.
  await expect(page.getByText(ME.displayName).first()).toBeVisible();
});
