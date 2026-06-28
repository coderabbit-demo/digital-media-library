import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { itemPathFor, type MediaType } from '@dml/shared';

interface ItemLinkProps {
  mediaType: MediaType;
  /** The provider id; when absent (e.g. some feed posts), children render unlinked. */
  providerId: string | null | undefined;
  className?: string;
  children: ReactNode;
}

/**
 * Links an item's cover or title to its detail page (feature 007). Renders the
 * children unwrapped when there's no provider id to link to.
 */
export function ItemLink({ mediaType, providerId, className, children }: ItemLinkProps) {
  if (!providerId) return <>{children}</>;
  return (
    <Link className={className} to={itemPathFor(mediaType, providerId)}>
      {children}
    </Link>
  );
}
