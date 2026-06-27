/** Derive up to two uppercase initials from a display name. */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.charAt(0).toUpperCase();
  return (parts[0]!.charAt(0) + parts[parts.length - 1]!.charAt(0)).toUpperCase();
}

interface AvatarProps {
  displayName: string;
  avatarUrl?: string | null;
  /** Accessible label; defaults to the display name. */
  label?: string;
}

/**
 * Circular avatar: shows the user's profile picture when available, otherwise
 * their initials. The display name is conveyed via the accessible label/title,
 * not shown as visible text.
 */
export function Avatar({ displayName, avatarUrl, label }: AvatarProps) {
  const aria = label ?? displayName;
  if (avatarUrl) {
    return (
      <img
        className="avatar"
        src={avatarUrl}
        alt={aria}
        title={aria}
        referrerPolicy="no-referrer"
      />
    );
  }
  return (
    <span className="avatar avatar--initials" role="img" aria-label={aria} title={aria}>
      {initialsOf(displayName)}
    </span>
  );
}
