// contracts/rules.js - Validation logic for the ICRC medical tracking system
const { verifySignature } = require('../identity/crypto-util');

/**
 * Validates a MedicalKit object according to humanitarian standards
 * @param {Object} kit - The MedicalKit object to validate
 * @param {string} publicKey - The public key to verify the kit's signature
 * @returns {Object} An object with isValid boolean and array of error messages
 */
function validateMedicalKit(kit, publicKey) {
  const errors = [];
  
  // Check if temperature is within safe bounds (2°C to 8°C)
  if (kit.temperature < 2 || kit.temperature > 8) {
    errors.push(`Temperature out of safe range (2-8°C): ${kit.temperature}°C`);
  }
  
  // Verify the kit has a valid cryptographic signature
  if (!kit.signature) {
    errors.push('Missing digital signature');
  } else if (publicKey && !verifySignature(
    `${kit.kitID}${kit.type}${kit.origin}${kit.temperature}${kit.location}${kit.timestamp}`,
    kit.signature,
    publicKey
  )) {
    errors.push('Invalid cryptographic signature');
  }
  
  // Additional validations could be added here
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

module.exports = {
  validateMedicalKit
};