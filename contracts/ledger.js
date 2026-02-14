// contracts/ledger.js - Blockchain manager for the ICRC medical tracking system
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class Blockchain {
  constructor() {
    this.ledgerPath = path.join(__dirname, '..', 'ledger-data');
    
    // Create ledger directory if it doesn't exist
    if (!fs.existsSync(this.ledgerPath)) {
      fs.mkdirSync(this.ledgerPath, { recursive: true });
    }
    
    // Check if chain already exists by looking for block files
    this.chainExists = this.checkChainExists();
  }

  /**
   * Checks if a blockchain already exists in the ledger-data folder
   * @returns {boolean} True if chain exists, false otherwise
   */
  checkChainExists() {
    const files = fs.readdirSync(this.ledgerPath);
    return files.some(file => file.startsWith('block_') && file.endsWith('.json'));
  }

  /**
   * Gets the latest block from the ledger-data folder
   * @returns {Object|null} The latest block object or null if no blocks exist
   */
  getLatestBlock() {
    const files = fs.readdirSync(this.ledgerPath);
    if (files.length === 0) {
      return null;
    }

    // Find the highest numbered block file
    let maxIndex = -1;
    let latestFile = null;

    files.forEach(file => {
      if (file.startsWith('block_') && file.endsWith('.json')) {
        const index = parseInt(file.match(/block_(\d+)\.json/)[1]);
        if (index > maxIndex) {
          maxIndex = index;
          latestFile = file;
        }
      }
    });

    if (latestFile) {
      const filePath = path.join(this.ledgerPath, latestFile);
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }

    return null;
  }

  /**
   * Adds a new block to the blockchain
   * @param {Object} data - The data to store in the block
   */
  addBlock(data) {
    const latestBlock = this.getLatestBlock();
    const index = latestBlock ? latestBlock.index + 1 : 0;
    
    // Calculate previous hash
    const previousHash = latestBlock ? latestBlock.hash : '0000000000000000000000000000000000000000000000000000000000000000';
    
    // Create the new block
    const newBlock = {
      index,
      timestamp: new Date().toISOString(),
      data,
      previousHash,
      hash: this.calculateHash(index, new Date().toISOString(), data, previousHash)
    };

    // Save the block as a JSON file
    const fileName = `block_${index}.json`;
    const filePath = path.join(this.ledgerPath, fileName);
    fs.writeFileSync(filePath, JSON.stringify(newBlock, null, 2), 'utf8');

    console.log(`Block ${index} added to ledger.`);
  }

  /**
   * Calculates the SHA-256 hash of a block
   * @param {number} index - Block index
   * @param {string} timestamp - Block timestamp
   * @param {Object} data - Block data
   * @param {string} previousHash - Previous block's hash
   * @returns {string} The calculated hash
   */
  calculateHash(index, timestamp, data, previousHash) {
    const dataString = JSON.stringify(data);
    return crypto.createHash('sha256')
      .update(index + timestamp + dataString + previousHash)
      .digest('hex');
  }
}

module.exports = Blockchain;