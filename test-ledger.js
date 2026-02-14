const Blockchain = require('./contracts/ledger');
const { MedicalKit } = require('./contracts/asset');
const cryptoUtil = require('./identity/crypto-util');
const fs = require('fs');
const path = require('path');

// Setup: Generate a key for testing
const keys = cryptoUtil.generateKeyPair();
const ledger = new Blockchain();

function runPhase2Test() {
    console.log("--- Starting Phase 2: Ledger Integrity Test ---");

    try {
        // 1. Create a Genesis Block (First Kit)
        console.log("Step 1: Creating Genesis Block...");
        const kit1 = new MedicalKit("KIT-001", "Vaccine", "Geneva HQ", 4, "Warehouse", keys.privateKey);
        ledger.addBlock(kit1.toObject());

        // 2. Create a second block (The Link)
        console.log("Step 2: Adding a second block...");
        const kit2 = new MedicalKit("KIT-001", "Vaccine", "Geneva HQ", 5, "Nairobi Hub", keys.privateKey);
        ledger.addBlock(kit2.toObject());

        // 3. Verify files exist on your hard drive
        const allFiles = fs.readdirSync(path.join(__dirname, 'ledger-data'));
        // Filter only the new block files (not the old genesis-block.json)
        const blockFiles = allFiles.filter(f => f.startsWith('block_') && f.endsWith('.json'));
        console.log(`✅ Success! ${blockFiles.length} blocks found in /ledger-data/`);

        // 4. Test Chain Integrity
        console.log("Step 3: Checking Chain Integrity...");
        const blocks = blockFiles.map(f => JSON.parse(fs.readFileSync(path.join(__dirname, 'ledger-data', f))))
            .sort((a, b) => a.index - b.index); // Sort by index to ensure proper order
        
        for (let i = 1; i < blocks.length; i++) {
            const currentBlock = blocks[i];
            const previousBlock = blocks[i-1];

            if (currentBlock.previousHash === previousBlock.hash) {
                console.log(`🔗 Link [Block ${i-1} <-> Block ${i}] is SECURE`);
            } else {
                throw new Error(`🚨 Chain broken at block ${i}!`);
            }
        }

        console.log("⭐⭐⭐ PHASE 2 TEST PASSED: Ledger is Immutable!");

    } catch (error) {
        console.error("❌ Phase 2 Test Failed:", error.message);
    }
}

runPhase2Test();