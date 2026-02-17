// contracts/p2p.js - Peer-to-peer synchronization module for the ICRC Blockchain
const axios = require('axios');

class P2PServer {
  constructor(blockchain) {
    this.blockchain = blockchain;
  }

  /**
   * Registers a new peer node
   * @param {string} nodeUrl - URL of the peer node to register
   */
  registerPeer(nodeUrl) {
    this.blockchain.registerPeer(nodeUrl);
  }

  /**
   * Synchronizes the local chain with a peer's chain
   * @param {string} peerUrl - URL of the peer to sync from
   * @returns {Promise<boolean>} True if sync was successful, false otherwise
   */
  async syncWithPeer(peerUrl) {
    try {
      console.log(`Attempting to sync with peer: ${peerUrl}`);
      
      const response = await axios.get(`${peerUrl}/sync`);
      const peerChain = response.data.chain;

      if (!peerChain) {
        console.error('Peer did not return a valid chain');
        return false;
      }

      // Attempt to replace the local chain if the peer's chain is longer and valid
      const chainReplaced = this.blockchain.replaceChain(peerChain);
      
      if (chainReplaced) {
        console.log(`Successfully synced with peer ${peerUrl}. Local chain updated.`);
        return true;
      } else {
        console.log(`Local chain is equal or longer than peer's chain. No sync needed.`);
        return true;
      }
    } catch (error) {
      console.error(`Failed to sync with peer ${peerUrl}:`, error.message);
      return false;
    }
  }

  /**
   * Performs initial synchronization with known peers when the node starts up
   * @param {Array} knownPeers - Array of known peer URLs to sync from
   */
  async initializeSync(knownPeers) {
    console.log('Initializing P2P synchronization...');
    
    for (const peerUrl of knownPeers) {
      try {
        console.log(`Attempting to register and sync with known peer: ${peerUrl}`);
        
        // Register the peer
        this.registerPeer(peerUrl);
        
        // Sync with the peer
        const syncSuccess = await this.syncWithPeer(peerUrl);
        
        if (syncSuccess) {
          console.log(`Successfully initialized sync with peer: ${peerUrl}`);
          break; // Stop after first successful sync
        }
      } catch (error) {
        console.error(`Error initializing sync with peer ${peerUrl}:`, error.message);
      }
    }
    
    console.log('P2P synchronization initialization complete.');
  }
}

module.exports = P2PServer;