class OnlineGame {
    constructor() {
        this.db = firebase.database();
        this.roomRef = null;
        this.roomCode = null;
        this.playerId = null;
        this.playerName = null;
        this.isHost = false;
        this.unsubscribers = [];
        this.activeGamesListener = null;

        this.screens = {
            menu: document.getElementById('menu-screen'),
            online: document.getElementById('online-screen'),
            lobby: document.getElementById('lobby-screen'),
            onlineGame: document.getElementById('online-game-screen'),
            onlineReveal: document.getElementById('online-reveal-screen'),
            onlineGameOver: document.getElementById('online-game-over-screen'),
        };

        this.bindEvents();
    }

    bindEvents() {
        document.getElementById('btn-create-room').addEventListener('click', () => this.showCreateRoom());
        document.getElementById('btn-join-room').addEventListener('click', () => this.showJoinRoom());
        document.getElementById('btn-back-online').addEventListener('click', () => { this.stopListeningForActiveGames(); this.showScreen('menu'); });
        document.getElementById('btn-confirm-create').addEventListener('click', () => this.createRoom());
        document.getElementById('btn-confirm-join').addEventListener('click', () => this.joinRoom());
        document.getElementById('btn-start-online').addEventListener('click', () => this.startOnlineGame());
        document.getElementById('btn-leave-room').addEventListener('click', () => this.leaveRoom());
        document.getElementById('btn-online-bid').addEventListener('click', () => this.onlineBid());
        document.getElementById('btn-online-liar').addEventListener('click', () => this.onlineCallLiar());
        document.getElementById('btn-online-continue').addEventListener('click', () => this.onlineContinue());
        document.getElementById('btn-online-play-again').addEventListener('click', () => this.leaveRoom());
        document.getElementById('online-qty-minus').addEventListener('click', () => this.adjustOnlineBid('qty', -1));
        document.getElementById('online-qty-plus').addEventListener('click', () => this.adjustOnlineBid('qty', 1));
        document.getElementById('online-face-minus').addEventListener('click', () => this.adjustOnlineBid('face', -1));
        document.getElementById('online-face-plus').addEventListener('click', () => this.adjustOnlineBid('face', 1));
    }

    showScreen(name) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        if (this.screens[name]) this.screens[name].classList.add('active');
        else document.getElementById('menu-screen').classList.add('active');
    }

    showOnlineScreen() {
        this.showScreen('online');
        this.startListeningForActiveGames();
    }

    showCreateRoom() {
        document.getElementById('online-mode-title').textContent = 'Create Room';
        document.getElementById('join-code-group').style.display = 'none';
        document.getElementById('btn-confirm-create').style.display = 'block';
        document.getElementById('btn-confirm-join').style.display = 'none';
    }

    showJoinRoom() {
        document.getElementById('online-mode-title').textContent = 'Join Room';
        document.getElementById('join-code-group').style.display = 'block';
        document.getElementById('btn-confirm-create').style.display = 'none';
        document.getElementById('btn-confirm-join').style.display = 'block';
    }

    startListeningForActiveGames() {
        if (this.activeGamesListener) return;
        const roomsRef = this.db.ref('liars-dice-rooms');
        this.activeGamesListener = roomsRef.orderByChild('state').equalTo('lobby').on('value', (snapshot) => {
            const container = document.getElementById('active-games-list');
            if (!snapshot.exists()) { container.innerHTML = '<p class="no-games">No active games right now</p>'; return; }
            const rooms = snapshot.val();
            const entries = Object.entries(rooms).filter(([c, r]) => Object.keys(r.players || {}).length < 6);
            if (entries.length === 0) { container.innerHTML = '<p class="no-games">No active games right now</p>'; return; }
            container.innerHTML = entries.map(([code, room]) => {
                const playerCount = Object.keys(room.players || {}).length;
                return `<div class="active-game-card" data-code="${code}"><div><span class="active-game-code">${code}</span></div><div class="active-game-players">${playerCount}/6</div></div>`;
            }).join('');
            container.querySelectorAll('.active-game-card').forEach(card => {
                card.addEventListener('click', () => { document.getElementById('join-code-input').value = card.dataset.code; this.showJoinRoom(); });
            });
        });
    }

    stopListeningForActiveGames() {
        if (this.activeGamesListener) { this.db.ref('liars-dice-rooms').off('value', this.activeGamesListener); this.activeGamesListener = null; }
    }

    generateRoomCode() { const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let code = ''; for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)]; return code; }
    generatePlayerId() { return 'p_' + Math.random().toString(36).substr(2, 9); }

    async createRoom() {
        const name = document.getElementById('online-player-name').value.trim();
        if (!name) { document.getElementById('online-status').textContent = 'Please enter your name'; return; }
        this.playerName = name; this.playerId = this.generatePlayerId(); this.isHost = true; this.roomCode = this.generateRoomCode();
        this.roomRef = this.db.ref('liars-dice-rooms/' + this.roomCode);
        await this.roomRef.set({ code: this.roomCode, host: this.playerId, state: 'lobby', players: { [this.playerId]: { name: this.playerName, connected: true } }, createdAt: firebase.database.ServerValue.TIMESTAMP });
        this.roomRef.child('players/' + this.playerId + '/connected').onDisconnect().set(false);
        this.showLobby(); this.listenToRoom();
    }

    async joinRoom() {
        const name = document.getElementById('online-player-name').value.trim();
        const code = document.getElementById('join-code-input').value.trim().toUpperCase();
        if (!name) { document.getElementById('online-status').textContent = 'Please enter your name'; return; }
        if (!code) { document.getElementById('online-status').textContent = 'Please enter a room code'; return; }
        this.playerName = name; this.playerId = this.generatePlayerId(); this.isHost = false; this.roomCode = code;
        this.roomRef = this.db.ref('liars-dice-rooms/' + this.roomCode);
        const snapshot = await this.roomRef.once('value');
        if (!snapshot.exists()) { document.getElementById('online-status').textContent = 'Room not found'; return; }
        const room = snapshot.val();
        if (room.state !== 'lobby') { document.getElementById('online-status').textContent = 'Game already in progress'; return; }
        if (Object.keys(room.players || {}).length >= 6) { document.getElementById('online-status').textContent = 'Room is full'; return; }
        await this.roomRef.child('players/' + this.playerId).set({ name: this.playerName, connected: true });
        this.roomRef.child('players/' + this.playerId + '/connected').onDisconnect().set(false);
        this.showLobby(); this.listenToRoom();
    }

    showLobby() {
        document.getElementById('lobby-room-code').textContent = this.roomCode;
        document.getElementById('btn-start-online').style.display = this.isHost ? 'block' : 'none';
        this.showScreen('lobby');
    }

    listenToRoom() {
        this.roomRef.on('value', (snapshot) => {
            if (!snapshot.exists()) { this.leaveRoom(); return; }
            const room = snapshot.val();
            this.updateLobbyPlayers(room.players || {});
            if (room.state === 'playing') this.handleOnlineGameState(room);
            else if (room.state === 'reveal') this.handleOnlineReveal(room);
            else if (room.state === 'game_over') this.handleOnlineGameOver(room);
        });
    }

    updateLobbyPlayers(players) {
        const list = document.getElementById('lobby-players');
        list.innerHTML = Object.entries(players).map(([id, p]) => `<div class="lobby-player ${id === this.playerId ? 'me' : ''}">${p.name}${id === this.playerId && this.isHost ? ' (Host)' : ''}</div>`).join('');
        document.getElementById('btn-start-online').disabled = Object.keys(players).length < 2;
    }

    async startOnlineGame() {
        if (!this.isHost) return;
        const snapshot = await this.roomRef.once('value');
        const room = snapshot.val();
        const playerIds = Object.keys(room.players);
        const diceState = {};
        playerIds.forEach(id => {
            const dice = [];
            for (let i = 0; i < settings.startingDice; i++) dice.push(Math.floor(Math.random() * 6) + 1);
            diceState[id] = { diceCount: settings.startingDice, dice };
        });
        await this.roomRef.update({ state: 'playing', currentRound: 1, turnOrder: playerIds, currentTurnIndex: 0, diceState, currentBid: null, wildOnes: settings.wildOnes });
    }

    handleOnlineGameState(room) {
        this.showScreen('onlineGame');
        const players = room.players || {};
        const turnOrder = room.turnOrder || [];
        const diceState = room.diceState || {};
        const currentPlayerId = turnOrder[room.currentTurnIndex];
        const isMyTurn = currentPlayerId === this.playerId;
        const myDice = diceState[this.playerId] ? diceState[this.playerId].dice : [];
        const totalDice = turnOrder.reduce((sum, id) => sum + ((diceState[id] || {}).diceCount || 0), 0);

        document.getElementById('online-round-info').textContent = `Round ${room.currentRound || 1}`;
        document.getElementById('online-dice-total').textContent = `Total Dice: ${totalDice}`;
        document.getElementById('online-current-player').textContent = isMyTurn ? 'Your Turn!' : `${(players[currentPlayerId] || {}).name}'s Turn`;

        const diceContainer = document.getElementById('online-your-dice');
        diceContainer.innerHTML = myDice.map(d => `<div class="die">${['','⚀','⚁','⚂','⚃','⚄','⚅'][d]}</div>`).join('');

        const bidDisplay = document.getElementById('online-current-bid');
        if (room.currentBid) {
            bidDisplay.innerHTML = `<span class="bid-label">Current bid: </span><span class="bid-value">${room.currentBid.quantity} × ${['','⚀','⚁','⚂','⚃','⚄','⚅'][room.currentBid.face]}</span><span class="bid-by"> by ${room.currentBid.playerName}</span>`;
        } else {
            bidDisplay.innerHTML = '<span class="bid-label">No bid yet</span>';
        }

        document.getElementById('btn-online-bid').disabled = !isMyTurn;
        document.getElementById('btn-online-liar').disabled = !isMyTurn || !room.currentBid;
        document.getElementById('online-status-message').textContent = '';

        const scoreboard = document.getElementById('online-scoreboard');
        scoreboard.innerHTML = turnOrder.map((id, i) => {
            const p = players[id]; const ds = diceState[id] || {};
            const isActive = i === room.currentTurnIndex; const isOut = (ds.diceCount || 0) === 0;
            return `<div class="score-chip ${isActive ? 'active' : ''} ${isOut ? 'eliminated' : ''}"><span class="chip-name">${p ? p.name : '?'}</span><span class="chip-score">${'🎲'.repeat(ds.diceCount || 0)}${isOut ? ' ☠️' : ''}</span></div>`;
        }).join('');
    }

    adjustOnlineBid(type, delta) {
        const qtyEl = document.getElementById('online-bid-quantity');
        const faceEl = document.getElementById('online-bid-face');
        let qty = parseInt(qtyEl.textContent); let face = parseInt('⚀⚁⚂⚃⚄⚅'.indexOf(faceEl.textContent) >= 0 ? '⚀⚁⚂⚃⚄⚅'.indexOf(faceEl.textContent) + 1 : faceEl.textContent);
        if (type === 'qty') qty = Math.max(1, qty + delta);
        else { const min = settings.wildOnes ? 2 : 1; face = Math.max(min, Math.min(6, face + delta)); }
        qtyEl.textContent = qty;
        faceEl.textContent = ['','⚀','⚁','⚂','⚃','⚄','⚅'][face];
    }

    async onlineBid() {
        const snapshot = await this.roomRef.once('value');
        const room = snapshot.val();
        const turnOrder = room.turnOrder || [];
        if (turnOrder[room.currentTurnIndex] !== this.playerId) return;

        const qty = parseInt(document.getElementById('online-bid-quantity').textContent);
        const faceText = document.getElementById('online-bid-face').textContent;
        const face = '⚀⚁⚂⚃⚄⚅'.indexOf(faceText) + 1;

        if (room.currentBid) {
            if (qty < room.currentBid.quantity) return;
            if (qty === room.currentBid.quantity && face <= room.currentBid.face) return;
        }

        let nextIndex = (room.currentTurnIndex + 1) % turnOrder.length;
        const diceState = room.diceState || {};
        while ((diceState[turnOrder[nextIndex]] || {}).diceCount === 0) nextIndex = (nextIndex + 1) % turnOrder.length;

        await this.roomRef.update({
            currentBid: { quantity: qty, face, playerIndex: room.currentTurnIndex, playerName: this.playerName, playerId: this.playerId },
            currentTurnIndex: nextIndex
        });
    }

    async onlineCallLiar() {
        const snapshot = await this.roomRef.once('value');
        const room = snapshot.val();
        const turnOrder = room.turnOrder || [];
        if (turnOrder[room.currentTurnIndex] !== this.playerId) return;
        if (!room.currentBid) return;

        const diceState = room.diceState || {};
        const bid = room.currentBid;
        let count = 0;
        turnOrder.forEach(id => {
            const ds = diceState[id] || {};
            (ds.dice || []).forEach(d => {
                if (d === bid.face) count++;
                else if (room.wildOnes && d === 1 && bid.face !== 1) count++;
            });
        });

        const bidMet = count >= bid.quantity;
        const loserId = bidMet ? this.playerId : bid.playerId;
        const newDiceState = { ...diceState };
        newDiceState[loserId] = { ...newDiceState[loserId], diceCount: newDiceState[loserId].diceCount - 1 };

        await this.roomRef.update({
            state: 'reveal',
            revealData: { challengerId: this.playerId, challengerName: this.playerName, bid, count, bidMet, loserId, loserName: (room.players[loserId] || {}).name },
            diceState: newDiceState
        });
    }

    handleOnlineReveal(room) {
        this.showScreen('onlineReveal');
        const rd = room.revealData || {};
        const players = room.players || {};
        const diceState = room.diceState || {};
        const turnOrder = room.turnOrder || [];

        document.getElementById('online-reveal-title').textContent = `${rd.challengerName} called LIAR!`;
        const container = document.getElementById('online-reveal-container');
        container.innerHTML = turnOrder.filter(id => (diceState[id] || {}).dice).map(id => {
            const dice = diceState[id].dice || [];
            return `<div class="reveal-player"><span class="reveal-name">${(players[id] || {}).name}</span><div class="dice-display">${dice.map(d => `<div class="die ${d === rd.bid.face || (room.wildOnes && d === 1 && rd.bid.face !== 1) ? 'highlighted' : ''}">${['','⚀','⚁','⚂','⚃','⚄','⚅'][d]}</div>`).join('')}</div></div>`;
        }).join('');

        document.getElementById('online-reveal-result').innerHTML = `<p>Bid: ${rd.bid.quantity} × ${['','⚀','⚁','⚂','⚃','⚄','⚅'][rd.bid.face]}</p><p>Actual: ${rd.count}</p><p class="${rd.bidMet ? 'result-bad' : 'result-good'}">${rd.bidMet ? `Bid correct! ${rd.challengerName} loses a die.` : `Bid wrong! ${rd.loserName} loses a die.`}</p>${(diceState[rd.loserId] || {}).diceCount === 0 ? `<p class="eliminated">${rd.loserName} eliminated!</p>` : ''}`;

        document.getElementById('btn-online-continue').style.display = this.isHost ? 'block' : 'none';
        document.getElementById('online-continue-wait').style.display = this.isHost ? 'none' : 'block';
    }

    async onlineContinue() {
        if (!this.isHost) return;
        const snapshot = await this.roomRef.once('value');
        const room = snapshot.val();
        const turnOrder = room.turnOrder || [];
        const diceState = room.diceState || {};
        const rd = room.revealData || {};

        const activePlayers = turnOrder.filter(id => (diceState[id] || {}).diceCount > 0);
        if (activePlayers.length <= 1) {
            await this.roomRef.update({ state: 'game_over', winner: activePlayers[0] || null });
            return;
        }

        let startIndex = turnOrder.indexOf(rd.loserId);
        if ((diceState[rd.loserId] || {}).diceCount === 0) {
            startIndex = (startIndex + 1) % turnOrder.length;
            while ((diceState[turnOrder[startIndex]] || {}).diceCount === 0) startIndex = (startIndex + 1) % turnOrder.length;
        }

        const newDiceState = {};
        turnOrder.forEach(id => {
            const dc = (diceState[id] || {}).diceCount || 0;
            if (dc > 0) {
                const dice = [];
                for (let i = 0; i < dc; i++) dice.push(Math.floor(Math.random() * 6) + 1);
                newDiceState[id] = { diceCount: dc, dice };
            } else {
                newDiceState[id] = { diceCount: 0, dice: [] };
            }
        });

        await this.roomRef.update({ state: 'playing', currentRound: (room.currentRound || 1) + 1, currentTurnIndex: startIndex, diceState: newDiceState, currentBid: null, revealData: null });
    }

    handleOnlineGameOver(room) {
        this.showScreen('onlineGameOver');
        const players = room.players || {};
        const winner = room.winner ? (players[room.winner] || {}).name : 'Unknown';
        document.getElementById('online-final-result').innerHTML = `<div class="score-row winner"><span class="name">👑 ${winner} wins!</span></div>`;
    }

    async leaveRoom() {
        if (this.roomRef && this.playerId) {
            if (this.isHost) await this.roomRef.remove();
            else await this.roomRef.child('players/' + this.playerId + '/connected').set(false);
        }
        this.roomRef = null; this.roomCode = null; this.playerId = null; this.isHost = false;
        this.showScreen('menu');
    }
}

let onlineGame;
document.addEventListener('DOMContentLoaded', () => { onlineGame = new OnlineGame(); });
