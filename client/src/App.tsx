import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { useEffect } from 'react';
import { RegisterPage } from './components/auth/RegisterPage.js';
import { LoginPage } from './components/auth/LoginPage.js';
import { AuthGuard } from './components/auth/AuthGuard.js';
import { useAuthStore } from './stores/authStore.js';

function HomePage() {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated());

  return (
    <main
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '2rem',
        textAlign: 'center',
        fontFamily: 'var(--font-sans)',
        color: 'var(--color-text)',
        background: 'var(--color-bg)',
      }}
    >
      <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🌅 Horizon</h1>
      <p style={{ fontSize: '1.25rem', opacity: 0.7, maxWidth: '32rem' }}>
        A theater-of-the-mind virtual tabletop — built for narrative play.
      </p>

      {isAuthenticated ? (
        <div style={{ marginTop: '2rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'center' }}>
          <p style={{ fontSize: '1rem', opacity: 0.8 }}>
            Welcome back, <strong>{user?.displayName}</strong>.
          </p>
          <Link
            to="/campaigns"
            style={{
              padding: '0.75rem 2rem',
              fontSize: '1rem',
              fontWeight: 600,
              color: 'var(--color-text-inverse)',
              background: 'var(--color-accent)',
              borderRadius: '6px',
              textDecoration: 'none',
            }}
          >
            My Campaigns
          </Link>
        </div>
      ) : (
        <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem' }}>
          <Link
            to="/login"
            style={{
              padding: '0.75rem 2rem',
              fontSize: '1rem',
              fontWeight: 600,
              color: 'var(--color-text-inverse)',
              background: 'var(--color-accent)',
              borderRadius: '6px',
              textDecoration: 'none',
            }}
          >
            Log In
          </Link>
          <Link
            to="/register"
            style={{
              padding: '0.75rem 2rem',
              fontSize: '1rem',
              fontWeight: 600,
              color: 'var(--color-accent)',
              background: 'transparent',
              border: '1px solid var(--color-accent)',
              borderRadius: '6px',
              textDecoration: 'none',
            }}
          >
            Register
          </Link>
        </div>
      )}
    </main>
  );
}

export function App() {
  const initialize = useAuthStore((s) => s.initialize);

  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/campaigns"
          element={
            <AuthGuard>
              <HomePage />
            </AuthGuard>
          }
        />
        <Route path="/" element={<HomePage />} />
      </Routes>
    </BrowserRouter>
  );
}
