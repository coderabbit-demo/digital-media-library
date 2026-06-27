/** Shown above a Discover list when results are served from cache after a provider failure. */
export function StaleBanner() {
  return (
    <p className="stale-banner" role="status">
      These results may be out of date — we couldn’t reach the source just now.
    </p>
  );
}
