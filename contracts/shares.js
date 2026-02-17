/*
 * MIT License
 * Copyright (c) 2026 ICRC Humanitarian Blockchain Project
 */

// contracts/shares.js - Share Management for Prediction Markets

class ShareManager {
    constructor() {
        this.userBalances = {}; // { userId: { credits: number, holdings: { marketId: { YES: num, NO: num } } } }
        this.userStats = {}; // { userId: { correctPredictions: 0, totalPredictions: 0, profit: 0 } }
    }

    /**
     * Initialize a user account with starting credits
     * @param {string} userId - User identifier
     * @param {number} initialCredits - Starting incentive credits
     */
    initializeUser(userId, initialCredits = 10000) {
        if (!this.userBalances[userId]) {
            this.userBalances[userId] = {
                credits: initialCredits,
                holdings: {}
            };
            this.userStats[userId] = {
                correctPredictions: 0,
                totalPredictions: 0,
                profit: 0,
                totalTrades: 0
            };
        }
    }

    /**
     * Get user balance
     * @param {string} userId - User identifier
     * @returns {Object} - User balance and holdings
     */
    getBalance(userId) {
        if (!this.userBalances[userId]) {
            this.initializeUser(userId);
        }
        return {
            credits: this.userBalances[userId].credits,
            holdings: this.userBalances[userId].holdings,
            stats: this.userStats[userId]
        };
    }

    /**
     * Buy shares in a market
     * @param {string} userId - User identifier
     * @param {Object} market - Market object
     * @param {string} outcome - 'YES' or 'NO'
     * @param {number} amount - Number of shares
     * @returns {Object} - Transaction result
     */
    buyShares(userId, market, outcome, amount) {
        if (!this.userBalances[userId]) {
            this.initializeUser(userId);
        }

        const transaction = market.buyShares(userId, outcome, amount);
        
        // Deduct credits
        this.userBalances[userId].credits -= transaction.cost;
        
        // Update holdings
        if (!this.userBalances[userId].holdings[market.marketID]) {
            this.userBalances[userId].holdings[market.marketID] = { YES: 0, NO: 0 };
        }
        this.userBalances[userId].holdings[market.marketID][outcome] += amount;
        
        // Update stats
        this.userStats[userId].totalTrades++;

        return transaction;
    }

    /**
     * Sell shares back to market
     * @param {string} userId - User identifier
     * @param {Object} market - Market object
     * @param {string} outcome - 'YES' or 'NO'
     * @param {number} amount - Number of shares
     * @returns {Object} - Transaction result
     */
    sellShares(userId, market, outcome, amount) {
        if (!this.userBalances[userId]) {
            throw new Error('User account not found');
        }

        const transaction = market.sellShares(userId, outcome, amount);
        
        // Add credits
        this.userBalances[userId].credits += transaction.payout;
        
        // Update holdings
        this.userBalances[userId].holdings[market.marketID][outcome] -= amount;
        
        // Update stats
        this.userStats[userId].totalTrades++;
        this.userStats[userId].profit += (transaction.payout - transaction.cost);

        return transaction;
    }

    /**
     * Resolve user positions after market resolution
     * @param {string} userId - User identifier
     * @param {Object} market - Resolved market
     */
    resolvePosition(userId, market) {
        if (!this.userBalances[userId] || !this.userBalances[userId].holdings[market.marketID]) {
            return;
        }

        const holdings = this.userBalances[userId].holdings[market.marketID];
        const winningShares = holdings[market.winningOutcome];
        const losingShares = holdings[market.winningOutcome === 'YES' ? 'NO' : 'YES'];

        // Update stats
        if (winningShares > 0) {
            this.userStats[userId].correctPredictions++;
        }
        if (winningShares > 0 || losingShares > 0) {
            this.userStats[userId].totalPredictions++;
        }

        // Clear holdings for this market
        delete this.userBalances[userId].holdings[market.marketID];
    }

    /**
     * Get leaderboard sorted by prediction accuracy
     * @returns {Array} - Sorted list of users with stats
     */
    getLeaderboard() {
        const leaderboard = Object.keys(this.userStats).map(userId => ({
            userId,
            ...this.userStats[userId],
            accuracy: this.userStats[userId].totalPredictions > 0 
                ? Math.round((this.userStats[userId].correctPredictions / this.userStats[userId].totalPredictions) * 100) 
                : 0,
            credits: this.userBalances[userId]?.credits || 0
        }));

        // Sort by accuracy (primary) and profit (secondary)
        return leaderboard.sort((a, b) => {
            if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy;
            return b.profit - a.profit;
        });
    }

    /**
     * Get all user positions across markets
     * @param {string} userId - User identifier
     * @returns {Object} - User's current positions
     */
    getUserPositions(userId) {
        if (!this.userBalances[userId]) {
            return { credits: 0, holdings: {}, stats: null };
        }
        return {
            credits: this.userBalances[userId].credits,
            holdings: this.userBalances[userId].holdings,
            stats: this.userStats[userId]
        };
    }
}

module.exports = {
    ShareManager
};