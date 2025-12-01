import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/shared/Button';
import { Input } from '@/components/shared/Input';
import {
  PageTitle,
  Description,
  Label,
  Text,
} from '@/components/shared/Typography';
import './Login.css';

type AuthMode = 'signin' | 'signup';

export function Login() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    if (mode === 'signup') {
      if (password !== confirmPassword) {
        setError('Passwords do not match');
        setLoading(false);
        return;
      }

      const { error } = await signUp(email, password);
      if (error) {
        setError(error.message);
      } else {
        setMessage('Check your email to confirm your account');
        setMode('signin');
        setPassword('');
        setConfirmPassword('');
      }
    } else {
      const { error } = await signIn(email, password);
      if (error) {
        setError(error.message);
      }
    }

    setLoading(false);
  };

  const toggleMode = () => {
    setMode(mode === 'signin' ? 'signup' : 'signin');
    setError(null);
    setMessage(null);
    setPassword('');
    setConfirmPassword('');
  };

  const isSignUp = mode === 'signup';

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <PageTitle>Portfolio Tracker</PageTitle>
          <Description>
            {isSignUp ? 'Create a new account' : 'Sign in to continue'}
          </Description>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {error && (
            <div className="login-error">
              <Text color="primary">{error}</Text>
            </div>
          )}

          {message && (
            <div className="login-message">
              <Text>{message}</Text>
            </div>
          )}

          <div className="form-group">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              inputSize="lg"
              fullWidth
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              inputSize="lg"
              fullWidth
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
            />
          </div>

          {isSignUp && (
            <div className="form-group">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                inputSize="lg"
                fullWidth
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            disabled={loading}
          >
            {loading
              ? isSignUp
                ? 'Creating account...'
                : 'Signing in...'
              : isSignUp
              ? 'Create Account'
              : 'Sign In'}
          </Button>
        </form>

        <div className="login-footer">
          <button
            type="button"
            className="toggle-auth-btn"
            onClick={toggleMode}
          >
            {isSignUp
              ? 'Already have an account? Sign in'
              : "Don't have an account? Sign up"}
          </button>
        </div>
      </div>
    </div>
  );
}
