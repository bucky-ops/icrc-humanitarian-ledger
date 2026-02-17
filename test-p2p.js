// test-p2p.js - Test script for P2P functionality
const axios = require('axios');

async function testP2PFunctionality() {
  console.log('🧪 Testing P2P functionality...\n');
  
  const baseUrl = 'http://localhost:3000';
  
  try {
    // Test health endpoint
    console.log('✅ Testing health endpoint...');
    const healthResponse = await axios.get(`${baseUrl}/health`);
    console.log('Health check:', healthResponse.data.status);
    
    // Test empty ledger
    console.log('\n✅ Testing ledger endpoint...');
    const ledgerResponse = await axios.get(`${baseUrl}/ledger`);
    console.log('Ledger block count:', ledgerResponse.data.blockCount);
    
    // Test registering a peer (using a mock URL since we don't have another node running)
    console.log('\n✅ Testing register-node endpoint...');
    const registerResponse = await axios.post(`${baseUrl}/register-node`, {
      nodeUrl: 'http://localhost:3001'
    });
    console.log('Peer registration result:', registerResponse.data.success);
    console.log('Total peers after registration:', registerResponse.data.totalPeers);
    
    // Test sync endpoint
    console.log('\n✅ Testing sync endpoint...');
    const syncResponse = await axios.get(`${baseUrl}/sync`);
    console.log('Sync chain length:', syncResponse.data.chainLength);
    
    // Add a test kit to trigger block creation and broadcasting
    console.log('\n✅ Testing add-kit endpoint (triggers block broadcast)...');
    
    // Generate random kit data
    const kitTypes = ['Emergency Medical Kit', 'Surgical Kit', 'Trauma Kit', 'Pediatric Kit', 'Maternal Health Kit'];
    const origins = ['ICRC Geneva', 'WHO Headquarters', 'UNICEF Supply Division', 'MSF Logistics Base', 'Red Cross Center'];
    const locations = ['Geneva Warehouse', 'Nairobi Depot', 'Lagos Distribution Center', 'Cairo Hub', 'Amman Facility'];
    
    const kitData = {
      kitID: `KIT-${Math.floor(Math.random() * 10000)}-${Date.now()}`,
      type: kitTypes[Math.floor(Math.random() * kitTypes.length)],
      origin: origins[Math.floor(Math.random() * origins.length)],
      temperature: Math.floor(Math.random() * 7) + 2, // Random temp between 2-8°C
      location: locations[Math.floor(Math.random() * locations.length)]
    };
    
    const addKitResponse = await axios.post(`${baseUrl}/add-kit`, kitData);
    console.log('Kit addition result:', addKitResponse.data.success);
    console.log('Added kit ID:', addKitResponse.data.kit.kitID);
    
    // Check ledger again after adding kit
    console.log('\n✅ Testing ledger after adding kit...');
    const ledgerAfterResponse = await axios.get(`${baseUrl}/ledger`);
    console.log('Ledger block count after adding kit:', ledgerAfterResponse.data.blockCount);
    
    // Test audit
    console.log('\n✅ Testing audit endpoint...');
    const auditResponse = await axios.get(`${baseUrl}/audit`);
    console.log('Audit status:', auditResponse.data.status);
    console.log('Audit block count:', auditResponse.data.blockCount);
    
    console.log('\n🎉 All P2P functionality tests completed successfully!');
  } catch (error) {
    console.error('❌ Error during testing:', error.response?.data || error.message);
  }
}

// Run the test
testP2PFunctionality();