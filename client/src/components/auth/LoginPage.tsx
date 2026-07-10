import { useState, useRef, useEffect, type FormEvent } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useAuthStore } from '../../stores/authStore.js';
import './LoginPage.css';

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const emailRef = useRef<HTMLInputElement>(null);
  const setAuth = useAuthStore((s) => s.setAuth);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);

  const justRegistered = searchParams.get('registered') === 'true';
  const returnUrl = searchParams.get('return') || '/campaigns';

  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  function validate(): boolean {
    const next: Record<string, string> = {};

    if (!email.trim()) {
      next.email = 'Email is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      next.email = 'Enter a valid email address.';
    }

    if (!password) {
      next.password = 'Password is required.';
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setServerError('');

    if (!validate()) return;

    setLoading(true);
    try {
      const data = await api.post<{
        access_token: string;
        refresh_token: string;
        user: { id: string; email: string; displayName: string; avatarUrl: string | null; createdAt: string };
      }>('/api/auth/login', {
        email: email.trim(),
        password,
      });

      setAuth(data.user, data.access_token, data.refresh_token);
      navigate(returnUrl, { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed. Please try again.';
      setServerError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <div className="login-card">
        <h1 className="login-card__title">Log In</h1>

        {justRegistered && (
          <div className="login-card__success" role="status">
            Registration successful! Please log in.
          </div>
        )}

        {serverError && (
          <div className="login-card__error" role="alert">
            {serverError}
          </div>
        )}

        <form className="login-form" onSubmit={handleSubmit} noValidate>
          <div className="login-form__field">
            <label htmlFor="login-email">Email</label>
            <input
              ref={emailRef}
              id="login-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? 'login-email-error' : undefined}
            />
            {errors.email && (
              <span id="login-email-error" className="login-form__field-error" role="alert">
                {errors.email}
              </span>
            )}
          </div>

          <div className="login-form__field">
            <label htmlFor="login-password">Password</label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? 'login-password-error' : undefined}
            />
            {errors.password && (
              <span id="login-password-error" className="login-form__field-error" role="alert">
                {errors.password}
              </span>
            )}
          </div>

          <button type="submit" className="login-form__submit" disabled={loading}>
            {loading ? 'Logging in…' : 'Log In'}
          </button>
        </form>

        <p className="login-card__footer">
          Don&apos;t have an account? <Link to="/register">Register</Link>
        </p>
      </div>
    </main>
  );
}
