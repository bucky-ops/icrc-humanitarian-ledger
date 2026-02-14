// bin/audit-ledger.js - Chain integrity script for the ICRC medical tracking system
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Calculates the SHA-256 hash of a block
 * @param {number} index - Block index
 * @param {string} timestamp - Block timestamp
 * @param {Object} data - Block data
 * @param {string} previousHash - Previous block's hash
 * @returns {string} The calculated hash
 */
function calculateHash(index, timestamp, data, previousHash) {
  const dataString = JSON.stringify(data);
  return crypto.createHash('sha256')
    .update(index + timestamp + dataString + previousHash)
    .digest('hex');
}

function auditLedger() {
  console.log('--- Starting Chain Integrity Audit ---');
  
  const ledgerPath = path.join(__dirname, '..', 'ledger-data');
  
  // Read all files in the ledger-data directory
  const files = fs.readdirSync(ledgerPath);
  
  if (files.length === 0) {
    console.log('No blocks found in ledger-data directory.');
    return;
  }
  
  // Filter for block files and sort them by index
  const blockFiles = files
    .filter(file => file.startsWith('block_') && file.endsWith('.json'))
    .sort((a, b) => {
      const indexA = parseInt(a.match(/block_(\d+)\.json/)[1]);
      const indexB = parseInt(b.match(/block_(\d+)\.json/)[1]);
      return indexA - indexB;
    });
  
  if (blockFiles.length === 0) {
    console.log('No block files found in ledger-data directory.');
    return;
  }
  
  console.log(`Found ${blockFiles.length} blocks to audit.`);
  
  // Load all blocks
  const blocks = blockFiles.map(fileName => {
    const filePath = path.join(ledgerPath, fileName);
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  });
  
  let isChainValid = true;
  
  // Verify each block
  for (let i = 0; i < blocks.length; i++) {
    const currentBlock = blocks[i];
    
    // Verify the block's own hash is correct
    const expectedHash = calculateHash(
      currentBlock.index,
      currentBlock.timestamp,
      currentBlock.data,
      currentBlock.previousHash
    );
    
    if (currentBlock.hash !== expectedHash) {
      console.log(`❌ Block ${currentBlock.index} has invalid hash!`);
      console.log(`   Expected: ${expectedHash}`);
      console.log(`   Actual:   ${currentBlock.hash}`);
      isChainValid = false;
      continue;
    }
    
    // For blocks after the first, verify the previousHash matches the previous block's hash
    if (i > 0) {
      const previousBlock = blocks[i - 1];
      
      if (currentBlock.previousHash !== previousBlock.hash) {
        console.log(`❌ Block ${currentBlock.index} has invalid previousHash!`);
        console.log(`   Expected: ${previousBlock.hash}`);
        console.log(`   Actual:   ${currentBlock.previousHash}`);
        isChainValid = false;
        continue;
      }
      
      console.log(`🔗 Link [Block ${i-1} <-> Block ${i}] is SECURE`);
    } else {
      console.log(`🔗 Block ${currentBlock.index} is GENESIS block`);
    }
  }
  
  if (isChainValid) {
    console.log('\n✅ CHAIN INTEGRITY VERIFIED: All blocks are linked correctly!');
  } else {
    console.log('\n❌ CHAIN INTEGRITY COMPROMISED: Issues detected in the blockchain!');
  }
}

// Run the audit
auditLedger();