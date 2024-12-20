import { Decimal } from 'decimal.js';
import crypto from 'crypto';

export class GameSession {
    constructor() {
        this.players = new Map();
        this.currentBets = new Map();
        this.leaderboard = new Map();
        this.gameHistory = [];
        this.gameLoop = null;
        this.currentRoundId = null;
        this.roundResult = null;
        this.nextJumpTime = Date.now() + 7000;
        this.roundInterval = 7000; // 7 秒一個回合
        this.initGameLoop();
    }

    generateRoundId() {
        return crypto.randomBytes(16).toString('hex');
    }

    initGameLoop() {
        this.gameLoop = setInterval(() => {
            this.startNewRound();
        }, this.roundInterval);
    }

    startNewRound() {
        // 處理上一回合的結果
        if (this.currentRoundId && this.currentBets.size > 0) {
            this.processCurrentRound();
        }

        // 開始新回合
        this.currentRoundId = this.generateRoundId();
        this.roundResult = Math.random() >= 0.5;
        this.nextJumpTime = Date.now() + this.roundInterval;

        console.log(`新回合開始 - 局號: ${this.currentRoundId}, 結果: ${this.roundResult ? '成功' : '失敗'}`);

        // 廣播新回合開始
        this.broadcastGameState();
    }

    processCurrentRound() {
        console.log(`處理回合 ${this.currentRoundId} 的結果：`);
        
        // 處理所有當前回合的投注
        for (const [playerId, betAmount] of this.currentBets.entries()) {
            const player = this.players.get(playerId);
            if (!player) continue;

            const oldBalance = player.currentBalance.toString();
            
            if (this.roundResult) {
                // 贏了，餘額翻倍
                player.currentBalance = new Decimal(betAmount).times(2);
                player.stats.wins++;
                console.log(`玩家 ${player.nickname} 贏了 - 投注: ${betAmount}, 舊餘額: ${oldBalance}, 新餘額: ${player.currentBalance.toString()}`);
            } else {
                // 輸了，餘額歸零
                player.currentBalance = new Decimal('0');
                player.stats.losses++;
                console.log(`玩家 ${player.nickname} 輸了 - 投注: ${betAmount}, 舊餘額: ${oldBalance}, 新餘額: 0`);
            }

            // 更新遊戲歷史
            const roundResult = {
                roundId: this.currentRoundId,
                timestamp: Date.now(),
                playerNickname: player.nickname,
                betAmount: betAmount,
                win: this.roundResult,
                newBalance: player.currentBalance.toString()
            };

            this.gameHistory.unshift(roundResult);
            this.gameHistory = this.gameHistory.slice(0, 10); // 只保留最新的 10 筆紀錄

            // 更新玩家歷史記錄
            player.history.push(roundResult);

            // 更新排行榜
            this.updateLeaderboard(playerId);

            // 發送結果給玩家
            player.socket.emit('roundResult', {
                roundId: this.currentRoundId,
                win: this.roundResult,
                newBalance: player.currentBalance.toString(),
                stats: player.stats,
                gameHistory: this.gameHistory
            });
        }

        // 清空當前回合的投注
        this.currentBets.clear();
    }

    createPlayer(socket, nickname) {
        const playerId = socket.id;
        
        if (this.players.has(playerId)) {
            throw new Error('玩家已存在');
        }
        
        this.players.set(playerId, {
            socket,
            nickname,
            currentBalance: new Decimal('10'),
            stats: {
                wins: 0,
                losses: 0
            },
            history: []
        });

        console.log(`新玩家加入 - ID: ${playerId}, 暱稱: ${nickname}`);

        this.updateLeaderboard(playerId);
        
        return {
            ...this.getPlayerState(playerId),
            gameHistory: this.gameHistory
        };
    }

    updateLeaderboard(playerId) {
        const player = this.players.get(playerId);
        if (!player) return;

        this.leaderboard.set(playerId, {
            nickname: player.nickname,
            wins: player.stats.wins,
            losses: player.stats.losses,
            winRate: player.stats.wins / (player.stats.wins + player.stats.losses) || 0
        });

        this.broadcastLeaderboard();
    }

    broadcastLeaderboard() {
        const leaderboardArray = Array.from(this.leaderboard.values())
            .sort((a, b) => b.winRate - a.winRate)
            .slice(0, 10);

        for (const player of this.players.values()) {
            player.socket.emit('leaderboard', leaderboardArray);
        }
    }

    placeBet(playerId) {
        const player = this.players.get(playerId);
        if (!player) {
            throw new Error('玩家不存在');
        }

        if (player.currentBalance.equals(0)) {
            throw new Error('餘額不足');
        }

        // 全額投注
        const betAmount = player.currentBalance;
        this.currentBets.set(playerId, betAmount);
        
        // 扣除餘額
        player.currentBalance = new Decimal('0');

        console.log(`玩家投注 - ID: ${playerId}, 暱稱: ${player.nickname}, 金額: ${betAmount.toString()}`);

        // 廣播新的遊戲狀態
        this.broadcastGameState();

        return {
            roundId: this.currentRoundId,
            timeToNextJump: this.nextJumpTime - Date.now(),
            currentBetCount: this.currentBets.size,
            currentBalance: player.currentBalance.toString()
        };
    }

    broadcastGameState() {
        const gameState = {
            roundId: this.currentRoundId,
            timeToNextJump: this.nextJumpTime - Date.now(),
            currentBetCount: this.currentBets.size,
            gameHistory: this.gameHistory
        };

        for (const [playerId, player] of this.players.entries()) {
            const playerState = {
                ...gameState,
                currentBalance: player.currentBalance.toString(),
                stats: player.stats
            };
            player.socket.emit('gameState', playerState);
        }
    }

    getPlayerState(playerId) {
        const player = this.players.get(playerId);
        if (!player) {
            throw new Error('玩家不存在');
        }

        return {
            nickname: player.nickname,
            currentBalance: player.currentBalance.toString(),
            stats: player.stats,
            history: player.history,
            roundId: this.currentRoundId,
            timeToNextJump: this.nextJumpTime - Date.now(),
            currentBetCount: this.currentBets.size
        };
    }

    removePlayer(playerId) {
        const player = this.players.get(playerId);
        if (player) {
            console.log(`玩家離開 - ID: ${playerId}, 暱稱: ${player.nickname}`);
        }

        this.players.delete(playerId);
        this.currentBets.delete(playerId);
        this.leaderboard.delete(playerId);
        this.broadcastGameState();
    }
}

export default GameSession;
