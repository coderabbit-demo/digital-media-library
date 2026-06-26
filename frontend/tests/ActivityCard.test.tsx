import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ActivityDTO } from '@dml/shared';
import { ActivityCard } from '../src/components/ActivityCard';

function makeActivity(overrides: Partial<ActivityDTO> = {}): ActivityDTO {
  return {
    id: 'a1',
    author: { id: 'u1', displayName: 'Ada Lovelace', avatarUrl: null },
    mediaType: 'book',
    title: 'The Left Hand of Darkness',
    itemAuthor: 'Ursula K. Le Guin',
    createdAt: new Date().toISOString(),
    canDelete: false,
    ...overrides,
  };
}

describe('ActivityCard', () => {
  it('renders author, title, item author and media badge', () => {
    render(<ActivityCard activity={makeActivity()} />);
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('The Left Hand of Darkness')).toBeInTheDocument();
    expect(screen.getByText(/Ursula K\. Le Guin/)).toBeInTheDocument();
    expect(screen.getByText('Book')).toBeInTheDocument();
  });

  it('hides the delete control when canDelete is false', () => {
    render(<ActivityCard activity={makeActivity({ canDelete: false })} onDelete={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
  });

  it('shows the delete control and calls onDelete when canDelete is true', async () => {
    const onDelete = vi.fn();
    render(<ActivityCard activity={makeActivity({ canDelete: true })} onDelete={onDelete} />);
    const btn = screen.getByRole('button', { name: /delete/i });
    expect(btn).toBeInTheDocument();
    await userEvent.click(btn);
    expect(onDelete).toHaveBeenCalledWith('a1');
  });

  it('renders HTML-like text as plain text, never as markup (FR-018)', () => {
    const malicious = '<img src=x onerror=alert(1)>';
    const { container } = render(
      <ActivityCard activity={makeActivity({ title: malicious })} />,
    );
    expect(screen.getByText(malicious)).toBeInTheDocument();
    expect(container.querySelector('img[onerror]')).toBeNull();
  });
});
