const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

//Connexion MongoDB 

mongoose.connect('mongodb://localhost:27017/chatty')
  .then(() => console.log('✅ MongoDB connecté — base "chatty" prête'))
  .catch(err => console.error('❌ Erreur MongoDB:', err));

// Schéma & Modèle Message 

const messageSchema = new mongoose.Schema({
  roomId:    { type: String, required: true },
  pseudo:    { type: String, required: true },
  text:      { type: String, required: true },
  timestamp: { type: Number, required: true },
  system:    { type: Boolean, default: false }
});

const Message = mongoose.model('Message', messageSchema);

// ─── État en mémoire users uniquement

const users = new Map(); 

// Helpers

function getActiveUsers() {
  return Array.from(users.values()).map(u => u.pseudo);
}

function getDMRoomId(pseudo1, pseudo2) {
  return [pseudo1, pseudo2].sort().join('__dm__');
}

async function saveMessage(roomId, pseudo, text, system = false) {
  const msg = new Message({ roomId, pseudo, text, timestamp: Date.now(), system });
  await msg.save();
  return msg;
}

async function getHistory(roomId) {
  const msgs = await Message.find({ roomId })
    .sort({ timestamp: -1 })
    .limit(50)
    .lean();
  return msgs.reverse();
}

function broadcastUserList() {
  io.emit('user_list', getActiveUsers());
}

// Socket.io 

io.on('connection', (socket) => {
  console.log(`[+] Nouvelle connexion : ${socket.id}`);

  // Phase 1 : Identification
  socket.on('register', async ({ pseudo }) => {
    if (!pseudo || typeof pseudo !== 'string') return;
    const cleanPseudo = pseudo.trim().slice(0, 20);

    const taken = Array.from(users.values()).some(u => u.pseudo === cleanPseudo);
    if (taken) {
      socket.emit('register_error', 'Ce pseudo est déjà utilisé.');
      return;
    }

    users.set(socket.id, { pseudo: cleanPseudo, currentRoom: 'general' });
    console.log(`[+] ${cleanPseudo} enregistré`);

    socket.emit('register_ok', { pseudo: cleanPseudo });

    socket.join('general');

    // Phase 4 : Historique depuis MongoDB
    const history = await getHistory('general');
    socket.emit('room_history', { roomId: 'general', messages: history });

    // Phase 2 : Diffuser la liste
    broadcastUserList();

    const msg = await saveMessage('general', 'Système', `${cleanPseudo} a rejoint le chat.`, true);
    io.to('general').emit('message', { ...msg.toObject(), roomId: 'general' });
  });

  // Rejoindre un salon thématique
  socket.on('join_room', async ({ roomId }) => {
    const user = users.get(socket.id);
    if (!user || !roomId) return;

    socket.leave(user.currentRoom);
    socket.join(roomId);
    user.currentRoom = roomId;

    // Phase 4 : Historique depuis MongoDB
    const history = await getHistory(roomId);
    socket.emit('room_history', { roomId, messages: history });

    const msg = await saveMessage(roomId, 'Système', `${user.pseudo} a rejoint #${roomId}.`, true);
    io.to(roomId).emit('message', { ...msg.toObject(), roomId });
  });

  // Phase 3 : Ouvrir un DM
  socket.on('open_dm', async ({ targetPseudo }) => {
    const user = users.get(socket.id);
    if (!user || !targetPseudo) return;

    const dmRoomId = getDMRoomId(user.pseudo, targetPseudo);
    const targetEntry = Array.from(users.entries()).find(([, u]) => u.pseudo === targetPseudo);

    socket.leave(user.currentRoom);
    socket.join(dmRoomId);
    user.currentRoom = dmRoomId;

    if (targetEntry) {
      const [targetSocketId, targetUser] = targetEntry;
      const targetSocket = io.sockets.sockets.get(targetSocketId);
      if (targetSocket) {
        targetSocket.leave(targetUser.currentRoom);
        targetSocket.join(dmRoomId);
        targetUser.currentRoom = dmRoomId;
        targetSocket.emit('dm_opened', { roomId: dmRoomId, with: user.pseudo });
      }
    }

    // Phase 4 : Historique DM depuis MongoDB
    const history = await getHistory(dmRoomId);
    socket.emit('dm_opened', { roomId: dmRoomId, with: targetPseudo });
    socket.emit('room_history', { roomId: dmRoomId, messages: history });
  });

  // Phase 4 : Envoi et sauvegarde en base
  socket.on('send_message', async ({ roomId, text }) => {
    const user = users.get(socket.id);
    if (!user || !roomId || !text) return;

    const msg = await saveMessage(roomId, user.pseudo, text.trim().slice(0, 500), false);
    io.to(roomId).emit('message', { ...msg.toObject(), roomId });
  });

  // Déconnexion
  socket.on('disconnect', async () => {
    const user = users.get(socket.id);
    if (user) {
      console.log(`[-] ${user.pseudo} déconnecté`);
      users.delete(socket.id);

      const msg = await saveMessage('general', 'Système', `${user.pseudo} a quitté le chat.`, true);
      io.to('general').emit('message', { ...msg.toObject(), roomId: 'general' });

      // Phase 2 : Mettre à jour la liste
      broadcastUserList();
    }
  });
});

// REST 

app.get('/', (req, res) => res.send('Backend ChatApp running'));

app.get('/api/history/:roomId', async (req, res) => {
  const history = await getHistory(req.params.roomId);
  res.json(history);
});

server.listen(5000, () => {
  console.log('Backend lancé sur http://localhost:5000');
});