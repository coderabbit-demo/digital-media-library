import { describe, expect, it } from 'vitest';
import { toProfileDTO } from '../../src/services/profile.js';

describe('unit: toProfileDTO', () => {
  it('maps only public fields and never leaks google_sub/email', () => {
    const dto = toProfileDTO({ id: 'u1', displayName: 'Ada', avatarUrl: 'http://x/a.png' });
    expect(dto).toEqual({ id: 'u1', displayName: 'Ada', avatarUrl: 'http://x/a.png' });
    expect(dto).not.toHaveProperty('googleSub');
    expect(dto).not.toHaveProperty('email');
  });

  it('normalizes a missing avatar to null', () => {
    const dto = toProfileDTO({ id: 'u1', displayName: 'Ada', avatarUrl: null });
    expect(dto.avatarUrl).toBeNull();
  });
});
