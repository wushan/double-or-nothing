import * as PIXI from 'pixi.js';

export class GameView {
    constructor(initialState, containerId) {
        this.containerId = containerId;
        this.container = document.getElementById(containerId);
        this.statusElement = document.getElementById('status');
        
        // 初始化 PIXI Application
        this.app = new PIXI.Application({
            resizeTo: this.container,
            backgroundColor: 0x1099bb,
            resolution: window.devicePixelRatio || 1,
            autoDensity: true,
        });
        
        this.container.appendChild(this.app.view);
        
        // 設置遊戲狀態
        this.currentBalance = initialState.currentBalance || '0';
        this.isConnected = false;
        
        // 創建遊戲角色
        this.player = new PIXI.Graphics();
        this.player.beginFill(0xFFFF00);
        this.player.drawRect(-25, -25, 50, 50);
        this.player.endFill();
        this.player.x = this.app.screen.width * 0.2;
        this.player.y = this.app.screen.height * 0.5;
        this.app.stage.addChild(this.player);

        // 創建地面
        this.ground = new PIXI.Graphics();
        this.ground.beginFill(0x00FF00);
        this.ground.drawRect(0, 0, this.app.screen.width, 50);
        this.ground.endFill();
        this.ground.y = this.app.screen.height - 50;
        this.app.stage.addChild(this.ground);

        // 遊戲狀態
        this.isJumping = false;
        this.jumpVelocity = 0;
        this.gravity = this.app.screen.height * 0.001; // 根據畫面高度調整重力
        this.jumpForce = -this.app.screen.height * 0.02; // 根據畫面高度調整跳躍力
        this.groundY = this.app.screen.height - 75; // 角色的地面位置

        // 開始遊戲循環
        this.app.ticker.add(this.gameLoop.bind(this));
        
        // 監聽視窗大小變化
        window.addEventListener('resize', this.onResize.bind(this));
        
        // 更新狀態
        this.updateStatus();
    }
    
    onResize() {
        // PIXI 會自動調整大小
        this.groundY = this.app.screen.height - 75;
        this.ground.width = this.app.screen.width;
        this.ground.y = this.app.screen.height - 50;
        
        // 調整物理參數
        this.gravity = this.app.screen.height * 0.001;
        this.jumpForce = -this.app.screen.height * 0.02;
        
        // 確保玩家不會低於地面
        if (!this.isJumping) {
            this.player.y = this.groundY;
        }
    }

    gameLoop(delta) {
        // 處理跳躍
        if (this.isJumping) {
            this.jumpVelocity += this.gravity;
            this.player.y += this.jumpVelocity;

            // 著地檢測
            if (this.player.y >= this.groundY) {
                this.player.y = this.groundY;
                this.isJumping = false;
                this.jumpVelocity = 0;
            }
        }
    }

    jump() {
        if (!this.isJumping) {
            this.isJumping = true;
            this.jumpVelocity = this.jumpForce;
        }
    }
    
    update(state) {
        this.currentBalance = state.currentBalance;
        this.updateStatus();

        // 根據回合時間更新動畫
        const timeToJump = state.timeToNextJump;
        if (timeToJump && timeToJump > 0) {
            setTimeout(() => this.jump(), timeToJump);
        }
    }
    
    updateStatus() {
        if (this.statusElement) {
            this.statusElement.textContent = `餘額: ${this.currentBalance} | ${this.isConnected ? '已連接' : '未連接'}`;
        }
    }
    
    showResult(win) {
        // 創建結果文字
        const resultText = new PIXI.Text(
            win ? '贏了！' : '輸了！',
            {
                fontFamily: 'Arial',
                fontSize: Math.min(this.app.screen.width, this.app.screen.height) * 0.1,
                fill: win ? 0x00ff00 : 0xff0000,
                align: 'center'
            }
        );
        
        resultText.anchor.set(0.5);
        resultText.x = this.app.screen.width / 2;
        resultText.y = this.app.screen.height / 2;
        
        this.app.stage.addChild(resultText);
        
        // 創建閃爍效果
        let alpha = 1;
        const flashInterval = setInterval(() => {
            alpha = alpha === 1 ? 0.5 : 1;
            resultText.alpha = alpha;
        }, 100);
        
        // 2秒後移除結果顯示
        setTimeout(() => {
            clearInterval(flashInterval);
            this.app.stage.removeChild(resultText);
        }, 2000);

        // 根據結果播放動畫
        if (win) {
            this.playWinAnimation();
        } else {
            this.playLoseAnimation();
        }
    }

    playWinAnimation() {
        // 播放勝利動畫
        const originalY = this.player.y;
        const jumpHeight = this.app.screen.height * 0.2;
        const duration = 500;
        const startTime = Date.now();

        const animate = () => {
            const currentTime = Date.now();
            const elapsed = currentTime - startTime;
            
            if (elapsed < duration) {
                const progress = elapsed / duration;
                const height = Math.sin(progress * Math.PI) * jumpHeight;
                this.player.y = originalY - height;
                requestAnimationFrame(animate);
            } else {
                this.player.y = originalY;
            }
        };

        animate();
    }

    playLoseAnimation() {
        // 播放失敗動畫
        const originalRotation = this.player.rotation;
        const duration = 500;
        const startTime = Date.now();

        const animate = () => {
            const currentTime = Date.now();
            const elapsed = currentTime - startTime;
            
            if (elapsed < duration) {
                const progress = elapsed / duration;
                this.player.rotation = originalRotation + Math.PI * 4 * progress;
                requestAnimationFrame(animate);
            } else {
                this.player.rotation = originalRotation;
            }
        };

        animate();
    }
    
    updateConnectionStatus(isConnected) {
        this.isConnected = isConnected;
        this.updateStatus();

        // 更新背景顏色以反映連接狀態
        this.app.renderer.backgroundColor = isConnected ? 0x1099bb : 0x666666;
    }
    
    updateLeaderboard(leaderboard) {
        // TODO: 實現排行榜顯示
        console.log('排行榜更新:', leaderboard);
    }
    
    destroy() {
        this.app.destroy(true);
        window.removeEventListener('resize', this.onResize);
    }
}
