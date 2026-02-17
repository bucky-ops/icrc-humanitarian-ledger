// server.js - API Gateway for the ICRC Blockchain (Phase 3 & 6)
const express = require('express');
const fs = require('fs');
const path = require('path');
const Blockchain = require('./contracts/ledger');
const { MedicalKit } = require('./contracts/asset');
const { validateMedicalKit } = require('./contracts/rules');
const { generateKeyPair, signData } = require('./identity/crypto-util');
const { PredictionMarket } = require('./contracts/market');
const { ShareManager } = require('./contracts/shares');
const crypto = require('crypto');

const app = express();
const PORT = 3000;

// Middleware to parse JSON bodies
app.use(express.json());

// Serve static files from the 'public' folder
app.use(express.static('public'));

// Initialize the blockchain
const blockchain = new Blockchain();

// Initialize prediction markets and share manager
const markets = new Map(); // Store active markets
const shareManager = new ShareManager();

// Load ICRC HQ keys (in a real system, these would be loaded securely)
let hqPrivateKey, hqPublicKey;

// Try to load existing HQ keys, or generate new ones if they don't exist
const hqKeyDir = path.join(__dirname, 'identity', 'icrc-hq');
if (fs.existsSync(hqKeyDir)) {
  const privateKeyPath = path.join(hqKeyDir, 'private-key.txt');
  const publicKeyPath = path.join(hqKeyDir, 'public-key.txt');
  
  if (fs.existsSync(privateKeyPath) && fs.existsSync(publicKeyPath)) {
    hqPrivateKey = fs.readFileSync(privateKeyPath, 'utf8');
    hqPublicKey = fs.readFileSync(publicKeyPath, 'utf8');
  }
}

// If no keys exist, generate new ones (for demo purposes only)
if (!hqPrivateKey || !hqPublicKey) {
  console.log('Generating new ICRC HQ keys for demo purposes...');
  const keys = generateKeyPair();
  hqPrivateKey = keys.privateKey;
  hqPublicKey = keys.publicKey;
  
  // Ensure the directory exists
  if (!fs.existsSync(hqKeyDir)) {
    fs.mkdirSync(hqKeyDir, { recursive: true });
  }
  
  // Save the keys
  fs.writeFileSync(path.join(hqKeyDir, 'private-key.txt'), hqPrivateKey, 'utf8');
  fs.writeFileSync(path.join(hqKeyDir, 'public-key.txt'), hqPublicKey, 'utf8');
}

// GET /health: A simple check to see if the API is running
app.get('/health', (req, res) => {
  try {
    res.status(200).json({
      status: 'OK',
      message: 'ICRC Blockchain API Gateway is running',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      message: error.message
    });
  }
});

// GET /ledger: Returns the entire chain of JSON blocks from the /ledger-data folder
app.get('/ledger', (req, res) => {
  try {
    const ledgerPath = path.join(__dirname, 'ledger-data');
    const files = fs.readdirSync(ledgerPath);
    
    // Filter for block files and sort them by index
    const blockFiles = files
      .filter(file => file.startsWith('block_') && file.endsWith('.json'))
      .sort((a, b) => {
        const indexA = parseInt(a.match(/block_(\d+)\.json/)[1]);
        const indexB = parseInt(b.match(/block_(\d+)\.json/)[1]);
        return indexA - indexB;
      });
    
    const blocks = blockFiles.map(fileName => {
      const filePath = path.join(ledgerPath, fileName);
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    });
    
    res.status(200).json({
      success: true,
      blockCount: blocks.length,
      blocks
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// GET /ledger/:id: Returns the history of one specific kitID (filtering through all blocks)
app.get('/ledger/:kitId', (req, res) => {
  try {
    const requestedKitId = req.params.kitId;
    const ledgerPath = path.join(__dirname, 'ledger-data');
    const files = fs.readdirSync(ledgerPath);
    
    // Filter for block files and sort them by index
    const blockFiles = files
      .filter(file => file.startsWith('block_') && file.endsWith('.json'))
      .sort((a, b) => {
        const indexA = parseInt(a.match(/block_(\d+)\.json/)[1]);
        const indexB = parseInt(b.match(/block_(\d+)\.json/)[1]);
        return indexA - indexB;
      });
    
    const kitHistory = [];
    
    blockFiles.forEach(fileName => {
      const filePath = path.join(ledgerPath, fileName);
      const block = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      
      // Check if the block contains a MedicalKit with the requested kitId
      if (block.data && block.data.kitID === requestedKitId) {
        kitHistory.push(block);
      }
    });
    
    if (kitHistory.length === 0) {
      return res.status(404).json({
        success: false,
        message: `No records found for kit ID: ${requestedKitId}`
      });
    }
    
    res.status(200).json({
      success: true,
      kitId: requestedKitId,
      recordCount: kitHistory.length,
      history: kitHistory
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// POST /add-kit: Receives kit data via JSON, validates it, signs it, and adds it to the blockchain
app.post('/add-kit', (req, res) => {
  try {
    const { kitID, type, origin, temperature, location } = req.body;
    
    // Validate required fields
    if (!kitID || !type || !origin || typeof temperature === 'undefined' || !location) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: kitID, type, origin, temperature, location'
      });
    }
    
    // Create a new MedicalKit instance
    const newKit = new MedicalKit(kitID, type, origin, temperature, location, hqPrivateKey);
    
    // Validate the kit using the validation rules
    const validation = validateMedicalKit(newKit.toObject(), hqPublicKey);
    
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Kit validation failed',
        errors: validation.errors
      });
    }
    
    // Add the validated kit to the blockchain
    blockchain.addBlock(newKit.toObject());
    
    res.status(201).json({
      success: true,
      message: 'Medical kit successfully added to blockchain',
      kit: newKit.toObject()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// GET /audit: Runs the audit logic and returns a JSON report
app.get('/audit', (req, res) => {
  try {
    const ledgerPath = path.join(__dirname, 'ledger-data');
    const files = fs.readdirSync(ledgerPath);
    
    // Filter for block files and sort them by index
    const blockFiles = files
      .filter(file => file.startsWith('block_') && file.endsWith('.json'))
      .sort((a, b) => {
        const indexA = parseInt(a.match(/block_(\d+)\.json/)[1]);
        const indexB = parseInt(b.match(/block_(\d+)\.json/)[1]);
        return indexA - indexB;
      });
    
    if (blockFiles.length === 0) {
      return res.status(200).json({
        status: 'Empty',
        blockCount: 0
      });
    }
    
    // Load all blocks
    const blocks = blockFiles.map(fileName => {
      const filePath = path.join(ledgerPath, fileName);
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    });
    
    // Verify each block
    for (let i = 0; i < blocks.length; i++) {
      const currentBlock = blocks[i];
      
      // Verify the block's own hash is correct
      const expectedHash = crypto.createHash('sha256')
        .update(currentBlock.index + currentBlock.timestamp + JSON.stringify(currentBlock.data) + currentBlock.previousHash)
        .digest('hex');
      
      if (currentBlock.hash !== expectedHash) {
        return res.status(200).json({
          status: 'Tampered',
          atBlock: currentBlock.index,
          message: 'Block hash does not match expected value'
        });
      }
      
      // For blocks after the first, verify the previousHash matches the previous block's hash
      if (i > 0) {
        const previousBlock = blocks[i - 1];
        
        if (currentBlock.previousHash !== previousBlock.hash) {
          return res.status(200).json({
            status: 'Tampered',
            atBlock: currentBlock.index,
            message: 'Previous hash does not match previous block\'s hash'
          });
        }
      }
    }
    
    res.status(200).json({
      status: 'Secure',
      blockCount: blocks.length
    });
  } catch (error) {
    res.status(500).json({
      status: 'Error',
      message: error.message
    });
  }
});

// ============================================
// PREDICTION MARKET ENDPOINTS (Phase 6)
// ============================================

// GET /api/markets - Get all prediction markets
app.get('/api/markets', (req, res) => {
  try {
    const allMarkets = Array.from(markets.values()).map(m => m.toJSON());
    res.status(200).json({
      success: true,
      count: allMarkets.length,
      markets: allMarkets
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// GET /api/markets/:id - Get specific market
app.get('/api/markets/:id', (req, res) => {
  try {
    const market = markets.get(req.params.id);
    if (!market) {
      return res.status(404).json({
        success: false,
        message: 'Market not found'
      });
    }
    res.status(200).json({
      success: true,
      market: market.toJSON()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// POST /api/markets - Create a new prediction market (Admin only)
app.post('/api/markets', (req, res) => {
  try {
    const { marketID, question, kitID, deadline, createdBy } = req.body;
    
    if (!marketID || !question || !kitID || !deadline) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: marketID, question, kitID, deadline'
      });
    }
    
    // Check if market already exists
    if (markets.has(marketID)) {
      return res.status(400).json({
        success: false,
        message: 'Market ID already exists'
      });
    }
    
    // Create new market
    const market = new PredictionMarket(marketID, question, kitID, deadline, createdBy || 'admin');
    markets.set(marketID, market);
    
    // Initialize user if needed
    shareManager.initializeUser(createdBy || 'admin');
    
    console.log(`📊 Prediction Market Created: ${marketID} - ${question}`);
    
    res.status(201).json({
      success: true,
      message: 'Prediction market created successfully',
      market: market.toJSON()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// POST /api/markets/:id/buy - Buy shares in a market
app.post('/api/markets/:id/buy', (req, res) => {
  try {
    const { userId, outcome, amount } = req.body;
    const market = markets.get(req.params.id);
    
    if (!market) {
      return res.status(404).json({
        success: false,
        message: 'Market not found'
      });
    }
    
    if (!userId || !outcome || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: userId, outcome, amount'
      });
    }
    
    // Initialize user if needed
    shareManager.initializeUser(userId);
    
    // Buy shares
    const transaction = shareManager.buyShares(userId, market, outcome, amount);
    
    res.status(200).json({
      success: true,
      message: `Bought ${amount} ${outcome} shares`,
      transaction,
      balance: shareManager.getBalance(userId)
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// POST /api/markets/:id/sell - Sell shares from a market
app.post('/api/markets/:id/sell', (req, res) => {
  try {
    const { userId, outcome, amount } = req.body;
    const market = markets.get(req.params.id);
    
    if (!market) {
      return res.status(404).json({
        success: false,
        message: 'Market not found'
      });
    }
    
    if (!userId || !outcome || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: userId, outcome, amount'
      });
    }
    
    // Sell shares
    const transaction = shareManager.sellShares(userId, market, outcome, amount);
    
    res.status(200).json({
      success: true,
      message: `Sold ${amount} ${outcome} shares`,
      transaction,
      balance: shareManager.getBalance(userId)
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// GET /api/leaderboard - Get top forecasters
app.get('/api/leaderboard', (req, res) => {
  try {
    const leaderboard = shareManager.getLeaderboard();
    res.status(200).json({
      success: true,
      leaderboard
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// GET /api/user/:id/positions - Get user's positions
app.get('/api/user/:id/positions', (req, res) => {
  try {
    const positions = shareManager.getUserPositions(req.params.id);
    res.status(200).json({
      success: true,
      positions
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// POST /api/markets/:id/resolve - Resolve a market (automated or admin)
app.post('/api/markets/:id/resolve', (req, res) => {
  try {
    const market = markets.get(req.params.id);
    
    if (!market) {
      return res.status(404).json({
        success: false,
        message: 'Market not found'
      });
    }
    
    const { outcome } = req.body; // 'YES' or 'NO'
    
    if (!outcome || !['YES', 'NO'].includes(outcome)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid outcome. Must be YES or NO'
      });
    }
    
    // Resolve market
    market.resolve(outcome);
    
    // Update all user positions
    for (const userId of Object.keys(shareManager.userBalances)) {
      shareManager.resolvePosition(userId, market);
    }
    
    console.log(`✅ Market ${market.marketID} resolved as ${outcome}`);
    
    res.status(200).json({
      success: true,
      message: `Market resolved as ${outcome}`,
      market: market.toJSON()
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// Handle 404 for undefined routes
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`🚀 ICRC Blockchain API Gateway running on http://localhost:${PORT}`);
  console.log(`📋 Available endpoints:`);
  console.log(`   GET  /health           - Health check`);
  console.log(`   GET  /ledger           - View entire ledger`);
  console.log(`   GET  /ledger/:id       - View history of specific kit`);
  console.log(`   POST /add-kit          - Add new medical kit`);
  console.log(`   GET  /audit            - Audit blockchain integrity`);
  console.log(`\n📊 Prediction Market Endpoints (Phase 6):`);
  console.log(`   GET  /api/markets      - Get all prediction markets`);
  console.log(`   GET  /api/markets/:id  - Get specific market`);
  console.log(`   POST /api/markets      - Create new market (Admin)`);
  console.log(`   POST /api/markets/:id/buy  - Buy shares`);
  console.log(`   POST /api/markets/:id/sell - Sell shares`);
  console.log(`   GET  /api/leaderboard  - Get top forecasters`);
  console.log(`   POST /api/markets/:id/resolve - Resolve market`);
});