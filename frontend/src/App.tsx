import { Navigate, Route, Routes } from 'react-router-dom';
import { HomeFeed } from './pages/HomeFeed';
import { SignIn } from './pages/SignIn';
import { AuthCallback } from './pages/AuthCallback';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeFeed />} />
      <Route path="/signin" element={<SignIn />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
