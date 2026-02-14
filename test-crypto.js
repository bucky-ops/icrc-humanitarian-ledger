const cryptoUtil = require('./identity/crypto-util'); // Path to your utility file

// 1. Generate Keys
const keys = cryptoUtil.generateKeyPair();
console.log("✅ Private Key Generated:", keys.privateKey.substring(0, 10) + "...");
console.log("✅ Public Key Generated:", keys.publicKey.substring(0, 10) + "...");

// 2. Create a test message (A fake shipment)
const shipment = "Medical Kit #101 - Sent to Nairobi";

// 3. Sign the message
const signature = cryptoUtil.signData(shipment, keys.privateKey);
console.log("✅ Signature Created:", signature.substring(0, 10) + "...");

// 4. Verify the message
const isValid = cryptoUtil.verifySignature(shipment, signature, keys.publicKey);

if (isValid) {
    console.log("⭐⭐⭐ TEST PASSED: Signature is Valid!");
} else {
    console.error("❌ TEST FAILED: Signature is Invalid!");
}