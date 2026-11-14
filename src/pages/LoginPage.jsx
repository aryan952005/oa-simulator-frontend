import { useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { login } from '../api/auth';
import { useAuth } from '../auth/AuthContext';
import { safeReturnTo } from '../auth/returnTo';
import ErrorBanner, { canRetry } from '../components/ErrorBanner';
import { PasswordField, TextField } from '../components/TextField';
import AuthLayout from '../layouts/AuthLayout';
import { fieldErrorsFromDetails, validateEmail, validatePasswordPresent } from '../lib/validation';

const FIELDS = ['email', 'password'];

// S2 Login (/login)
export default function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const passwordRef = useRef(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState(null); // an ApiError shown as a banner
  const [submitting, setSubmitting] = useState(false);

  function edit(setter, field) {
    return (event) => {
      setter(event.target.value);
      if (fieldErrors[field]) setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    };
  }

  async function submit(event) {
    if (event) event.preventDefault();
    if (submitting) return;

    const errors = {};
    const emailError = validateEmail(email);
    const passwordError = validatePasswordPresent(password);
    if (emailError) errors.email = emailError;
    if (passwordError) errors.password = passwordError;
    setError(null);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      const { token, user } = await login({ email: email.trim(), password });
      signIn(token, user);
      navigate(safeReturnTo(params.get('returnTo')) || '/dashboard', { replace: true });
    } catch (err) {
      setSubmitting(false);
      if (err.code === 'INVALID_CREDENTIALS') {
        // One message for a wrong email and a wrong password. The password field is cleared.
        setPassword('');
        setError(err);
        passwordRef.current?.focus();
      } else if (err.code === 'VALIDATION_ERROR') {
        const { fields, unmatched } = fieldErrorsFromDetails(err.details, FIELDS);
        setFieldErrors(fields);
        if (unmatched) setError(err);
      } else {
        setError(err);
      }
    }
  }

  return (
    <AuthLayout screen="S2" title="Welcome back" subtitle="Log in to continue your practice.">
      <div className="flex flex-col gap-space-xs">
        <h1 className="font-headline-lg text-headline-lg text-on-surface">Log in</h1>
      </div>

      {error && <ErrorBanner error={error} onRetry={canRetry(error) ? submit : undefined} />}

      <form onSubmit={submit} noValidate className="flex flex-col gap-space-md">
        <TextField
          id="email"
          name="email"
          label="Email"
          type="email"
          icon="mail"
          autoComplete="email"
          value={email}
          onChange={edit(setEmail, 'email')}
          error={fieldErrors.email}
        />
        <PasswordField
          id="password"
          name="password"
          label="Password"
          autoComplete="current-password"
          inputRef={passwordRef}
          value={password}
          onChange={edit(setPassword, 'password')}
          error={fieldErrors.password}
        />
        <button
          type="submit"
          disabled={submitting}
          className="h-11 rounded-lg bg-primary-container text-on-primary font-label-ui text-label-ui hover:bg-primary-hover hover:shadow-primary-hover disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:shadow-none transition-all"
        >
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <p className="font-body-md text-body-md text-on-surface-variant">
        Don&apos;t have an account?{' '}
        <Link to="/register" className="text-primary font-label-ui text-label-ui hover:underline">
          Create account
        </Link>
      </p>
    </AuthLayout>
  );
}
