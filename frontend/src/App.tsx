import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { ProtectedRoute } from './components/ProtectedRoute';
import { HomeFeed } from './pages/HomeFeed';
import { SignIn } from './pages/SignIn';
import { AuthCallback } from './pages/AuthCallback';
import { CategoryPlaceholder } from './pages/CategoryPlaceholder';
import { WishlistPlaceholder } from './pages/WishlistPlaceholder';

/** Auth gate + shell wrapping every protected route (FR-001/FR-002). */
function ProtectedLayout() {
  return (
    <ProtectedRoute>
      <AppShell>
        <Outlet />
      </AppShell>
    </ProtectedRoute>
  );
}

export function App() {
  return (
    <Routes>
      {/* Public: only the sign-in/registration and OAuth callback routes. */}
      <Route path="/signin" element={<SignIn />} />
      <Route path="/auth/callback" element={<AuthCallback />} />

      {/* Everything else requires authentication and renders in the shell. */}
      <Route element={<ProtectedLayout />}>
        <Route path="/" element={<HomeFeed />} />
        <Route path="/books" element={<CategoryPlaceholder category="book" />} />
        <Route path="/music" element={<CategoryPlaceholder category="music" />} />
        <Route path="/audiobooks" element={<CategoryPlaceholder category="audiobook" />} />
        <Route path="/wishlist" element={<WishlistPlaceholder />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
