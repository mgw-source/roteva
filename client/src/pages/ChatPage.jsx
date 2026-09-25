import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { request } from '../api.js';

const time = (value) => new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(value));
const initials = (name) => name.slice(0, 2).toUpperCase();

export default function ChatPage({ token, user, onLogout }) {
  const [conversations, setConversations] = useState([]);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [search, setSearch] = useState('');
  const [people, setPeople] = useState([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const socketRef = useRef(null);
  const selectedIdRef = useRef(null);
  const endRef = useRef(null);
  const searchRef = useRef(null);

  useEffect(() => { selectedIdRef.current = selected?.id ?? null; }, [selected]);

  useEffect(() => {
    let current = true;
    request('/conversations', { token }).then(({ conversations: items }) => {
      if (current) { setConversations(items); setSelected(items[0] || null); }
    }).catch((failure) => { if (current) setError(failure.message); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [token]);

  useEffect(() => {
    const query = search.trim();
    if (!query) { setPeople([]); return undefined; }
    let current = true;
    const timeout = setTimeout(() => {
      request(`/users?search=${encodeURIComponent(query)}`, { token })
        .then(({ users }) => { if (current) setPeople(users); })
        .catch((failure) => { if (current) setError(failure.message); });
    }, 200);
    return () => { current = false; clearTimeout(timeout); };
  }, [search, token]);

  useEffect(() => {
    if (!selected) { setMessages([]); return undefined; }
    let current = true;
    setMessages([]);
    setError('');
    request(`/conversations/${selected.id}/messages`, { token })
      .then(({ messages: history }) => { if (current) setMessages(history); })
      .catch((failure) => { if (current) setError(failure.message); });
    return () => { current = false; };
  }, [selected, token]);

  useEffect(() => {
    const socket = io({ auth: { token } });
    socketRef.current = socket;
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', () => { setConnected(false); setError('Live connection lost. Check that the server is running.'); });
    socket.on('message:new', (message) => {
      if (message.conversationId === selectedIdRef.current) {
        setMessages((items) => items.some((item) => item.id === message.id) ? items : [...items, message]);
      }
      const incomingConversation = {
        id: message.conversationId,
        userId: message.senderId,
        username: message.senderUsername,
        lastMessage: message.body,
        lastMessageAt: message.createdAt,
      };
      setConversations((items) => {
        const exists = items.some((item) => item.id === message.conversationId);
        const updated = exists
          ? items.map((item) => item.id === message.conversationId ? { ...item, ...incomingConversation } : item)
          : [...items, incomingConversation];
        return updated.sort((a, b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0));
      });
      setSelected((current) => current || incomingConversation);
    });
    return () => { socket.disconnect(); socketRef.current = null; };
  }, [token]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages]);

  async function openChat(person) {
    setError('');
    try {
      const { conversation } = await request('/conversations', {
        token, method: 'POST', body: JSON.stringify({ userId: person.id }),
      });
      setConversations((items) => [conversation, ...items.filter((item) => item.id !== conversation.id)]);
      setSelected(conversation);
      setSearch('');
      setPeople([]);
    } catch (failure) { setError(failure.message); }
  }

  function send(event) {
    event.preventDefault();
    const body = draft.trim();
    const socket = socketRef.current;
    if (!body || !selected || !socket?.connected) return;
    setError('');
    socket.timeout(5000).emit('message:send', { conversationId: selected.id, body }, (failed, result) => {
      if (failed) { setError('Message could not be sent. Check your connection.'); return; }
      if (result.error) { setError(result.error); return; }
      setMessages((items) => items.some((item) => item.id === result.message.id) ? items : [...items, result.message]);
      setConversations((items) => items.map((item) => item.id === result.message.conversationId
        ? { ...item, lastMessage: body, lastMessageAt: result.message.createdAt } : item));
      setDraft('');
    });
  }

  return (
    <main className="chat-layout">
      <aside className={`sidebar${selected ? ' has-chat' : ''}`}>
        <div className="sidebar-top">
          <a className="brand" href="/" aria-label="ChatFlow home"><span className="brand-mark">c</span>ChatFlow</a>
          <div className="inbox-title"><div><span className="kicker">YOUR INBOX</span><h1>Messages</h1></div><span className="live-state"><i className={connected ? 'online' : ''} />{connected ? 'Live' : 'Connecting'}</span></div>
          <label className="search-box"><span className="visually-hidden">Search for people</span><input ref={searchRef} placeholder="Search by username" value={search} onChange={(event) => setSearch(event.target.value)} />{search && <button type="button" aria-label="Clear search" onClick={() => setSearch('')}>×</button>}</label>
        </div>
        <div className="conversation-list" aria-live="polite">
          <p className="list-label">{search.trim() ? 'PEOPLE' : 'RECENT'}</p>
          {search.trim() ? people.length ? people.map((person) => (
            <button className="list-item" key={person.id} type="button" onClick={() => openChat(person)}><span className="avatar">{initials(person.username)}</span><span className="list-copy"><b>{person.username}</b><small>Start a conversation</small></span><span className="start-arrow">↗</span></button>
          )) : <p className="list-empty">No users found.</p> : loading ? <p className="list-empty">Loading conversations...</p> : conversations.length ? conversations.map((chat) => (
            <button className={`list-item${selected?.id === chat.id ? ' selected' : ''}`} key={chat.id} type="button" onClick={() => setSelected(chat)}><span className="avatar">{initials(chat.username)}</span><span className="list-copy"><b>{chat.username}</b><small>{chat.lastMessage || 'Say hello'}</small></span>{chat.lastMessageAt && <time>{time(chat.lastMessageAt)}</time>}</button>
          )) : <div className="inbox-empty"><span>+</span><p>No conversations yet.</p><button className="link-button" onClick={() => searchRef.current?.focus()} type="button">Find someone to talk to</button></div>}
        </div>
        <footer className="profile"><span className="avatar">{initials(user.username)}</span><span className="list-copy"><b>{user.username}</b><small>Your account</small></span><button className="logout" onClick={onLogout} type="button">Log out</button></footer>
      </aside>

      <section className={`conversation${selected ? ' open' : ''}`} aria-label="Conversation">
        {selected ? <>
          <header className="conversation-header"><button className="back" type="button" aria-label="Back to messages" onClick={() => setSelected(null)}>←</button><span className="avatar">{initials(selected.username)}</span><div className="contact"><h2>{selected.username}</h2><small><i /> Available to chat</small></div><span className="direct-label">DIRECT MESSAGE</span></header>
          <div className="messages" aria-live="polite"><div className="start-note"><span />THIS IS THE START OF YOUR CONVERSATION<span /></div>{messages.map((message) => {
            const mine = message.senderId === user.id;
            return <article className={`message${mine ? ' mine' : ''}`} key={message.id}><span className="message-avatar">{initials(mine ? user.username : selected.username)}</span><div><div className="message-meta"><b>{mine ? 'You' : selected.username}</b><time dateTime={message.createdAt}>{time(message.createdAt)}</time></div><p className="bubble">{message.body}</p></div></article>;
          })}<div ref={endRef} /></div>
          {error && <p className="chat-error" role="alert">{error}</p>}
          <form className="composer" onSubmit={send}><label className="visually-hidden" htmlFor="message">Message {selected.username}</label><textarea id="message" maxLength={2000} placeholder="Write a message..." rows={1} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); event.currentTarget.form.requestSubmit(); } }} /><small>Enter to send · Shift + Enter for a new line</small><button className="send-button" type="submit" disabled={!draft.trim() || !connected}>Send <span>↗</span></button></form>
        </> : <div className="empty-state"><span className="empty-mark">c</span><span className="kicker">A LITTLE SPACE TO CATCH UP</span><h2>Your next good conversation<br />is one message away.</h2><p>Choose a conversation or search for someone to get started.</p></div>}
      </section>
    </main>
  );
}