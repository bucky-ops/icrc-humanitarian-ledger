// config/default.js - Default configuration for the ICRC Supply Chain Tracking System
require('dotenv').config();

module.exports = {
  // Environment
  env: process.env.NODE_ENV || 'development',
  
  // Server
  port: parseInt(process.env.PORT) || 3000,
  
  // Paths
  ledgerPath: process.env.LEDGER_PATH || './ledger-data',
  identityPath: process.env.IDENTITY_PATH || './identity',
  
  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',
  
  // Cryptography
  ellipticCurve: 'secp256k1', // Elliptic curve for key generation
  
  // Genesis block settings
  genesisBlock: {
    index: 0,
    previousHash: '0000000000000000000000000000000000000000000000000000000000000000'
  }
};