import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import './app.css';
import { FaBolt, FaExclamationTriangle, FaCommentDots } from "react-icons/fa";


const SOCKET_URL = 'http://localhost:5000';
const DEFAULT_ROOMS = ['general', 'tech', 'random'];

function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function getInitial(pseudo) {
  return pseudo ? pseudo[0].toUpperCase() : '?';
}

function isDMRoom(roomId) {
  return roomId.includes('__dm__');
}

function dmLabel(roomId, myPseudo) {
  const [a, b] = roomId.split('__dm__');
  return a === myPseudo ? b : a;
}

function LoginScreen({ onLogin, error }) {
  const [pseudo, setPseudo] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    if (pseudo.trim().length >= 2) onLogin(pseudo.trim());
  }

  return (
    <div className="login-screen">
      <div className="login-bg-grid"/>
      <div className="login-glow" />
      <div className="login-card">
        <div className="login-logo">
          <div className="login-logo-icon"> <FaBolt size={24} color="orange" style={{ background: "transparent" }} /></div>
          <h1>Nexus<span>Chat</span></h1>
        </div>
        <div className="login-tagline"> Messagerie instantanée · Temps réel </div>
        <label className="login-label" htmlFor="pseudo-input"> Choisir un pseudo </label>
        <input
          id="pseudo-input"
          className="login-input"
          type="text"
          placeholder="ex: johndoe"
          value={pseudo}
          onChange={e => setPseudo(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit(e)}
          maxLength={20}
          autoFocus
        />
        <button className="login-btn" onClick={handleSubmit} disabled={pseudo.trim().length < 2}>
          Connecter →
        </button>
        {error && <div className="login-error"><FaExclamationTriangle size={16} color="white" style={{ marginRight: "6px" }} /> {error}</div>}
      </div>
    </div>
  );
}

function Message({ msg, myPseudo }) {
  if (msg.system) {
    return (
      <div className="message-row system-msg">
        <span className="system-msg-text">{msg.text}</span>
      </div>
    );
  }
  const isOwn = msg.pseudo === myPseudo;
  return (
    <div className={`message-row ${isOwn ? 'message-own' : ''}`}>
      <div className="message-avatar">{getInitial(msg.pseudo)}</div>
      <div className="message-content">
        <div className="message-meta">
          <span className="message-pseudo">{isOwn ? 'vous' : msg.pseudo}</span>
          <span className="message-time">{formatTime(msg.timestamp)}</span>
        </div>
        <div className="message-text">{msg.text}</div>
      </div>
    </div>
  );
}

export default function App() {
  const [pseudo, setPseudo] = useState('');
  const [loginError, setLoginError] = useState('');
  const [registered, setRegistered] = useState(false);
  const [activeRoom, setActiveRoom] = useState('general');
  const [joinedRooms, setJoinedRooms] = useState(['general']);
  const [dmRooms, setDmRooms] = useState([]);
  const [messages, setMessages] = useState({});
  const [users, setUsers] = useState([]);
  const [inputText, setInputText] = useState('');
  const [newRoomName, setNewRoomName] = useState('');
  const messagesEndRef = useRef(null);
  const socketRef = useRef(null);

  useEffect(() => {
    const s = io(SOCKET_URL, { autoConnect: false });
    socketRef.current = s;

    s.on('register_ok', ({ pseudo: p }) => {
      setPseudo(p);
      setRegistered(true);
      setLoginError('');
    });
    s.on('register_error', (msg) => setLoginError(msg));
    s.on('user_list', (list) => setUsers(list));
    s.on('message', (msg) => {
      setMessages(prev => {
        const roomMsgs = prev[msg.roomId] || [];
        return { ...prev, [msg.roomId]: [...roomMsgs, msg] };
      });
    });
    s.on('room_history', ({ roomId, messages: hist }) => {
      setMessages(prev => ({ ...prev, [roomId]: hist }));
    });
    s.on('dm_opened', ({ roomId, with: withPseudo }) => {
      setDmRooms(prev => {
        if (prev.find(d => d.roomId === roomId)) return prev;
        return [...prev, { roomId, with: withPseudo }];
      });
      setActiveRoom(roomId);
    });

    s.connect();
    return () => s.disconnect();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeRoom]);

  function handleLogin(p) {
    socketRef.current?.emit('register', { pseudo: p });
  }

  function handleJoinRoom(roomId) {
    if (!roomId || roomId === activeRoom) return;
    if (!joinedRooms.includes(roomId)) setJoinedRooms(prev => [...prev, roomId]);
    setActiveRoom(roomId);
    socketRef.current?.emit('join_room', { roomId });
  }

  function handleJoinCustomRoom(e) {
    e.preventDefault();
    const name = newRoomName.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (!name) return;
    setNewRoomName('');
    handleJoinRoom(name);
  }

  function handleOpenDM(targetPseudo) {
    if (targetPseudo === pseudo) return;
    socketRef.current?.emit('open_dm', { targetPseudo });
  }

  function handleSendMessage() {
    const text = inputText.trim();
    if (!text || !activeRoom) return;
    socketRef.current?.emit('send_message', { roomId: activeRoom, text });
    setInputText('');
  }

  if (!registered) {
    return <LoginScreen onLogin={handleLogin} error={loginError} />;
  }

  const currentMessages = messages[activeRoom] || [];
  const activeRoomLabel = isDMRoom(activeRoom)
    ? `@ ${dmLabel(activeRoom, pseudo)}`
    : `# ${activeRoom}`;

  return (
    <div className="chat-layout">
      <header className="chat-header">
        <div className="chat-header-brand">
          <div className="brand-dot" />
          NexusChat
        </div>
        <div className="chat-header-info">
          <div className="room-badge">{activeRoomLabel}</div>
          <div className="pseudo-badge">{pseudo}</div>
        </div>
      </header>

      <aside className="sidebar">
        <div className="sidebar-section">
          <div className="sidebar-section-title">Salons</div>
          {DEFAULT_ROOMS.map(r => (
            <div key={r} className={`room-item ${activeRoom === r ? 'active' : ''}`} onClick={() => handleJoinRoom(r)}>
              <span className="room-item-prefix">#</span>{r}
            </div>
          ))}
          {joinedRooms.filter(r => !DEFAULT_ROOMS.includes(r) && !isDMRoom(r)).map(r => (
            <div key={r} className={`room-item ${activeRoom === r ? 'active' : ''}`} onClick={() => handleJoinRoom(r)}>
              <span className="room-item-prefix">#</span>{r}
            </div>
          ))}
        </div>
        <div className="sidebar-divider" />
        <form className="join-room-form" onSubmit={handleJoinCustomRoom}>
          <input
            className="join-room-input"
            type="text"
            placeholder="Rejoindre salon..."
            value={newRoomName}
            onChange={e => setNewRoomName(e.target.value)}
          />
          <button className="join-room-btn" type="submit">+</button>
        </form>
        {dmRooms.length > 0 && (
          <>
            <div className="sidebar-divider" />
            <div className="sidebar-section">
              <div className="sidebar-section-title">Messages Privés</div>
              {dmRooms.map(dm => (
                <div key={dm.roomId} className={`room-item ${activeRoom === dm.roomId ? 'active' : ''}`}
                  onClick={() => { setActiveRoom(dm.roomId); socketRef.current?.emit('join_room', { roomId: dm.roomId }); }}>
                  <span className="room-item-prefix">@</span>{dm.with}
                </div>
              ))}
            </div>
          </>
        )}
      </aside>

      <main className="chat-main">
        <div className="messages-container">
          {currentMessages.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon"><FaCommentDots size={24} color="white" /></div>
              <div className="empty-state-text">Aucun message encore.<br />Soyez le premier à écrire !</div>
            </div>
          ) : (
            currentMessages.map((msg, i) => <Message key={i} msg={msg} myPseudo={pseudo} />)
          )}
          <div ref={messagesEndRef} />
        </div>
        <div className="input-bar">
          <span className="input-room-tag"><span>{activeRoomLabel}</span></span>
          <input
            className="message-input"
            type="text"
            placeholder={`Message dans ${activeRoomLabel}...`}
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
            maxLength={500}
          />
          <button className="send-btn" onClick={handleSendMessage} disabled={!inputText.trim()}>
            Envoyer
          </button>
        </div>
      </main>

      <aside className="users-panel">
        <div className="users-header">
          En ligne
          <span className="users-count">{users.length}</span>
        </div>
        <div className="users-list">
          {users.map(u => (
            <div key={u} className={`user-item ${u === pseudo ? 'is-me' : ''}`}
              onClick={() => u !== pseudo && handleOpenDM(u)}
              title={u !== pseudo ? `Ouvrir DM avec ${u}` : 'Vous'}>
              <div className="user-status-dot" />
              <span className="user-name">{u === pseudo ? `${u} (vous)` : u}</span>
              {u !== pseudo && <span className="user-dm-btn">DM →</span>}
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}