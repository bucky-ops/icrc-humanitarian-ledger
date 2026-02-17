/*
 * MIT License
 * Copyright (c) 2026 ICRC Humanitarian Blockchain Project
 */

// contracts/market.js - Prediction Market Logic for Humanitarian Forecasting

class PredictionMarket {
    /**
     * Create a new prediction market
     * @param {string} marketID - Unique identifier for the market
     * @param {string} question - The prediction question (e.g., "Will Kit-X arrive on time?")
     * @param {string} kitID - Linked kit identifier
     * @param {string} deadline - Deadline for the prediction (ISO date string)
     * @param {string} createdBy - Creator's user ID
     */
    constructor(marketID, question, kitID, deadline, createdBy) {
        this.marketID = marketID;
        this.question = question;
        this.kitID = kitID;
        this.deadline = deadline;
        this.createdBy = createdBy;
        this.createdAt = new Date().toISOString();
        
        // Pool balances for YES and NO shares (Constant Product Market Maker)
        this.outcomes = { 
            YES: 1000,  // Initial liquidity for YES shares
            NO: 1000    // Initial liquidity for NO shares
        };
        
        // Track user positions
        this.positions = {}; // { userId: { YES: amount, NO: amount } }
        
        // Market status
        this.status = 'OPEN'; // OPEN, CLOSED, RESOLVED
        this.winningOutcome = null;
        this.totalVolume = 0;
    }

    /**
     * Calculate the price of a share based on the constant product formula
     * Price = poolBalance / (poolBalanceYES * poolBalanceNO)
     * @param {string} outcome - 'YES' or 'NO'
     * @param {number} amount - Number of shares to buy
     * @returns {number} - Cost in incentive credits
     */
    calculatePrice(outcome, amount) {
        const currentPool = this.outcomes[outcome];
        const otherPool = this.outcomes[outcome === 'YES' ? 'NO' : 'YES'];
        
        // Constant product formula: x * y = k
        // New price based on how much the pool balance changes
        const newPool = currentPool - amount;
        const price = amount * (otherPool / currentPool);
        
        return Math.round(price * 100) / 100;
    }

    /**
     * Buy shares in an outcome
     * @param {string} userId - User buying shares
     * @param {string} outcome - 'YES' or 'NO'
     * @param {number} amount - Number of shares to buy
     * @returns {Object} - Transaction details including cost
     */
    buyShares(userId, outcome, amount) {
        if (this.status !== 'OPEN') {
            throw new Error('Market is not open for trading');
        }

        const cost = this.calculatePrice(outcome, amount);
        
        // Update pool
        this.outcomes[outcome] -= amount;
        this.totalVolume += cost;

        // Update user position
        if (!this.positions[userId]) {
            this.positions[userId] = { YES: 0, NO: 0 };
        }
        this.positions[userId][outcome] += amount;

        return {
            marketID: this.marketID,
            userId,
            outcome,
            shares: amount,
            cost,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Sell shares back to the market
     * @param {string} userId - User selling shares
     * @param {string} outcome - 'YES' or 'NO'
     * @param {number} amount - Number of shares to sell
     * @returns {Object} - Transaction details including payout
     */
    sellShares(userId, outcome, amount) {
        if (this.status !== 'OPEN') {
            throw new Error('Market is not open for trading');
        }

        if (!this.positions[userId] || this.positions[userId][outcome] < amount) {
            throw new Error('Insufficient shares');
        }

        const payout = this.calculatePrice(outcome, amount);
        
        // Update pool
        this.outcomes[outcome] += amount;
        this.totalVolume += payout;

        // Update user position
        this.positions[userId][outcome] -= amount;

        return {
            marketID: this.marketID,
            userId,
            outcome,
            shares: amount,
            payout,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Resolve the market based on actual outcome
     * @param {string} actualOutcome - 'YES' or 'NO' based on blockchain data
     */
    resolve(actualOutcome) {
        if (this.status !== 'OPEN') {
            throw new Error('Market already closed');
        }

        this.winningOutcome = actualOutcome;
        this.status = 'RESOLVED';
        
        console.log(`⚖️ Market ${this.marketID} resolved as ${this.winningOutcome}`);
    }

    /**
     * Get current market probability (price as percentage)
     * @returns {Object} - YES and NO probabilities
     */
    getProbabilities() {
        const totalPool = this.outcomes.YES + this.outcomes.NO;
        const yesProb = Math.round((this.outcomes.NO / totalPool) * 100);
        const noProb = 100 - yesProb;
        
        return {
            YES: yesProb,
            NO: noProb
        };
    }

    /**
     * Get market data for API response
     * @returns {Object} - Serialized market data
     */
    toJSON() {
        const probabilities = this.getProbabilities();
        return {
            marketID: this.marketID,
            question: this.question,
            kitID: this.kitID,
            deadline: this.deadline,
            createdBy: this.createdBy,
            createdAt: this.createdAt,
            status: this.status,
            winningOutcome: this.winningOutcome,
            totalVolume: this.totalVolume,
            currentPrice: {
                YES: probabilities.YES,
                NO: probabilities.NO
            },
            pool: {
                YES: this.outcomes.YES,
                NO: this.outcomes.NO
            }
        };
    }
}

module.exports = {
    PredictionMarket
};