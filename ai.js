const AI_NAMES_LD = ['Bluffer', 'Shady', 'Dice Master', 'Snake Eyes', 'Lucky'];
const AI_STYLES_LD = ['aggressive', 'conservative', 'balanced', 'tricky', 'cautious'];

function createLDPlayers(humanName, aiCount) {
    const players = [{ name: humanName || 'You', diceCount: settings.startingDice, dice: [], isAI: false }];
    for (let i = 0; i < aiCount; i++) {
        players.push({
            name: AI_NAMES_LD[i % AI_NAMES_LD.length],
            diceCount: settings.startingDice,
            dice: [],
            isAI: true,
            style: AI_STYLES_LD[i % AI_STYLES_LD.length]
        });
    }
    return players;
}

function getAIBidDecision(player, currentBid, totalDice, allPlayers) {
    const myDice = player.dice;
    const myCount = myDice.length;

    if (!currentBid) {
        const faceCounts = [0, 0, 0, 0, 0, 0, 0];
        myDice.forEach(d => faceCounts[d]++);
        if (settings.wildOnes) {
            for (let f = 2; f <= 6; f++) faceCounts[f] += faceCounts[1];
        }
        let bestFace = settings.wildOnes ? 2 : 1;
        let bestCount = 0;
        const minFace = settings.wildOnes ? 2 : 1;
        for (let f = minFace; f <= 6; f++) {
            if (faceCounts[f] > bestCount) { bestCount = faceCounts[f]; bestFace = f; }
        }
        const otherDice = totalDice - myCount;
        const expectedOthers = settings.wildOnes ? otherDice / 3 : otherDice / 6;
        const bidQty = Math.max(1, Math.floor(bestCount + expectedOthers * 0.5 + (Math.random() - 0.3)));
        return { action: 'bid', quantity: bidQty, face: bestFace };
    }

    const faceCounts = [0, 0, 0, 0, 0, 0, 0];
    myDice.forEach(d => faceCounts[d]++);
    if (settings.wildOnes) {
        for (let f = 2; f <= 6; f++) faceCounts[f] += faceCounts[1];
    }

    const myMatching = faceCounts[currentBid.face] || 0;
    const otherDice = totalDice - myCount;
    const probPerDie = settings.wildOnes && currentBid.face !== 1 ? 1 / 3 : 1 / 6;
    const expectedTotal = myMatching + otherDice * probPerDie;
    const deficit = currentBid.quantity - expectedTotal;

    let callThreshold;
    switch (player.style) {
        case 'aggressive': callThreshold = 2.5; break;
        case 'conservative': callThreshold = 1.2; break;
        case 'tricky': callThreshold = 1.8 + (Math.random() - 0.5); break;
        case 'cautious': callThreshold = 1.0; break;
        default: callThreshold = 1.8;
    }

    if (deficit > callThreshold) {
        return { action: 'liar' };
    }

    let newQty = currentBid.quantity;
    let newFace = currentBid.face;

    let bestFace = currentBid.face;
    let bestMyCount = faceCounts[currentBid.face] || 0;
    const minFace = settings.wildOnes ? 2 : 1;
    for (let f = minFace; f <= 6; f++) {
        if ((faceCounts[f] || 0) > bestMyCount) { bestMyCount = faceCounts[f]; bestFace = f; }
    }

    if (bestFace > currentBid.face) {
        newFace = bestFace;
    } else {
        newQty = currentBid.quantity + 1;
        newFace = bestFace;
    }

    if (newQty === currentBid.quantity && newFace <= currentBid.face) {
        newQty = currentBid.quantity + 1;
    }

    const bluffChance = player.style === 'aggressive' ? 0.3 : player.style === 'tricky' ? 0.25 : 0.1;
    if (Math.random() < bluffChance) {
        newQty += Math.random() < 0.5 ? 1 : 0;
        newFace = Math.floor(Math.random() * (6 - minFace + 1)) + minFace;
        if (newQty <= currentBid.quantity && newFace <= currentBid.face) newQty = currentBid.quantity + 1;
    }

    if (newQty > totalDice) {
        return { action: 'liar' };
    }

    return { action: 'bid', quantity: newQty, face: newFace };
}
