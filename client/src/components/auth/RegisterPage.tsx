import { useState, useRef, useEffect, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../../api/client.js';
import './RegisterPage.css';

export function RegisterPage() {
  const navigate = useNavigate();
  const emailRef = useRef<HTMLInputElement>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);

  // Focus email field on mount
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
    } else if (password.length < 8) {
      next.password = 'Password must be at least 8 characters.';
    }

    if (!displayName.trim()) {
      next.displayName = 'Display name is required.';
    } else if (displayName.trim().length < 2) {
      next.displayName = 'Display name must be at least 2 characters.';
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
      await api.post('/api/auth/register', {
        email: email.trim(),
        password,
        displayName: displayName.trim(),
      });
      navigate('/login?registered=true');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Registration failed. Please try again.';
      setServerError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="register-page">
      <div className="register-card">
        <h1 className="register-card__title">Create Account</h1>

        {serverError && (
          <div className="register-card__error" role="alert">
            {serverError}
          </div>
        )}

        <form className="register-form" onSubmit={handleSubmit} noValidate>
          <div className="register-form__field">
            <label htmlFor="register-email">Email</label>
            <input
              ref={emailRef}
              id="register-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? 'register-email-error' : undefined}
            />
            {errors.email && (
              <span id="register-email-error" className="register-form__field-error" role="alert">
                {errors.email}
              </span>
            )}
          </div>

          <div className="register-form__field">
            <label htmlFor="register-password">Password</label>
            <input
              id="register-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? 'register-password-error' : undefined}
            />
            {errors.password && (
              <span id="register-password-error" className="register-form__field-error" role="alert">
                {errors.password}
              </span>
            )}
          </div>

          <div className="register-form__field">
            <label htmlFor="register-display-name">Display Name</label>
            <input
              id="register-display-name"
              type="text"
              autoComplete="name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              aria-invalid={!!errors.displayName}
              aria-describedby={errors.displayName ? 'register-displayname-error' : undefined}
            />
            {errors.displayName && (
              <span id="register-displayname-error" className="register-form__field-error" role="alert">
                {errors.displayName}
              </span>
            )}
          </div>

          <button type="submit" className="register-form__submit" disabled={loading}>
            {loading ? 'Creating account…' : 'Create Account'}
          </button>
        </form>

        <p className="register-card__footer">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </div>
    </main>
  );
}
