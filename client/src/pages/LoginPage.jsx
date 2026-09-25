import { useState } from 'react';
import { request } from '../api.js';

export default function LoginPage({ onAuthenticated }) {
  const [registering, setRegistering] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const route = registering ? '/auth/register' : '/auth/login';
      onAuthenticated(await request(route, {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      }));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-layout">
      <section className="welcome-panel">
        <a className="brand" href="/" aria-label="ChatFlow home"><span className="brand-mark">c</span>ChatFlow</a>
        <div className="welcome-copy">
          <span className="kicker">YOUR SPACE TO TALK</span>
          <h1>Good conversations<br />start here.</h1>
          <p>A simple place to catch up, share a thought, and keep the conversation going.</p>
          <span className="welcome-rule" />
          <small>Just you and the people you want to hear from.</small>
        </div>
        <small className="welcome-foot">CHATFLOW <span>·</span> PRIVATE BY DEFAULT</small>
      </section>

      <section className="login-panel">
        <div className="login-box">
          <a className="brand mobile-brand" href="/" aria-label="ChatFlow home"><span className="brand-mark">c</span>ChatFlow</a>
          <span className="kicker">{registering ? 'A FRESH START' : 'WELCOME BACK'}</span>
          <h2>{registering ? 'Create your account' : 'Sign in to ChatFlow'}</h2>
          <p className="login-hint">{registering ? 'Choose a name your friends will recognize.' : 'Your conversations are right where you left them.'}</p>
          <form className="login-form" onSubmit={submit}>
            <label htmlFor="username">Username</label>
            <input id="username" autoComplete="username" maxLength={20} placeholder="e.g. alex_morgan" required value={username} onChange={(event) => setUsername(event.target.value)} />
            <label htmlFor="password">Password</label>
            <input id="password" autoComplete={registering ? 'new-password' : 'current-password'} placeholder={registering ? 'At least 8 characters' : 'Enter your password'} required type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
            {error && <p className="error" role="alert">{error}</p>}
            <button className="primary-button" disabled={submitting} type="submit">{submitting ? 'Please wait...' : registering ? 'Create account' : 'Login'}</button>
          </form>
          <div className="account-switch">
            <span>{registering ? 'Already have an account?' : 'New to ChatFlow?'}</span>
            <button className="link-button" type="button" onClick={() => { setError(''); setRegistering(!registering); }}>{registering ? 'Login' : 'Create account'}</button>
          </div>
        </div>
        <small className="login-foot">By continuing, you agree to keep things kind and respectful.</small>
      </section>
    </main>
  );
}