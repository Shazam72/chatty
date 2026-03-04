const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});


app.get('/', (req, res) => {
  res.send("Backend is running 🚀");
});


io.on('connection', (socket) => {
  console.log('Un utilisateur est connecté:', socket.id);

  socket.on('message', (msg) => {
    console.log('Message reçu:', msg);
    io.emit('message', msg);
  });

  socket.on('disconnect', () => {
    console.log('Utilisateur déconnecté:', socket.id);
  });
});

server.listen(5000, () => {
  console.log('Backend lancé sur http://localhost:5000');
});
