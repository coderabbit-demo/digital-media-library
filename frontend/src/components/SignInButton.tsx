import { redirectToLogin } from '../services/auth';

/** Button that kicks off the Google OIDC sign-in redirect. */
export function SignInButton({ label = 'Sign in with Google' }: { label?: string }) {
  return (
    <button type="button" className="btn btn-primary signin-btn" onClick={redirectToLogin}>
      <span className="signin-btn__g" aria-hidden="true">
        G
      </span>
      {label}
    </button>
  );
}
