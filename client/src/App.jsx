import { useEffect, useState } from 'react';
import { request } from './api.js';
import ChatPage from './pages/ChatPage.jsx';
import LoginPage from './pages/LoginPage.jsx';

const TOKEN_KEY = 'chatflow-token';

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(Boolean(token));

  useEffect(() => {
    if (!token) {
      setChecking(false);
      return undefined;
    }
    let current = true;
    request('/auth/me', { token })
      .then(({ user: account }) => { if (current) setUser(account); })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        if (current) { setToken(null); setUser(null); }
      })
      .finally(() => { if (current) setChecking(false); });
    return () => { current = false; };
  }, [token]);

  function login(session) {
    localStorage.setItem(TOKEN_KEY, session.token);
    setToken(session.token);
    setUser(session.user);
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }

  if (checking) return <main className="loading">ChatFlow</main>;
  if (!token || !user) return <LoginPage onAuthenticated={login} />;
  return <ChatPage token={token} user={user} onLogout={logout} />;
}