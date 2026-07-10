import { BrowserRouter, Routes, Route } from 'react-router-dom';

function WelcomePage() {
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
      <p style={{ fontSize: '0.875rem', opacity: 0.5, marginTop: '2rem' }}>
        Phase 0 Scaffold &bull; Coming soon
      </p>
    </main>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<WelcomePage />} />
      </Routes>
    </BrowserRouter>
  );
}
