// asset.js - Asset model for MedicalKit
const { signData } = require('../identity/crypto-util');

class MedicalKit {
  /**
   * Creates a new MedicalKit instance
   * @param {string} kitID - Unique identifier for the medical kit
   * @param {string} type - Type of medical kit (e.g., 'Emergency', 'Surgical', 'Medication')
   * @param {string} origin - Origin location of the medical kit
   * @param {number} temperature - Current temperature of the medical kit
   * @param {string} location - Current location of the medical kit
   * @param {Date} timestamp - Timestamp of when the record was created
   * @param {string} privateKey - Private key to sign the medical kit data
   */
  constructor(kitID, type, origin, temperature, location, privateKey) {
    this.kitID = kitID;
    this.type = type;
    this.origin = origin;
    this.temperature = temperature;
    this.location = location;
    this.timestamp = new Date().toISOString();
    
    // Sign the medical kit data with the provided private key
    const dataToSign = `${this.kitID}${this.type}${this.origin}${this.temperature}${this.location}${this.timestamp}`;
    this.signature = signData(dataToSign, privateKey);
  }

  /**
   * Converts the MedicalKit instance to a plain object
   * @returns {Object} Plain object representation of the MedicalKit
   */
  toObject() {
    return {
      kitID: this.kitID,
      type: this.type,
      origin: this.origin,
      temperature: this.temperature,
      location: this.location,
      timestamp: this.timestamp,
      signature: this.signature
    };
  }

  /**
   * Validates the signature of the medical kit
   * @param {string} publicKey - Public key to verify the signature
   * @returns {boolean} True if the signature is valid, false otherwise
   */
  verifySignature(publicKey) {
    const { verifySignature: verifySig } = require('../identity/crypto-util');
    const dataToVerify = `${this.kitID}${this.type}${this.origin}${this.temperature}${this.location}${this.timestamp}`;
    return verifySig(dataToVerify, this.signature, publicKey);
  }
}

// THIS IS THE MISSING LINE:
module.exports = MedicalKit;
;

