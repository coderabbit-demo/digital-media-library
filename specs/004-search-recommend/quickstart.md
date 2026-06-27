# Quickstart: Search & Recommendations (004)

## Prerequisites

- Features 001–003 running locally (`pnpm dev`), signed in via Google.
- No new env. Books search uses the optional `GOOGLE_BOOKS_API_KEY` (already set
  in 003); all Apple/iTunes search is keyless.

## Apply the migration

```bash
corepack pnpm -C backend exec prisma migrate dev --name add_recommendation
```

## Manual validation

1. **Search + recommend (US1)**: Open **Search**, pick a category, type a title
   (e.g. "dune"). Results render with cover/title/creator. Click **Recommend** on
   one → it appears in the home **Recommendations** panel, attributed to you,
   most recent first. Search the same terms again → served from cache (no extra
   provider call; see logs). Recommend the same item again → no duplicate.
2. **Remove a recommendation (US1)**: In the home Recommendations panel, remove
   one you made → it disappears.
3. **Start activity from a result (US2)**: Click **I'm reading/listening to this**
   on a search result → compose opens pre-filled → submit → appears in the feed.
4. **Empty state**: Search gibberish → clear "no results" state (not an error).

## Automated checks

```bash
corepack pnpm -r test:unit          # shared + backend + frontend unit
corepack pnpm -C backend exec vitest run tests/integration/search.test.ts \
  tests/integration/recommendations.test.ts
corepack pnpm -w lint && corepack pnpm -r build
```

See `contracts/openapi.yaml` for the API and `data-model.md` for the schema.
