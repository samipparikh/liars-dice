let settings = {
    startingDice: 5,
    wildOnes: true
};

function loadSettings() {
    const saved = localStorage.getItem('liars_dice_settings');
    if (saved) Object.assign(settings, JSON.parse(saved));
}
function saveSettings() {
    localStorage.setItem('liars_dice_settings', JSON.stringify(settings));
}
loadSettings();

class Game {
    constructor() {
        this.screens = {
            menu: document.getElementById('menu-screen'),
            game: document.getElementById('game-screen'),
            reveal: document.getElementById('reveal-screen'),
            gameOver: document.getElementById('game-over-screen'),
            rules: document.getElementById('rules-screen'),
            settings: document.getElementById('settings-screen'),
            feedback: document.getElementById('feedback-screen'),
        };
        this.playerCount = 3;
        this.players = [];
        this.currentRound = 1;
        this.currentPlayerIndex = 0;
        this.currentBid = null;
        this.bidQuantity = 1;
        this.bidFace = 2;
        this.bindEvents();
        this.updatePlayerNames();
        this.updateSettingsUI();
    }

    bindEvents() {
        document.getElementById('btn-minus').addEventListener('click', () => this.changePlayerCount(-1));
        document.getElementById('btn-plus').addEventListener('click', () => this.changePlayerCount(1));
        document.getElementById('btn-start').addEventListener('click', () => this.startGame());
        document.getElementById('btn-play-online').addEventListener('click', () => this.showOnlineMenu());
        document.getElementById('btn-settings').addEventListener('click', () => this.showScreen('settings'));
        document.getElementById('btn-back-settings').addEventListener('click', () => this.showScreen('menu'));
        document.getElementById('btn-rules').addEventListener('click', () => this.showScreen('rules'));
        document.getElementById('btn-back-rules').addEventListener('click', () => this.showScreen('menu'));
        document.getElementById('btn-feedback').addEventListener('click', () => this.showScreen('feedback'));
        document.getElementById('btn-back-feedback').addEventListener('click', () => this.showScreen('menu'));
        document.getElementById('btn-submit-feedback').addEventListener('click', () => this.submitFeedback());
        document.getElementById('btn-play-again').addEventListener('click', () => this.showScreen('menu'));
        document.getElementById('btn-continue').addEventListener('click', () => this.continueAfterReveal());
        document.getElementById('qty-minus').addEventListener('click', () => this.adjustBid('qty', -1));
        document.getElementById('qty-plus').addEventListener('click', () => this.adjustBid('qty', 1));
        document.getElementById('face-minus').addEventListener('click', () => this.adjustBid('face', -1));
        document.getElementById('face-plus').addEventListener('click', () => this.adjustBid('face', 1));
        document.getElementById('btn-bid').addEventListener('click', () => this.placeBid());
        document.getElementById('btn-liar').addEventListener('click', () => this.callLiar());
        document.getElementById('setting-dice-minus').addEventListener('click', () => { settings.startingDice = Math.max(1, settings.startingDice - 1); saveSettings(); this.updateSettingsUI(); });
        document.getElementById('setting-dice-plus').addEventListener('click', () => { settings.startingDice = Math.min(8, settings.startingDice + 1); saveSettings(); this.updateSettingsUI(); });
        document.getElementById('setting-wild-ones').addEventListener('click', () => { settings.wildOnes = !settings.wildOnes; saveSettings(); this.updateSettingsUI(); });
    }

    updateSettingsUI() {
        document.getElementById('setting-starting-dice').textContent = settings.startingDice;
        const btn = document.getElementById('setting-wild-ones');
        btn.textContent = settings.wildOnes ? 'ON' : 'OFF';
        btn.className = 'btn-toggle' + (settings.wildOnes ? ' active' : '');
    }

    showOnlineMenu() {
        if (typeof onlineGame !== 'undefined') {
            onlineGame.showOnlineScreen();
        } else {
            document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
            document.getElementById('online-screen').classList.add('active');
        }
    }

    showScreen(name) {
        Object.values(this.screens).forEach(s => s.classList.remove('active'));
        if (this.screens[name]) this.screens[name].classList.add('active');
    }

    changePlayerCount(delta) {
        this.playerCount = Math.max(2, Math.min(6, this.playerCount + delta));
        document.getElementById('player-count').textContent = this.playerCount;
        this.updatePlayerNames();
    }

    updatePlayerNames() {
        const container = document.getElementById('player-names');
        container.innerHTML = '';
        for (let i = 0; i < this.playerCount; i++) {
            const input = document.createElement('input');
            input.type = 'text';
            input.placeholder = `Player ${i + 1}`;
            input.dataset.index = i;
            container.appendChild(input);
        }
    }

    startGame() {
        const inputs = document.querySelectorAll('#player-names input');
        this.players = Array.from(inputs).map((input, i) => ({
            name: input.value.trim() || `Player ${i + 1}`,
            diceCount: settings.startingDice,
            dice: [],
        }));
        this.currentRound = 1;
        this.startRound();
    }

    startRound() {
        this.players.forEach(p => {
            if (p.diceCount > 0) {
                p.dice = [];
                for (let i = 0; i < p.diceCount; i++) {
                    p.dice.push(Math.floor(Math.random() * 6) + 1);
                }
            }
        });
        this.currentBid = null;
        this.bidQuantity = 1;
        this.bidFace = settings.wildOnes ? 2 : 1;
        document.getElementById('current-round').textContent = this.currentRound;
        const totalDice = this.players.reduce((sum, p) => sum + p.diceCount, 0);
        document.getElementById('total-dice').textContent = totalDice;
        this.showScreen('game');
        this.showTurn();
    }

    showTurn() {
        while (this.players[this.currentPlayerIndex].diceCount === 0) {
            this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
        }
        const player = this.players[this.currentPlayerIndex];
        document.getElementById('current-player-name').textContent = player.name;
        this.renderDice(player.dice, 'player-dice');
        this.updateBidDisplay();
        this.updateBidControls();
        this.updateScoreboard();
        document.getElementById('status-message').textContent = '';
        document.getElementById('btn-liar').disabled = !this.currentBid;
    }

    renderDice(dice, containerId) {
        const container = document.getElementById(containerId);
        container.innerHTML = dice.map(d => `<div class="die"><span class="die-icon">${this.dieFace(d)}</span><span class="die-number">${d}</span></div>`).join('');
    }

    dieFace(value) {
        const dots = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
        return dots[value] || value;
    }

    updateBidDisplay() {
        const display = document.getElementById('current-bid-display');
        if (!this.currentBid) {
            display.innerHTML = '<span class="bid-label">No bid yet</span>';
        } else {
            display.innerHTML = `<span class="bid-label">Current bid: </span><span class="bid-value">${this.currentBid.quantity} × ${this.dieFace(this.currentBid.face)}</span><span class="bid-by"> by ${this.currentBid.playerName}</span>`;
        }
    }

    updateBidControls() {
        document.getElementById('bid-quantity').textContent = this.bidQuantity;
        document.getElementById('bid-face').textContent = this.dieFace(this.bidFace);
        const valid = this.isValidBid(this.bidQuantity, this.bidFace);
        document.getElementById('btn-bid').disabled = !valid;
    }

    adjustBid(type, delta) {
        if (type === 'qty') {
            this.bidQuantity = Math.max(1, this.bidQuantity + delta);
        } else {
            const min = settings.wildOnes ? 2 : 1;
            this.bidFace = Math.max(min, Math.min(6, this.bidFace + delta));
        }
        this.updateBidControls();
    }

    isValidBid(qty, face) {
        if (!this.currentBid) return true;
        if (qty > this.currentBid.quantity) return true;
        if (qty === this.currentBid.quantity && face > this.currentBid.face) return true;
        return false;
    }

    placeBid() {
        if (!this.isValidBid(this.bidQuantity, this.bidFace)) return;
        this.currentBid = {
            quantity: this.bidQuantity,
            face: this.bidFace,
            playerIndex: this.currentPlayerIndex,
            playerName: this.players[this.currentPlayerIndex].name
        };
        this.currentPlayerIndex = this.getNextPlayer(this.currentPlayerIndex);
        this.showTurn();
    }

    callLiar() {
        if (!this.currentBid) return;
        this.resolveLiar();
    }

    resolveLiar() {
        const bid = this.currentBid;
        const challenger = this.players[this.currentPlayerIndex];
        const bidder = this.players[bid.playerIndex];

        let count = 0;
        this.players.forEach(p => {
            p.dice.forEach(d => {
                if (d === bid.face) count++;
                else if (settings.wildOnes && d === 1 && bid.face !== 1) count++;
            });
        });

        const bidMet = count >= bid.quantity;
        const loserIndex = bidMet ? this.currentPlayerIndex : bid.playerIndex;
        const loser = this.players[loserIndex];
        loser.diceCount--;

        const container = document.getElementById('reveal-container');
        container.innerHTML = this.players.filter(p => p.dice.length > 0).map(p => `
            <div class="reveal-player">
                <span class="reveal-name">${p.name}</span>
                <div class="dice-display">${p.dice.map(d => `<div class="die ${d === bid.face || (settings.wildOnes && d === 1 && bid.face !== 1) ? 'highlighted' : ''}"><span class="die-icon">${this.dieFace(d)}</span><span class="die-number">${d}</span></div>`).join('')}</div>
            </div>
        `).join('');

        document.getElementById('reveal-title').textContent = `${challenger.name} called LIAR!`;
        const resultEl = document.getElementById('reveal-result');
        resultEl.innerHTML = `
            <p>Bid: ${bid.quantity} × ${this.dieFace(bid.face)} by ${bidder.name}</p>
            <p>Actual count: ${count}</p>
            <p class="${bidMet ? 'result-bad' : 'result-good'}">${bidMet ? `Bid was correct! ${challenger.name} loses a die.` : `Bid was wrong! ${bidder.name} loses a die.`}</p>
            ${loser.diceCount === 0 ? `<p class="eliminated">${loser.name} is eliminated!</p>` : ''}
        `;

        this.loserIndex = loserIndex;
        this.showScreen('reveal');
    }

    continueAfterReveal() {
        const activePlayers = this.players.filter(p => p.diceCount > 0);
        if (activePlayers.length === 1) {
            this.endGame(activePlayers[0]);
            return;
        }
        this.currentRound++;
        if (this.players[this.loserIndex].diceCount > 0) {
            this.currentPlayerIndex = this.loserIndex;
        } else {
            this.currentPlayerIndex = this.getNextPlayer(this.loserIndex);
        }
        this.startRound();
    }

    getNextPlayer(fromIndex) {
        let next = (fromIndex + 1) % this.players.length;
        while (this.players[next].diceCount === 0) {
            next = (next + 1) % this.players.length;
        }
        return next;
    }

    endGame(winner) {
        document.getElementById('final-result').innerHTML = `
            <div class="score-row winner">
                <span class="name">👑 ${winner.name} wins!</span>
            </div>
            <p style="color:#a0a0b0;margin-top:16px;">Last player standing with ${winner.diceCount} dice remaining.</p>
        `;
        this.showScreen('gameOver');
    }

    updateScoreboard() {
        const container = document.getElementById('scoreboard');
        container.innerHTML = this.players.map((p, i) => {
            const isActive = i === this.currentPlayerIndex;
            const isOut = p.diceCount === 0;
            return `<div class="score-chip ${isActive ? 'active' : ''} ${isOut ? 'eliminated' : ''}">
                <span class="chip-name">${p.name}</span>
                <span class="chip-score">${'🎲'.repeat(p.diceCount)}${isOut ? ' ☠️' : ''}</span>
            </div>`;
        }).join('');
    }

    submitFeedback() {
        const description = document.getElementById('feedback-description').value.trim();
        const steps = document.getElementById('feedback-steps').value.trim();
        const category = document.getElementById('feedback-category').value;
        if (!description) { alert('Please describe the bug.'); return; }
        const title = `[Bug] [${category}] ${description.substring(0, 60)}`;
        const body = `**Category:** ${category}\n\n**Description:**\n${description}\n\n**Steps to reproduce:**\n${steps || 'N/A'}\n\n**Browser:** ${navigator.userAgent}`;
        const url = `https://github.com/samipparikh/liars-dice/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}&labels=bug`;
        window.open(url, '_blank');
        document.getElementById('feedback-description').value = '';
        document.getElementById('feedback-steps').value = '';
        this.showScreen('menu');
    }
}

new Game();
