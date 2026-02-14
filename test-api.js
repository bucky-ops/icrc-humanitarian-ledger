const axios = require('axios');

async function testNetworkAccess() {
    console.log("--- 🧪 Starting API Network Test ---");
    try {
        // 1. Test Health
        const health = await axios.get('http://localhost:3000/health');
        console.log("✅ Health Check:", health.data.status);

        // 2. Test Ledger Retrieval
        const ledger = await axios.get('http://localhost:3000/ledger');
        console.log(`✅ Ledger Access: Found ${ledger.data.length} blocks.`);

        // 3. Test Adding a Kit
        console.log("📤 Sending new kit data to network...");
        const newKit = {
            kitID: "KIT-202",
            type: "Emergency",
            origin: "Geneva",
            temperature: 5,
            location: "Entebbe Airport"
        };
        const response = await axios.post('http://localhost:3000/add-kit', newKit);
        console.log("✅ API Response:", response.data.message);

    } catch (error) {
        console.error("❌ Test Failed:", error.response ? error.response.data : error.message);
    }
}

// THIS LINE IS CRUCIAL - IT ACTUALLY RUNS THE TEST:
testNetworkAccess();