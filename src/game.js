import { Decimal } from 'decimal.js';
import { GameView } from './gameView.js';
import { io } from 'socket.io-client';

export class DoubleOrNothingGame {
    constructor(socket, nickname) {
        this.socket = socket;
        this.nickname = nickname;
        this.currentBalance = '10.0000';
        this.gameView = null;
        this.hasBet = false;
        this.isConnected = false;
        this.setupSocketHandlers();
    }

    setupSocketHandlers() {
        // 監控連接狀態
        this.socket.on('connect', () => {
            console.log('已連接到伺服器');
            this.isConnected = true;
            if (this.gameView) {
                this.gameView.updateConnectionStatus(true);
            }
            // 在連接後立即註冊玩家
            this.socket.emit('registerPlayer', this.nickname);
        });

        this.socket.on('disconnect', () => {
            console.log('與伺服器斷開連接');
            this.isConnected = false;
            if (this.gameView) {
                this.gameView.updateConnectionStatus(false);
            }
        });

        this.socket.on('connect_error', (error) => {
            console.error('連接錯誤:', error);
            this.isConnected = false;
            if (this.gameView) {
                this.gameView.updateConnectionStatus(false);
            }
        });

        // 接收遊戲狀態更新
        this.socket.on('gameState', (state) => {
            console.log('收到遊戲狀態:', state);
            if (this.gameView) {
                this.gameView.update(state);
                this.currentBalance = state.currentBalance;
                this.hasBet = false;
            }
        });

        // 接收回合結果
        this.socket.on('roundResult', (result) => {
            console.log('收到回合結果:', result);
            if (this.gameView) {
                this.gameView.showResult(result.win);
                this.currentBalance = result.newBalance;
                this.hasBet = false;
            }
        });

        // 接收排行榜更新
        this.socket.on('leaderboard', (leaderboard) => {
            console.log('收到排行榜更新:', leaderboard);
            if (this.gameView) {
                this.gameView.updateLeaderboard(leaderboard);
            }
        });

        // 處理錯誤訊息
        this.socket.on('error', (error) => {
            console.error('遊戲錯誤:', error);
            this.hasBet = false;
        });
    }

    createGameView(containerId) {
        // 創建遊戲視圖
        this.gameView = new GameView({ currentBalance: this.currentBalance }, containerId);
        this.gameView.updateConnectionStatus(this.isConnected);
        this.setupBetButton();

        // 檢查是否已連接
        if (!this.socket.connected) {
            console.log('等待連接到伺服器...');
            this.socket.connect();
        } else {
            // 如果已經連接，直接註冊玩家
            this.socket.emit('registerPlayer', this.nickname);
        }
    }

    setupBetButton() {
        const betButton = document.getElementById('betButton');
        if (!betButton) return;

        betButton.addEventListener('click', () => {
            if (!this.isConnected) {
                console.error('未連接到伺服器');
                return;
            }

            if (this.hasBet || this.currentBalance === '0') return;

            this.socket.emit('placeBet', (response) => {
                if (response.error) {
                    console.error('投注錯誤:', response.error);
                    return;
                }
                this.hasBet = true;
                betButton.disabled = true;
                setTimeout(() => {
                    betButton.disabled = false;
                }, 7000);
            });
        });

        // 更新按鈕狀態
        setInterval(() => {
            betButton.disabled = !this.isConnected || this.hasBet || this.currentBalance === '0';
        }, 100);
    }
}

// 主遊戲類別
export class Game {
    constructor() {
        // 初始化 Socket.IO，指定伺服器地址
        this.socket = io('http://localhost:3000', {
            autoConnect: false,
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000
        });
        
        this.setupGame();
    }

    setupGame() {
        // 檢查暱稱
        let nickname = localStorage.getItem('playerNickname');
        if (!nickname) {
            nickname = prompt('請輸入您的暱稱：');
            if (!nickname) {
                nickname = '玩家' + Math.floor(Math.random() * 10000);
            }
            localStorage.setItem('playerNickname', nickname);
        }

        // 創建遊戲實例
        this.gameInstance = new DoubleOrNothingGame(this.socket, nickname);
        this.gameInstance.createGameView('game-container');
    }
}
