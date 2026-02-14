const axios = require('axios');

// Helper function to generate a random kit ID
function generateRandomKitID() {
    const prefixes = ['KIT', 'MED', 'SUP', 'REL'];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const randomNum = Math.floor(100 + Math.random() * 900); // Random 3-digit number
    return `${prefix}-${randomNum}`;
}

async function testNetworkAccess() {
    console.log("--- 🧪 Starting API Network Test ---");
    try {
        // 1. Test Health
        const health = await axios.get('http://localhost:3000/health');
        console.log("✅ Health Check:", health.data.status);

        // 2. Test Ledger Retrieval
        const ledger = await axios.get('http://localhost:3000/ledger');
        console.log(`✅ Ledger Access: Found ${ledger.data.blockCount} blocks.`);

        // 3. Test Adding a Kit
        console.log("📤 Sending new kit data to network...");
        
        // Arrays of possible values for randomization
        const types = ['Emergency', 'Surgical', 'Medication', 'Vaccine', 'Relief'];
        const origins = ['Geneva', 'New York', 'Brussels', 'Amsterdam', 'London', 'Paris', 'Berlin'];
        const locations = ['Nairobi Airport', 'Lagos Distribution Center', 'Kigali Warehouse', 'Cairo Hub', 'Beirut Station', 'Athens Port', 'Rome Terminal'];
        
        const newKit = {
            kitID: generateRandomKitID(), // Always generate a random kit ID
            type: types[Math.floor(Math.random() * types.length)], // Random type
            origin: origins[Math.floor(Math.random() * origins.length)], // Random origin
            temperature: Math.floor(2 + Math.random() * 7), // Random temp between 2-8
            location: locations[Math.floor(Math.random() * locations.length)] // Random location
        };
        const response = await axios.post('http://localhost:3000/add-kit', newKit);
        console.log("✅ API Response:", response.data.message);

    } catch (error) {
        console.error("❌ Test Failed:", error.response ? error.response.data : error.message);
    }
}

// THIS LINE IS CRUCIAL - IT ACTUALLY RUNS THE TEST:
testNetworkAccess();