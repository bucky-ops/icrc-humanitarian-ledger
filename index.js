// index.js - Genesis logic script to initialize the environment
require('dotenv').config(); // Load environment variables from .env file
const fs = require('fs');
const path = require('path');
const { generateKeyPair, signData } = require('./identity/crypto-util');
const { MedicalKit } = require('./contracts/asset');
const crypto = require('crypto');

console.log('Initializing ICRC Humanitarian Supply Chain Tracking System...\n');

// Step 1: Generate a key pair for 'icrc-hq'
console.log('Step 1: Generating key pair for ICRC Headquarters...');
const icrcHqKeys = generateKeyPair();
console.log('ICRC HQ Public Key:', icrcHqKeys.publicKey.substring(0, 20) + '...'); // Show first 20 chars
console.log('ICRC HQ Private Key (truncated):', icrcHqKeys.privateKey.substring(0, 20) + '...\n');

// Save the ICRC HQ keys to the identity directory
const icrcHqDir = path.join(__dirname, 'identity', 'icrc-hq');
const privateKeyPath = path.join(icrcHqDir, 'private-key.txt');
const publicKeyPath = path.join(icrcHqDir, 'public-key.txt');

fs.writeFileSync(privateKeyPath, icrcHqKeys.privateKey, 'utf8');
fs.writeFileSync(publicKeyPath, icrcHqKeys.publicKey, 'utf8');

console.log('Keys saved to identity/icrc-hq/\n');

// Step 2: Create a test MedicalKit object
console.log('Step 2: Creating a test MedicalKit object...');
const testMedicalKit = new MedicalKit(
  'KIT-001',           // kitID
  'Emergency',         // type
  'Geneva, Switzerland', // origin
  4,                   // temperature (in Celsius)
  'Geneva Warehouse',  // location
  icrcHqKeys.privateKey // private key for signing
);

console.log('Test MedicalKit created:', JSON.stringify(testMedicalKit.toObject(), null, 2));

// Step 3: Hash the test MedicalKit object into a 'Block 0' format
console.log('\nStep 3: Creating Genesis Block (Block 0)...');

// Convert the MedicalKit to a string representation for hashing
const medicalKitString = JSON.stringify(testMedicalKit.toObject());

// Create a hash of the MedicalKit data
const genesisHash = crypto.createHash('sha256').update(medicalKitString).digest('hex');

// Create the Genesis Block
const genesisBlock = {
  index: 0,
  timestamp: new Date().toISOString(),
  data: testMedicalKit.toObject(),
  previousHash: '0000000000000000000000000000000000000000000000000000000000000000', // Initial previous hash
  hash: genesisHash,
  validator: 'ICRC-HQ'
};

console.log('Genesis Block created:', JSON.stringify(genesisBlock, null, 2));

// Save the Genesis Block to ledger-data
const ledgerDataPath = path.join(__dirname, 'ledger-data', 'genesis-block.json');
fs.writeFileSync(ledgerDataPath, JSON.stringify(genesisBlock, null, 2), 'utf8');

console.log('\nGenesis Block saved to ledger-data/genesis-block.json');

// Step 4: Verify the signature of the MedicalKit
console.log('\nStep 4: Verifying MedicalKit signature...');
const isValid = testMedicalKit.verifySignature(icrcHqKeys.publicKey);
console.log('Signature verification result:', isValid ? 'VALID' : 'INVALID');

console.log('\nInitialization complete!');
console.log('System is ready for humanitarian supply chain tracking.');