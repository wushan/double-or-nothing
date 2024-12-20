import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { GameSession } from './game.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: ["http://localhost:5173", "http://localhost:3000"],
        methods: ["GET", "POST"]
    }
});

// 設置靜態文件目錄
app.use(express.static(path.join(__dirname, '..')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../index.html'));
});

// 建立遊戲實例
const gameSession = new GameSession();

io.on('connection', (socket) => {
    console.log(`新玩家連接 - ID: ${socket.id}`);

    socket.on('registerPlayer', (nickname) => {
        try {
            const playerState = gameSession.createPlayer(socket, nickname);
            socket.emit('gameState', playerState);
        } catch (error) {
            socket.emit('error', error.message);
        }
    });

    socket.on('getInitialState', (callback) => {
        try {
            const state = gameSession.getPlayerState(socket.id);
            callback(state);
        } catch (error) {
            socket.emit('error', error.message);
        }
    });

    socket.on('placeBet', (callback) => {
        try {
            const betResult = gameSession.placeBet(socket.id);
            callback({ success: true, ...betResult });
        } catch (error) {
            callback({ error: error.message });
        }
    });

    socket.on('disconnect', () => {
        console.log(`玩家離開 - ID: ${socket.id}`);
        gameSession.removePlayer(socket.id);
    });
});

// 啟動伺服器
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
    console.log(`伺服器運行在 http://localhost:${PORT}`);
});
