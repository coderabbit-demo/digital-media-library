import '@testing-library/jest-dom/vitest';

// jsdom does not implement IntersectionObserver, used by FeedList for infinite
// scroll. Provide a no-op stub so component tests can mount it.
class IntersectionObserverStub implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = '';
  readonly thresholds = [];
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

globalThis.IntersectionObserver = IntersectionObserverStub;
