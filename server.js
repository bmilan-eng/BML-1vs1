const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" } // Permite conexiones desde Vercel
});

app.use(express.static(path.join(__dirname, 'public')));

let players = {};

io.on('connection', (socket) => {
    console.log(`Jugador conectado: ${socket.id}`);

    // Asignar arma por defecto (Phantom o Escopeta) al entrar
    const weapon = Object.keys(players).length % 2 === 0 ? 'Phantom' : 'Escopeta';
    players[socket.id] = { x: 0, z: 0, rotation: 0, weapon: weapon, hp: 100 };

    // Enviar estado actual al nuevo jugador
    socket.emit('currentPlayers', players);
    // Avisar a los demás del nuevo jugador
    socket.broadcast.emit('newPlayer', { id: socket.id, player: players[socket.id] });

    // Actualizar movimiento
    socket.on('playerMovement', (movementData) => {
        if (players[socket.id]) {
            players[socket.id].x = movementData.x;
            players[socket.id].z = movementData.z;
            players[socket.id].rotation = movementData.rotation;
            socket.broadcast.emit('playerMoved', { id: socket.id, player: players[socket.id] });
        }
    });

    // Manejar disparos
    socket.on('shoot', (shootData) => {
        socket.broadcast.emit('enemyShot', { id: socket.id, weapon: players[socket.id].weapon });
    });

    // Desconexión
    socket.on('disconnect', () => {
        console.log(`Jugador desconectado: ${socket.id}`);
        delete players[socket.id];
        io.emit('playerDisconnected', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));