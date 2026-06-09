const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Permite conexiones desde tu web de Vercel
        methods: ["GET", "POST"]
    }
});

app.use(express.static(__dirname));

let lobbyPlayers = {}; 
let activeGames = {};  

io.on('connection', (socket) => {
    console.log(`Jugador conectado al servidor: ${socket.id}`);

    socket.on('joinLobby', (username) => {
        lobbyPlayers[socket.id] = { id: socket.id, name: username || "Anónimo" };
        // Enviamos la lista actualizada a todos
        io.emit('updateLobbyList', Object.values(lobbyPlayers));
    });

    socket.on('invitePlayer', (targetId) => {
        if (lobbyPlayers[targetId] && lobbyPlayers[socket.id]) {
            io.to(targetId).emit('receiveInvite', { fromId: socket.id, fromName: lobbyPlayers[socket.id].name });
        }
    });

    socket.on('acceptInvite', (senderId) => {
        if (lobbyPlayers[senderId] && lobbyPlayers[socket.id]) {
            const roomId = `room_${senderId}_${socket.id}`;
            
            // Spawns en el centro de tu mapa 1v1camp
            activeGames[roomId] = {
                players: {
                    [senderId]: { x: -3, z: 0, weapon: 'Phantom', name: lobbyPlayers[senderId].name },
                    [socket.id]: { x: 3, z: 0, weapon: 'Escopeta', name: lobbyPlayers[socket.id].name }
                }
            };

            delete lobbyPlayers[senderId];
            delete lobbyPlayers[socket.id];
            io.emit('updateLobbyList', Object.values(lobbyPlayers));

            io.to(senderId).emit('startGame', { roomId, matchData: activeGames[roomId].players });
            io.to(socket.id).emit('startGame', { roomId, matchData: activeGames[roomId].players });
        }
    });

    socket.on('joinGameRoom', (roomId) => { socket.join(roomId); });

    socket.on('playerMovement', (data) => {
        socket.to(data.roomId).emit('playerMoved', { id: socket.id, x: data.x, z: data.z, rotY: data.rotY });
    });

    socket.on('changeWeapon', (data) => {
        socket.to(data.roomId).emit('enemyChangedWeapon', { id: socket.id, weapon: data.weapon });
    });

    socket.on('shoot', (data) => {
        socket.to(data.roomId).emit('enemyShot', { weapon: data.weapon });
    });

    socket.on('disconnect', () => {
        delete lobbyPlayers[socket.id];
        io.emit('updateLobbyList', Object.values(lobbyPlayers));
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));