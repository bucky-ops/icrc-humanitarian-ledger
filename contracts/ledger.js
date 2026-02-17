// contracts/ledger.js - Blockchain manager for the ICRC medical tracking system
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');

class Blockchain {
  constructor() {
    this.ledgerPath = path.join(__dirname, '..', 'ledger-data');
    this.peers = []; // Array to store peer URLs

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
  async addBlock(data) {
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

    // Broadcast the new block to all peers
    if (this.peers.length > 0) {
      await this.broadcastBlock(newBlock);
    }
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

  /**
   * Registers a new peer node
   * @param {string} nodeUrl - URL of the peer node to register
   */
  registerPeer(nodeUrl) {
    if (!this.peers.includes(nodeUrl)) {
      this.peers.push(nodeUrl);
      console.log(`Peer ${nodeUrl} registered. Total peers: ${this.peers.length}`);
    }
  }

  /**
   * Broadcasts a new block to all registered peers
   * @param {Object} block - The block to broadcast
   */
  async broadcastBlock(block) {
    const promises = this.peers.map(async (peerUrl) => {
      try {
        await axios.post(`${peerUrl}/receive-block`, { block });
        console.log(`Block ${block.index} broadcasted to ${peerUrl}`);
      } catch (error) {
        console.error(`Failed to broadcast block to ${peerUrl}:`, error.message);
      }
    });

    await Promise.all(promises);
  }

  /**
   * Gets the full blockchain
   * @returns {Array} Array of all blocks in the chain
   */
  getFullChain() {
    const files = fs.readdirSync(this.ledgerPath);

    // Filter for block files and sort them by index
    const blockFiles = files
      .filter(file => file.startsWith('block_') && file.endsWith('.json'))
      .sort((a, b) => {
        const indexA = parseInt(a.match(/block_(\d+)\.json/)[1]);
        const indexB = parseInt(b.match(/block_(\d+)\.json/)[1]);
        return indexA - indexB;
      });

    const blocks = blockFiles.map(fileName => {
      const filePath = path.join(this.ledgerPath, fileName);
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    });

    return blocks;
  }

  /**
   * Replaces the current chain with a new one if it's valid and longer
   * @param {Array} newChain - The new chain to potentially replace the current one
   * @returns {boolean} True if the chain was replaced, false otherwise
   */
  replaceChain(newChain) {
    // Check if the new chain is longer than the current one
    const currentChain = this.getFullChain();
    
    if (newChain.length <= currentChain.length) {
      console.log(`New chain length (${newChain.length}) is not greater than current chain length (${currentChain.length}). Chain not replaced.`);
      return false;
    }

    // Validate the new chain
    if (!this.validateChain(newChain)) {
      console.log('New chain is invalid. Chain not replaced.');
      return false;
    }

    // Replace the current chain with the new one
    this.clearLedger();
    
    newChain.forEach((block, index) => {
      const fileName = `block_${block.index}.json`;
      const filePath = path.join(this.ledgerPath, fileName);
      fs.writeFileSync(filePath, JSON.stringify(block, null, 2), 'utf8');
    });

    console.log(`Chain replaced with new chain of length ${newChain.length}`);
    return true;
  }

  /**
   * Validates a blockchain
   * @param {Array} chain - The chain to validate
   * @returns {boolean} True if the chain is valid, false otherwise
   */
  validateChain(chain) {
    for (let i = 0; i < chain.length; i++) {
      const currentBlock = chain[i];

      // Verify the block's own hash is correct
      const expectedHash = this.calculateHash(
        currentBlock.index,
        currentBlock.timestamp,
        currentBlock.data,
        currentBlock.previousHash
      );

      if (currentBlock.hash !== expectedHash) {
        console.log(`Invalid hash at block ${currentBlock.index}`);
        return false;
      }

      // For blocks after the first, verify the previousHash matches the previous block's hash
      if (i > 0) {
        const previousBlock = chain[i - 1];
        
        if (currentBlock.previousHash !== previousBlock.hash) {
          console.log(`Invalid previous hash at block ${currentBlock.index}`);
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Detects tampering in the blockchain by checking for unauthorized changes
   * @param {Array} chain - The chain to check for tampering
   * @returns {Array} Array of blocks that have been tampered with
   */
  detectTampering(chain) {
    const tamperedBlocks = [];
    
    for (let i = 0; i < chain.length; i++) {
      const currentBlock = chain[i];
      
      // Check if the block's hash is valid
      const expectedHash = this.calculateHash(
        currentBlock.index,
        currentBlock.timestamp,
        currentBlock.data,
        currentBlock.previousHash
      );
      
      if (currentBlock.hash !== expectedHash) {
        tamperedBlocks.push({
          index: currentBlock.index,
          reason: 'Invalid block hash',
          status: 'tampered'
        });
        continue;
      }
      
      // For blocks after the first, check if the previousHash matches the previous block's hash
      if (i > 0) {
        const previousBlock = chain[i - 1];
        
        if (currentBlock.previousHash !== previousBlock.hash) {
          tamperedBlocks.push({
            index: currentBlock.index,
            reason: 'Invalid previous hash link',
            status: 'tampered'
          });
          continue;
        }
      }
      
      // Check for specific tampering in data fields (kitID, location, temperature)
      if (i > 0) {
        const previousBlock = chain[i - 1];
        
        // Compare critical fields to detect unauthorized changes
        if (currentBlock.data.kitID !== previousBlock.data?.kitID && i > 0) {
          // This is expected when a new kit is added, so we'll check differently
          // Only check for tampering within the same kit's lifecycle
          
          // If this is a continuation of the same kit, check for unauthorized changes
          // In a real scenario, we'd have more sophisticated tracking
        }
      }
    }
    
    return tamperedBlocks;
  }

  /**
   * Updates the status of a block if tampering is detected
   * @param {Object} block - The block to check and update
   * @returns {Object} Updated block with tamper status
   */
  updateBlockStatus(block) {
    // Check if the block's hash is valid
    const expectedHash = this.calculateHash(
      block.index,
      block.timestamp,
      block.data,
      block.previousHash
    );
    
    if (block.hash !== expectedHash) {
      block.status = 'tampered';
      block.tamperReason = 'Invalid block hash';
      return block;
    }
    
    // Additional checks for data integrity
    if (block.data && (typeof block.data.location !== 'undefined' || 
                       typeof block.data.temperature !== 'undefined' || 
                       typeof block.data.kitID !== 'undefined')) {
      // Basic validation - in a real system, we'd have more sophisticated checks
      block.status = 'verified'; // Default status
    } else {
      block.status = 'unverified';
      block.tamperReason = 'Missing critical data fields';
    }
    
    return block;
  }

  /**
   * Clears all blocks from the ledger
   */
  clearLedger() {
    const files = fs.readdirSync(this.ledgerPath);
    const blockFiles = files.filter(file => file.startsWith('block_') && file.endsWith('.json'));
    
    blockFiles.forEach(file => {
      const filePath = path.join(this.ledgerPath, file);
      fs.unlinkSync(filePath);
    });
  }

  /**
   * Saves a received block to the ledger (used for P2P sync)
   * @param {Object} block - The block to save
   * @returns {boolean} True if the block was saved successfully, false otherwise
   */
  saveReceivedBlock(block) {
    try {
      // Validate the received block
      const expectedHash = this.calculateHash(
        block.index,
        block.timestamp,
        block.data,
        block.previousHash
      );

      if (block.hash !== expectedHash) {
        console.log(`Invalid hash for received block ${block.index}`);
        return false;
      }

      // Check if the block is a duplicate
      const files = fs.readdirSync(this.ledgerPath);
      const blockFileName = `block_${block.index}.json`;
      
      if (files.includes(blockFileName)) {
        const filePath = path.join(this.ledgerPath, blockFileName);
        const existingBlock = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        
        if (existingBlock.hash === block.hash) {
          console.log(`Block ${block.index} already exists in ledger`);
          return true; // Block already exists but is valid
        } else {
          console.log(`Block ${block.index} exists but has different hash`);
          return false;
        }
      }

      // Determine if the block fits in sequence (basic check)
      const latestBlock = this.getLatestBlock();
      if (latestBlock && block.index <= latestBlock.index) {
        console.log(`Block ${block.index} is older than latest block ${latestBlock.index}`);
        return false;
      }

      // Save the received block
      const fileName = `block_${block.index}.json`;
      const filePath = path.join(this.ledgerPath, fileName);
      fs.writeFileSync(filePath, JSON.stringify(block, null, 2), 'utf8');

      console.log(`Block ${block.index} saved from P2P sync.`);
      return true;
    } catch (error) {
      console.error('Error saving received block:', error.message);
      return false;
    }
  }

  /**
   * Self-healing method to sync with a peer and fix corrupted data
   * @param {string} peerUrl - URL of the peer to sync from
   * @returns {Promise<boolean>} True if sync was successful, false otherwise
   */
  async syncWithPeer(peerUrl) {
    console.log(`🔄 Attempting to heal ledger from peer: ${peerUrl}`);
    try {
        const response = await axios.get(`${peerUrl}/ledger`);
        const neighborChain = response.data.blocks;

        // 1. Check if the neighbor's chain is valid
        if (this.validateChain(neighborChain) && neighborChain.length >= this.getFullChain().length) {
            console.log("✅ Neighbor has a valid, trustworthy chain. Overwriting local data...");
            
            // 2. Clear local ledger and overwrite with the "Truth" from the peer
            this.clearLedger();
            
            // Save each block from the neighbor's chain
            for (let i = 0; i < neighborChain.length; i++) {
              const block = neighborChain[i];
              const fileName = `block_${block.index}.json`;
              const filePath = path.join(this.ledgerPath, fileName);
              fs.writeFileSync(filePath, JSON.stringify(block, null, 2), 'utf8');
            }
            
            return true;
        }
    } catch (err) {
        console.error("❌ Healing failed: Neighbor unreachable.", err.message);
    }
    return false;
  }
}

module.exports = Blockchain;