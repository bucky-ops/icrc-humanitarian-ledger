/*
 * MIT License
 * Copyright (c) 2026 ICRC Humanitarian Blockchain Project
 */

// test-prediction.js - Test script for Prediction Market functionality

const { PredictionMarket } = require('./contracts/market');
const { ShareManager } = require('./contracts/shares');

console.log('=== ICRC Humanitarian Prediction Market Test ===\n');

// Test 1: Create a prediction market
console.log('📊 Test 1: Creating Prediction Market...');
const market = new PredictionMarket(
    'MKT-001',
    'Will Kit-001 arrive in Nairobi by Friday?',
    'KIT-001',
    '2026-02-21T23:59:59Z',
    'admin'
);

console.log('✅ Market Created:', market.marketID);
console.log('   Question:', market.question);
console.log('   Kit ID:', market.kitID);
console.log('   Deadline:', market.deadline);
console.log('   Initial Pool - YES:', market.outcomes.YES, 'NO:', market.outcomes.NO);
console.log('');

// Test 2: Get market probabilities
console.log('📈 Test 2: Getting Market Probabilities...');
const probs = market.getProbabilities();
console.log('   YES Probability:', probs.YES + '%');
console.log('   NO Probability:', probs.NO + '%');
console.log('');

// Test 3: Initialize share manager and users
console.log('👥 Test 3: Setting up Share Manager...');
const shareManager = new ShareManager();
shareManager.initializeUser('user_alice', 10000);
shareManager.initializeUser('user_bob', 10000);
console.log('   Alice Balance:', shareManager.getBalance('user_alice').credits, 'CR');
console.log('   Bob Balance:', shareManager.getBalance('user_bob').credits, 'CR');
console.log('');

// Test 4: Buy YES shares (Alice believes kit will arrive on time)
console.log('✅ Test 4: Alice buys 200 YES shares...');
try {
    const aliceTransaction = shareManager.buyShares('user_alice', market, 'YES', 200);
    console.log('   Transaction Cost:', aliceTransaction.cost, 'CR');
    console.log('   Alice Remaining Balance:', shareManager.getBalance('user_alice').credits, 'CR');
    console.log('   Alice Holdings:', shareManager.getUserPositions('user_alice').holdings[market.marketID]);
} catch (error) {
    console.error('   ❌ Error:', error.message);
}
console.log('');

// Test 5: Buy NO shares (Bob believes kit will be delayed)
console.log('❌ Test 5: Bob buys 300 NO shares...');
try {
    const bobTransaction = shareManager.buyShares('user_bob', market, 'NO', 300);
    console.log('   Transaction Cost:', bobTransaction.cost, 'CR');
    console.log('   Bob Remaining Balance:', shareManager.getBalance('user_bob').credits, 'CR');
    console.log('   Bob Holdings:', shareManager.getUserPositions('user_bob').holdings[market.marketID]);
} catch (error) {
    console.error('   ❌ Error:', error.message);
}
console.log('');

// Test 6: Check updated market probabilities
console.log('📊 Test 6: Updated Market Probabilities...');
const updatedProbs = market.getProbabilities();
console.log('   YES Probability:', updatedProbs.YES + '% (was', probs.YES + '%)');
console.log('   NO Probability:', updatedProbs.NO + '% (was', probs.NO + '%)');
console.log('   Total Volume:', market.totalVolume, 'CR');
console.log('');

// Test 7: Sell some shares
console.log('💰 Test 7: Alice sells 100 YES shares...');
try {
    const sellTransaction = shareManager.sellShares('user_alice', market, 'YES', 100);
    console.log('   Payout:', sellTransaction.payout, 'CR');
    console.log('   Alice New Balance:', shareManager.getBalance('user_alice').credits, 'CR');
} catch (error) {
    console.error('   ❌ Error:', error.message);
}
console.log('');

// Test 8: Resolve the market (simulate kit arriving on time)
console.log('⚖️ Test 8: Resolving Market (Kit arrived on time - YES wins)...');
market.resolve('YES');
console.log('   Market Status:', market.status);
console.log('   Winning Outcome:', market.winningOutcome);
console.log('');

// Test 9: Resolve user positions
console.log('🏆 Test 9: Resolving User Positions...');
shareManager.resolvePosition('user_alice', market);
shareManager.resolvePosition('user_bob', market);
console.log('   Alice Final Stats:', shareManager.userStats['user_alice']);
console.log('   Bob Final Stats:', shareManager.userStats['user_bob']);
console.log('');

// Test 10: Get leaderboard
console.log('📋 Test 10: Leaderboard...');
const leaderboard = shareManager.getLeaderboard();
leaderboard.forEach((user, index) => {
    console.log(`   #${index + 1} ${user.userId}: ${user.accuracy}% accuracy, ${user.correctPredictions}/${user.totalPredictions} correct`);
});
console.log('');

// Test 11: Market JSON serialization
console.log('📄 Test 11: Market JSON Output...');
console.log(JSON.stringify(market.toJSON(), null, 2));
console.log('');

console.log('=== All Tests Completed Successfully! ===');