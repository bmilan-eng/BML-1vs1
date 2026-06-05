const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(__dirname));

let players = {};
let rooms = {}; // Guarda las salas de 1vs1

io.on('connection', (socket) => {
    console.log(`Jugador conectado: ${socket.id}`);

    // Buscar o crear una sala disponible (máximo 2 jugadores)
    let roomId = null;
    for (let id in rooms) {
        if (rooms[id].length < 2) {
            roomId = id;
            break;
        }
    }

    if (!roomId) {
        roomId = `room_${socket.id}`;
        rooms[roomId] = [];
    }

    rooms[roomId].push(socket.id);
    socket.join(roomId);

    // Asignar datos iniciales
    const weapon = rooms[roomId].length === 1 ? 'Phantom' : 'Escopeta';
    players[socket.id] = { x: 0, z: 0, rotation: 0, weapon: weapon, hp: 100, room: roomId };

    // Notificar solo a los jugadores de la misma sala
    socket.emit('initGame', { id: socket.id, weapon: weapon, allPlayers: players });
    socket.to(roomId).emit('newPlayer', { id: socket.id, player: players[socket.id] });

    // Movimiento
    socket.on('playerMovement', (movementData) => {
        if (players[socket.id]) {
            players[socket.id].x = movementData.x;
            players[socket.id].z = movementData.z;
            players[socket.id].rotation = movementData.rotation;
            socket.to(players[socket.id].room).emit('playerMoved', { id: socket.id, player: players[socket.id] });
        }
    });

    // Cambio de arma
    socket.on('changeWeapon', (newWeapon) => {
        if (players[socket.id]) {
            players[socket.id].weapon = newWeapon;
            socket.to(players[socket.id].room).emit('enemyChangedWeapon', { id: socket.id, weapon: newWeapon });
        }
    });

    // Disparos
    socket.on('shoot', () => {
        if (players[socket.id]) {
            socket.to(players[socket.id].room).emit('enemyShot', { id: socket.id, weapon: players[socket.id].weapon });
        }
    });

    // Desconexión
    socket.on('disconnect', () => {
        console.log(`Jugador desconectado: ${socket.id}`);
        const roomId = players[socket.id]?.room;
        if (roomId && rooms[roomId]) {
            rooms[roomId] = rooms[roomId].filter(id => id !== socket.id);
            if (rooms[roomId].length === 0) delete rooms[roomId];
        }
        delete players[socket.id];
        io.to(roomId).emit('playerDisconnected', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));