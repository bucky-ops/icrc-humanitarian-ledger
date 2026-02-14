// crypto-util.js - Cryptographic utility module for generating keys, signing, and verifying signatures
const EC = require('elliptic').ec;
const crypto = require('crypto');

// Initialize the elliptic curve (secp256k1)
const ec = new EC('secp256k1');

/**
 * Generates an Elliptic Curve (secp256k1) private/public key pair
 * @returns {Object} Object containing privateKey and publicKey
 */
function generateKeyPair() {
  // Generate a new key pair
  const keyPair = ec.genKeyPair();
  
  // Extract the private and public keys
  const privateKey = keyPair.getPrivate('hex');
  const publicKey = keyPair.getPublic('hex');
  
  return {
    privateKey,
    publicKey
  };
}

/**
 * Signs a piece of data using the provided private key
 * @param {string|Buffer} data - The data to sign
 * @param {string} privateKeyHex - The private key in hexadecimal format
 * @returns {string} The signature in hexadecimal format
 */
function signData(data, privateKeyHex) {
  // Convert the private key hex to a key object
  const keyPair = ec.keyFromPrivate(privateKeyHex, 'hex');
  
  // Create a hash of the data
  const dataHash = crypto.createHash('sha256').update(data).digest('hex');
  
  // Sign the hash
  const signature = keyPair.sign(dataHash);
  
  // Return the signature in hex format
  return signature.toDER('hex');
}

/**
 * Verifies a signature against the original data and public key
 * @param {string|Buffer} data - The original data that was signed
 * @param {string} signatureHex - The signature in hexadecimal format
 * @param {string} publicKeyHex - The public key in hexadecimal format
 * @returns {boolean} True if the signature is valid, false otherwise
 */
function verifySignature(data, signatureHex, publicKeyHex) {
  try {
    // Convert the public key hex to a key object
    const key = ec.keyFromPublic(publicKeyHex, 'hex');
    
    // Create a hash of the data
    const dataHash = crypto.createHash('sha256').update(data).digest('hex');
    
    // Create a signature object from the hex string
    const signature = new Buffer.from(signatureHex, 'hex');
    
    // Verify the signature
    return key.verify(dataHash, signature);
  } catch (error) {
    console.error('Error verifying signature:', error.message);
    return false;
  }
}

module.exports = {
  generateKeyPair,
  signData,
  verifySignature
};