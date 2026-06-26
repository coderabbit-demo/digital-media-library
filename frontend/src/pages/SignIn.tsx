import { Navigate, useSearchParams } from 'react-router-dom';
import { SignInButton } from '../components/SignInButton';
import { useMe } from '../services/auth';

/**
 * Sign-in landing page. If already authenticated, redirects home. When the
 * backend bounces the user back after a declined/failed Google consent, it adds
 * an `error` query param (FR-006) which we surface as a clear message.
 */
export function SignIn() {
  const { data: me, isLoading } = useMe();
  const [params] = useSearchParams();
  const errorIndicator = params.get('error');

  if (isLoading) {
    return <p className="feed-status" role="status">Checking your session…</p>;
  }

  if (me) {
    return <Navigate to="/" replace />;
  }

  return (
    <main className="signin-page">
      <div className="card signin-card">
        <h1 className="signin-card__title">Digital Media Library</h1>
        <p className="signin-card__tagline">
          See what people are reading and listening to — and share your own.
        </p>

        {errorIndicator ? (
          <p className="signin-card__error" role="alert">
            Sign-in didn’t complete. You weren’t signed in and no account was created. Please
            try again.
          </p>
        ) : null}

        <SignInButton />

        <p className="signin-card__fineprint">
          We only use your Google display name and avatar to set up your profile.
        </p>
      </div>
    </main>
  );
}
