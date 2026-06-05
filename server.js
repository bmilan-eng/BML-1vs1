const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(__dirname));

let lobbyPlayers = {}; // Jugadores en busca de partida
let activeGames = {};  // Partidas en curso

io.on('connection', (socket) => {
    console.log(`Conectado al lobby: ${socket.id}`);

    // Al entrar, el jugador elige un nombre
    socket.on('joinLobby', (username) => {
        lobbyPlayers[socket.id] = { id: socket.id, name: username || `Jugador_${socket.id.substring(0,4)}` };
        io.emit('updateLobbyList', Object.values(lobbyPlayers));
    });

    // Enviar invitación a otro jugador
    socket.on('invitePlayer', (targetId) => {
        if (lobbyPlayers[targetId]) {
            io.to(targetId).emit('receiveInvite', { fromId: socket.id, fromName: lobbyPlayers[socket.id].name });
        }
    });

    // Aceptar invitación y crear sala privada 1vs1
    socket.on('acceptInvite', (senderId) => {
        if (lobbyPlayers[senderId] && lobbyPlayers[socket.id]) {
            const roomId = `room_${senderId}_${socket.id}`;
            
            activeGames[roomId] = {
                players: {
                    [senderId]: { x: -8, z: 0, weapon: 'Phantom', hp: 100, name: lobbyPlayers[senderId].name },
                    [socket.id]: { x: 8, z: 0, weapon: 'Escopeta', hp: 100, name: lobbyPlayers[socket.id].name }
                }
            };

            // Sacar del lobby visual
            delete lobbyPlayers[senderId];
            delete lobbyPlayers[socket.id];
            io.emit('updateLobbyList', Object.values(lobbyPlayers));

            // Mandar a ambos a la partida
            io.to(senderId).emit('startGame', { roomId, role: 'host', matchData: activeGames[roomId].players });
            io.to(socket.id).emit('startGame', { roomId, role: 'guest', matchData: activeGames[roomId].players });
        }
    });

    // Retransmitir mecánicas dentro de la partida privada
    socket.on('joinGameRoom', (roomId) => { socket.join(roomId); });

    socket.on('playerMovement', (data) => {
        socket.to(data.roomId).emit('playerMoved', { id: socket.id, x: data.x, z: data.z });
    });

    socket.on('changeWeapon', (data) => {
        socket.to(data.roomId).emit('enemyChangedWeapon', { id: socket.id, weapon: data.weapon });
    });

    socket.on('shoot', (data) => {
        socket.to(data.roomId).emit('enemyShot', { weapon: data.weapon });
    });

    // Desconexión limpia
    socket.on('disconnect', () => {
        delete lobbyPlayers[socket.id];
        io.emit('updateLobbyList', Object.values(lobbyPlayers));
        console.log(`Desconectado: ${socket.id}`);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`));