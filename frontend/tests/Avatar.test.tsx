import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Avatar, initialsOf } from '../src/components/Avatar';

describe('initialsOf', () => {
  it('uses first + last initials for multi-word names', () => {
    expect(initialsOf('Ada Lovelace')).toBe('AL');
    expect(initialsOf('  grace   brewster  hopper ')).toBe('GH');
  });
  it('uses a single initial for one-word names', () => {
    expect(initialsOf('Prince')).toBe('P');
  });
  it('falls back to ? for an empty name', () => {
    expect(initialsOf('   ')).toBe('?');
  });
});

describe('Avatar', () => {
  it('renders the profile picture when a URL is provided (no visible name)', () => {
    render(<Avatar displayName="Ada Lovelace" avatarUrl="http://example.com/a.png" />);
    const img = screen.getByRole('img', { name: 'Ada Lovelace' });
    expect(img).toHaveAttribute('src', 'http://example.com/a.png');
    // The full name is not shown as visible text.
    expect(screen.queryByText('Ada Lovelace')).not.toBeInTheDocument();
  });

  it('renders initials when no picture is available', () => {
    render(<Avatar displayName="Ada Lovelace" avatarUrl={null} />);
    expect(screen.getByText('AL')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Ada Lovelace' })).toBeInTheDocument();
  });
});
