// ============ PROBABILITY & TIPS ============

function calcBidProbability(myDice, currentBid, totalDice) {
    if (!currentBid) return null;
    const myMatching = myDice.filter(d => d === currentBid.face || (settings.wildOnes && d === 1 && currentBid.face !== 1)).length;
    const otherDice = totalDice - myDice.length;
    const probPerDie = settings.wildOnes && currentBid.face !== 1 ? 1 / 3 : 1 / 6;
    const needed = currentBid.quantity - myMatching;

    if (needed <= 0) return { prob: 0.95, label: 'Very Likely True' };

    // Binomial probability approximation
    const expectedOthers = otherDice * probPerDie;
    const variance = otherDice * probPerDie * (1 - probPerDie);
    const stdDev = Math.sqrt(variance);
    if (stdDev === 0) return { prob: needed <= 0 ? 0.95 : 0.05, label: needed <= 0 ? 'Very Likely True' : 'Very Unlikely' };

    const z = (needed - expectedOthers) / stdDev;
    const prob = 1 - normalCDF(z);
    return { prob: Math.min(0.95, Math.max(0.05, prob)), label: getProbLabel(prob) };
}

function normalCDF(x) {
    const t = 1 / (1 + 0.2316419 * Math.abs(x));
    const d = 0.3989422804 * Math.exp(-x * x / 2);
    const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    return x > 0 ? 1 - p : p;
}

function getProbLabel(prob) {
    if (prob >= 0.75) return 'Very Likely True';
    if (prob >= 0.55) return 'Probably True';
    if (prob >= 0.40) return 'Coin Flip';
    if (prob >= 0.25) return 'Probably Bluff';
    return 'Very Likely Bluff';
}

function getHumanTips(myDice, currentBid, totalDice) {
    const tips = [];
    const faceCounts = [0, 0, 0, 0, 0, 0, 0];
    myDice.forEach(d => faceCounts[d]++);
    if (settings.wildOnes) { for (let f = 2; f <= 6; f++) faceCounts[f] += faceCounts[1]; }

    const otherDice = totalDice - myDice.length;
    const probPerDie = settings.wildOnes ? 1 / 3 : 1 / 6;

    if (!currentBid) {
        let bestFace = settings.wildOnes ? 2 : 1, bestCount = 0;
        for (let f = (settings.wildOnes ? 2 : 1); f <= 6; f++) {
            if (faceCounts[f] > bestCount) { bestCount = faceCounts[f]; bestFace = f; }
        }
        const safe = Math.floor(bestCount + otherDice * probPerDie * 0.6);
        tips.push(`You have ${bestCount} matching ${bestFace}s — bid around ${safe} × ${bestFace} for safety`);
        return { riskScore: null, tips };
    }

    const analysis = calcBidProbability(myDice, currentBid, totalDice);
    const riskScore = Math.round((1 - analysis.prob) * 100);

    if (analysis.prob >= 0.65) {
        tips.push(`Current bid is likely true (${Math.round(analysis.prob * 100)}% chance). Raising is safer than calling LIAR.`);
    } else if (analysis.prob <= 0.35) {
        tips.push(`Current bid looks like a bluff (only ${Math.round(analysis.prob * 100)}% likely). Calling LIAR is a strong play.`);
    } else {
        tips.push(`It's close — about ${Math.round(analysis.prob * 100)}% the bid is real. Trust your read.`);
    }

    let bestFace = settings.wildOnes ? 2 : 1, bestCount = 0;
    for (let f = (settings.wildOnes ? 2 : 1); f <= 6; f++) {
        if (faceCounts[f] > bestCount) { bestCount = faceCounts[f]; bestFace = f; }
    }
    if (bestFace !== currentBid.face && bestCount > 0) {
        tips.push(`You're strong in ${bestFace}s (${bestCount} showing). Consider bidding that face.`);
    }

    const myMatch = faceCounts[currentBid.face] || 0;
    if (myMatch >= 2) {
        tips.push(`You have ${myMatch} of the bid face — raising quantity is low risk.`);
    }

    return { riskScore, tips, probLabel: analysis.label };
}

// ============ AI LOGIC ============

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
