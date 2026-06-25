import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

// Servir arquivos estáticos do diretório Vite de compilação (dist)
app.use(express.static(join(__dirname, 'dist')));

// Servir arquivos na raiz para modo desenvolvimento do Vite se necessário
app.use(express.static(__dirname));

// Estrutura de dados das salas (em memória)
// { [roomCode]: { masterSocketId: string, players: { [socketId]: charData } } }
const rooms = {};

// Função auxiliar para gerar códigos de sala amigáveis
function generateRoomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 5; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// Websocket Logic
io.on('connection', (socket) => {
    console.log(`Nova conexão estabelecida: ${socket.id}`);

    // Mestre cria uma sala
    socket.on('create-room', (callback) => {
        const roomCode = generateRoomCode();
        rooms[roomCode] = {
            masterSocketId: socket.id,
            players: {}
        };
        socket.join(roomCode);
        console.log(`Sala criada: ${roomCode} por Mestre: ${socket.id}`);
        callback({ success: true, roomCode });
    });

    // Jogador tenta entrar em uma sala
    socket.on('join-room', ({ roomCode, characterData }, callback) => {
        const code = roomCode.toUpperCase().trim();
        const room = rooms[code];

        if (!room) {
            return callback({ success: false, message: "Sala não encontrada. Verifique o código!" });
        }

        // Adiciona o jogador à sala no Socket.io
        socket.join(code);
        
        // Armazena os dados do personagem no objeto da sala
        room.players[socket.id] = {
            id: socket.id,
            ...characterData
        };

        console.log(`Jogador ${characterData.name} entrou na sala ${code}`);

        // Envia confirmação para o jogador
        callback({ success: true, socketId: socket.id });

        // Notifica o Mestre com a lista atualizada de jogadores
        io.to(room.masterSocketId).emit('player-joined', {
            socketId: socket.id,
            characterData: room.players[socket.id]
        });
        
        // Envia todos os jogadores atualmente conectados de volta para o mestre
        io.to(room.masterSocketId).emit('update-player-list', Object.values(room.players));
    });

    // Jogador atualiza os dados do personagem (PV, PM, inventário, etc.)
    socket.on('update-character', ({ roomCode, characterData }) => {
        const code = roomCode.toUpperCase().trim();
        const room = rooms[code];

        if (room && room.players[socket.id]) {
            // Atualiza os dados locais
            room.players[socket.id] = {
                ...room.players[socket.id],
                ...characterData,
                id: socket.id
            };

            // Notifica o Mestre em tempo real
            io.to(room.masterSocketId).emit('player-updated', room.players[socket.id]);
            
            // Envia lista atualizada para garantir consistência
            io.to(room.masterSocketId).emit('update-player-list', Object.values(room.players));
        }
    });

    // Compartilha rolagem de dados com a sala (Mestre)
    socket.on('dice-roll', ({ roomCode, rollData }) => {
        const code = roomCode.toUpperCase().trim();
        const room = rooms[code];
        if (room) {
            io.to(room.masterSocketId).emit('table-roll', rollData);
        }
    });

    // Conexão encerrada
    socket.on('disconnect', () => {
        console.log(`Conexão encerrada: ${socket.id}`);
        
        // Procura em todas as salas para limpar
        Object.keys(rooms).forEach(roomCode => {
            const room = rooms[roomCode];
            
            // Se o mestre desconectou, encerra a sala
            if (room.masterSocketId === socket.id) {
                console.log(`Mestre desconectou. Fechando sala ${roomCode}`);
                socket.to(roomCode).emit('room-closed', { message: "A conexão com o Mestre foi perdida." });
                delete rooms[roomCode];
            } 
            // Se um jogador desconectou, remove da sala e avisa o mestre
            else if (room.players[socket.id]) {
                const playerName = room.players[socket.id].name;
                console.log(`Jogador ${playerName} desconectou da sala ${roomCode}`);
                delete room.players[socket.id];
                
                io.to(room.masterSocketId).emit('player-left', { socketId: socket.id, name: playerName });
                io.to(room.masterSocketId).emit('update-player-list', Object.values(room.players));
            }
        });
    });
});

// Inicialização do Servidor HTTP
httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`\n======================================================`);
    console.log(`SERVIDOR RPG TORMENTA 20 ATIVO`);
    console.log(`Porta de execução: ${PORT}`);
    console.log(`------------------------------------------------------`);
    console.log(`Acesse localmente em: http://localhost:${PORT}`);
    
    // Mostra IPs locais para os outros aparelhos se conectarem no Wi-Fi
    const interfaces = os.networkInterfaces();
    console.log(`Acesse na mesma rede Wi-Fi através dos endereços:`);
    Object.keys(interfaces).forEach((ifname) => {
        interfaces[ifname].forEach((iface) => {
            if (iface.family === 'IPv4' && !iface.internal) {
                console.log(`  ➜  http://${iface.address}:${PORT}/`);
            }
        });
    });
    console.log(`======================================================\n`);
});
