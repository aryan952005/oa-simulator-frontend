import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { register } from '../api/auth';
import { useAuth } from '../auth/AuthContext';
import ErrorBanner, { canRetry } from '../components/ErrorBanner';
import { PasswordField, TextField } from '../components/TextField';
import { PASSWORD_MAX_BYTES, PASSWORD_MIN_BYTES } from '../config/limits';
import AuthLayout from '../layouts/AuthLayout';
import {
  fieldErrorsFromDetails,
  passwordChecks,
  validateConfirmation,
  validateEmail,
  validateName,
  validateNewPassword,
} from '../lib/validation';

const FIELDS = ['name', 'email', 'password'];

// FD4: a checklist of the real password rules replaces the strength bar.
function ChecklistRow({ met, children }) {
  return (
    <li className={`flex items-center gap-space-sm font-body-sm text-body-sm ${met ? 'text-success' : 'text-on-surface-variant'}`}>
      <span aria-hidden="true" className="material-symbols-outlined text-[18px]">
        {met ? 'check_circle' : 'radio_button_unchecked'}
      </span>
      <span>{children}</span>
      <span className="sr-only">{met ? '(met)' : '(not met)'}</span>
    </li>
  );
}

// S3 Register (/register)
export default function RegisterPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState(null); // an ApiError shown as a banner
  const [submitting, setSubmitting] = useState(false);

  const checks = passwordChecks(password, confirmation);

  function edit(setter, field) {
    return (event) => {
      setter(event.target.value);
      if (fieldErrors[field]) setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
      if (field === 'password' && fieldErrors.confirmation) {
        setFieldErrors((prev) => ({ ...prev, confirmation: undefined }));
      }
    };
  }

  async function submit(event) {
    if (event) event.preventDefault();
    if (submitting) return;

    const errors = {};
    const nameError = validateName(name);
    const emailError = validateEmail(email);
    const passwordError = validateNewPassword(password);
    // The confirmation is a browser-only check (FD3). A mismatch blocks the submit with no network call.
    const confirmationError = validateConfirmation(password, confirmation);
    if (nameError) errors.name = nameError;
    if (emailError) errors.email = emailError;
    if (passwordError) errors.password = passwordError;
    if (confirmationError) errors.confirmation = confirmationError;
    setError(null);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      const { token, user } = await register({ name: name.trim(), email: email.trim(), password });
      signIn(token, user);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setSubmitting(false);
      if (err.code === 'EMAIL_TAKEN') {
        setFieldErrors({ email: 'This email already has an account.' });
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
    <AuthLayout
      screen="S3"
      title="Create your account"
      subtitle="Build timed Python rounds and read a report of each one."
    >
      <div className="flex flex-col gap-space-xs">
        <h1 className="font-headline-lg text-headline-lg text-on-surface">Create account</h1>
      </div>

      {error && <ErrorBanner error={error} onRetry={canRetry(error) ? submit : undefined} />}

      <form onSubmit={submit} noValidate className="flex flex-col gap-space-md">
        <TextField
          id="name"
          name="name"
          label="Full name"
          icon="person"
          autoComplete="name"
          value={name}
          onChange={edit(setName, 'name')}
          error={fieldErrors.name}
        />
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
        <div className="flex flex-col gap-space-sm">
          <PasswordField
            id="password"
            name="password"
            label="Password"
            autoComplete="new-password"
            value={password}
            onChange={edit(setPassword, 'password')}
            error={fieldErrors.password}
          />
          <ul aria-label="Password rules" className="flex flex-col gap-space-xs">
            <ChecklistRow met={checks.min}>At least {PASSWORD_MIN_BYTES} bytes</ChecklistRow>
            <ChecklistRow met={checks.max}>At most {PASSWORD_MAX_BYTES} bytes</ChecklistRow>
            <ChecklistRow met={checks.match}>Matches the confirmation</ChecklistRow>
          </ul>
        </div>
        <PasswordField
          id="confirmation"
          name="confirmation"
          label="Confirm password"
          autoComplete="new-password"
          value={confirmation}
          onChange={edit(setConfirmation, 'confirmation')}
          error={fieldErrors.confirmation}
        />
        <button
          type="submit"
          disabled={submitting}
          className="h-11 rounded-lg bg-primary-container text-on-primary font-label-ui text-label-ui hover:bg-primary-hover hover:shadow-primary-hover disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:shadow-none transition-all"
        >
          {submitting ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <p className="font-body-md text-body-md text-on-surface-variant">
        Already have an account?{' '}
        <Link to="/login" className="text-primary font-label-ui text-label-ui hover:underline">
          Log in
        </Link>
      </p>
    </AuthLayout>
  );
}
