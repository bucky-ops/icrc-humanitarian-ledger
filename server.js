// server.js - API Gateway for the ICRC Blockchain (Phase 5 - P2P Synchronization)
const express = require('express');
const fs = require('fs');
const path = require('path');
const axios = require('axios'); // Added for P2P communication
const Blockchain = require('./contracts/ledger');
const P2PServer = require('./contracts/p2p');
const { MedicalKit } = require('./contracts/asset');
const { validateMedicalKit } = require('./contracts/rules');
const { generateKeyPair, signData } = require('./identity/crypto-util');
const crypto = require('crypto');
const { exec } = require('child_process'); // For opening browser tabs on Windows

// Import new services and middleware
const IntelligenceService = require('./services/intelligence-service');
const AuthService = require('./services/auth-service');
const LoggingService = require('./services/logging-service');
const {
  limiter,
  loginLimiter,
  corsOptions,
  authenticateToken,
  authorizeRoles,
  securityHeaders,
  cookieParser
} = require('./middleware/security');

const app = express();
const PORT = process.env.PORT || 3000;
let peers = []; // This stores the URLs of other nodes (e.g., http://localhost:3001)

// Initialize services
const intelligenceService = new IntelligenceService();
const authService = new AuthService();
const loggingService = new LoggingService();

// Create default admin user if it doesn't exist
const defaultAdmin = {
  email: 'admin@icrc.org',
  password: 'hq_secure_2026',
  role: 'admin',
  status: 'Approved'
};

// Check if default admin exists, if not create it
const allUsers = authService.getUsers();
const adminExists = allUsers.some(user => user.email === defaultAdmin.email);

if (!adminExists) {
  console.log('Creating default admin user...');
  authService.registerUser(defaultAdmin.email, defaultAdmin.password, defaultAdmin.role);
  
  // Update the status to Approved
  const users = authService.getUsers();
  const adminUser = users.find(user => user.email === defaultAdmin.email);
  if (adminUser) {
    adminUser.status = 'Approved';
    authService.saveUsers(users);
    console.log('Default admin user created and approved: admin@icrc.org / hq_secure_2026');
  }
}

// Middleware to parse JSON bodies
app.use(express.json());
app.use(cookieParser()); // Required to read the secure token from the browser

// Apply security headers
app.use(securityHeaders);

// Apply rate limiting to all requests
app.use(limiter);

// Serve static files from the 'public' folder
app.use(express.static('public'));

// Initialize the blockchain
const blockchain = new Blockchain();
const p2pServer = new P2PServer(blockchain);

// 1. SECURITY MIDDLEWARE: The "Gatekeeper"
const authGuard = (req, res, next) => {
    const token = req.cookies.token; // Look for the 'token' cookie
    const path = req.path;

    // A. ALLOW access to Login, Register, API endpoints, and Assets (CSS/JS)
    const publicPaths = ['/login', '/register', '/api/login', '/api/register', '/favicon.ico'];
    const apiPaths = ['/health', '/ledger', '/audit', '/tamper-check', '/register-node', 
                     '/sync', '/receive-block', '/nodes/register', '/blocks/receive',
                     '/profile', '/users', '/intelligence', '/admin', '/logout'];
    const isStaticAsset = path.startsWith('/css') || path.startsWith('/js') || 
                          path.startsWith('/images/') || path.startsWith('/public/') || 
                          path.includes('.png') || path.includes('.jpg') || 
                          path.includes('.svg') || path.includes('.ico') || 
                          path.includes('.css') || path.includes('.js');

    // Allow public paths and static assets
    if (publicPaths.includes(path) || isStaticAsset) {
        return next();
    }

    // B. CHECK if this is an API call (has /api/ or specific API paths)
    const isApiCall = apiPaths.some(apiPath => path.startsWith(apiPath));
    
    if (isApiCall) {
        // For API calls, return 401/403 instead of redirecting
        if (!token) {
            return res.status(401).json({ 
                success: false, 
                message: 'Access token required' 
            });
        }

        try {
            const verified = authService.verifyToken(token);
            if (!verified) {
                return res.status(403).json({ 
                    success: false, 
                    message: 'Invalid or expired token' 
                });
            }
            
            req.user = verified; // Attach user info (email, role) to the request

            // ADMIN PROTECTION: Only Admins can access certain admin endpoints
            if ((path.startsWith('/admin') || path.startsWith('/users')) && 
                verified.role !== 'admin' && 
                !path.startsWith('/admin/logs') && 
                !path.startsWith('/admin/pending-users')) {
                return res.status(403).json({ 
                    success: false, 
                    message: 'Insufficient permissions' 
                });
            }

            return next(); // User is verified, let them through!
        } catch (err) {
            return res.status(403).json({ 
                success: false, 
                message: 'Invalid or expired token' 
            });
        }
    }

    // C. FOR PAGES (non-API routes), redirect if not authenticated
    if (!token) {
        console.log(`🚫 Unauthorized access to ${path}. Redirecting to /login`);
        return res.redirect('/login');
    }

    // D. VERIFY the token (JWT) for page access
    try {
        const verified = authService.verifyToken(token);
        if (!verified) {
            res.clearCookie('token');
            return res.redirect('/login');
        }
        
        req.user = verified; // Attach user info (email, role) to the request

        // E. ADMIN PROTECTION: Only Admins can see /admin page
        if (path.startsWith('/admin') && verified.role !== 'admin') {
            return res.redirect('/'); 
        }

        next(); // User is verified, let them through!
    } catch (err) {
        res.clearCookie('token');
        return res.redirect('/login');
    }
};

// Apply the Gatekeeper to ALL routes (except public ones handled above)
app.use(authGuard);

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
    const blocks = blockchain.getFullChain();

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
app.post('/add-kit', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const { kitID, type, origin, temperature, location, flightNumber, destination } = req.body;

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

    // Fetch intelligence data for the shipment
    const shipmentData = {
      id: kitID,
      location: location,
      flightNumber: flightNumber,
      destination: destination
    };
    
    const intelligenceData = await intelligenceService.getIntelligenceForShipment(shipmentData);

    // Add intelligence data to kit
    const kitData = {
      ...newKit.toObject(),
      intelligence: intelligenceData
    };

    // Add the validated kit to the blockchain
    await blockchain.addBlock(kitData);

    // Get the latest block that was just added
    const newBlock = blockchain.getLatestBlock();
    console.log(`✅ Block ${newBlock.index} added locally.`);

    // THE GOSSIP: Broadcast to all registered peers
    peers.forEach(peer => {
      console.log(`📡 Gossiping block ${newBlock.index} to: ${peer}`);
      axios.post(`${peer}/blocks/receive`, newBlock)
          .catch(err => console.error(`❌ Failed to sync with ${peer}`, err.message));
    });

    res.status(201).json({
      success: true,
      message: 'Medical kit successfully added to blockchain and broadcasted to network',
      kit: kitData,
      block: newBlock
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// GET /audit: Runs the audit logic and returns a JSON report
app.get('/audit', authenticateToken, (req, res) => {
  try {
    const blocks = blockchain.getFullChain();

    if (blocks.length === 0) {
      return res.status(200).json({
        status: 'Empty',
        blockCount: 0
      });
    }

    // Check for tampering in the chain
    const tamperedBlocks = blockchain.detectTampering(blocks);

    if (tamperedBlocks.length > 0) {
      return res.status(200).json({
        status: 'Tampered',
        tamperedBlockCount: tamperedBlocks.length,
        tamperedBlocks,
        blockCount: blocks.length,
        message: `${tamperedBlocks.length} block(s) have been tampered with`
      });
    }

    // Verify each block
    for (let i = 0; i < blocks.length; i++) {
      const currentBlock = blocks[i];

      // Verify the block's own hash is correct
      const expectedHash = blockchain.calculateHash(
        currentBlock.index,
        currentBlock.timestamp,
        currentBlock.data,
        currentBlock.previousHash
      );

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

// POST /register-node: Register a new peer node
app.post('/register-node', (req, res) => {
  try {
    const { nodeUrl } = req.body;

    if (!nodeUrl) {
      return res.status(400).json({
        success: false,
        message: 'Missing required field: nodeUrl'
      });
    }

    // Register the peer
    blockchain.registerPeer(nodeUrl);

    res.status(200).json({
      success: true,
      message: `Node ${nodeUrl} registered successfully`,
      totalPeers: blockchain.peers.length,
      peers: blockchain.peers
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// GET /sync: Return the full blockchain
app.get('/sync', (req, res) => {
  try {
    const chain = blockchain.getFullChain();

    res.status(200).json({
      success: true,
      chainLength: chain.length,
      chain
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// POST /receive-block: Receive a block from a peer
app.post('/receive-block', (req, res) => {
  try {
    const { block } = req.body;

    if (!block) {
      return res.status(400).json({
        success: false,
        message: 'Missing required field: block'
      });
    }

    // Validate the received block
    const expectedHash = blockchain.calculateHash(
      block.index,
      block.timestamp,
      block.data,
      block.previousHash
    );

    if (block.hash !== expectedHash) {
      return res.status(400).json({
        success: false,
        message: 'Received block has invalid hash'
      });
    }

    // Check if the block is a duplicate
    const ledgerPath = path.join(__dirname, 'ledger-data');
    const files = fs.readdirSync(ledgerPath);
    const blockFileName = `block_${block.index}.json`;

    if (files.includes(blockFileName)) {
      const filePath = path.join(ledgerPath, blockFileName);
      const existingBlock = JSON.parse(fs.readFileSync(filePath, 'utf8'));

      if (existingBlock.hash === block.hash) {
        return res.status(200).json({
          success: true,
          message: 'Block already exists in ledger'
        });
      }
    }

    // Save the received block
    const fileName = `block_${block.index}.json`;
    const filePath = path.join(ledgerPath, fileName);
    fs.writeFileSync(filePath, JSON.stringify(block, null, 2), 'utf8');

    console.log(`Block ${block.index} received and added to ledger from peer.`);

    res.status(200).json({
      success: true,
      message: `Block ${block.index} received and added to ledger`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// 1. Endpoint to register a new neighbor
app.post('/nodes/register', (req, res) => {
    const { nodeUrl } = req.body;
    if (nodeUrl && !peers.includes(nodeUrl)) {
        peers.push(nodeUrl);
        console.log(`📡 New Peer Registered: ${nodeUrl}`);
        return res.json({ message: "Node registered successfully", totalPeers: peers.length });
    }
    res.status(400).json({ message: "Invalid node URL" });
});

// 2. Endpoint to receive a block from a neighbor
app.post('/blocks/receive', (req, res) => {
    const newBlock = req.body;
    console.log(`📦 Received broadcasted block: ${newBlock.index}`);

    // Update block status based on tamper detection
    const updatedBlock = blockchain.updateBlockStatus(newBlock);

    // Logic: Save this block to our local /ledger-data
    // You'll call your existing blockchain.addBlock logic here,
    // but skip the 'creation' part since it's already created.
    const success = blockchain.saveReceivedBlock(updatedBlock);

    if (success) {
        res.json({
          message: "Block synced successfully",
          status: updatedBlock.status || "verified"
        });
    } else {
        res.status(400).json({ message: "Block rejected (Invalid hash/sequence)" });
    }
});

// GET /tamper-check/:kitId: Check for tampering in a specific kit's history
app.get('/tamper-check/:kitId', authenticateToken, (req, res) => {
  try {
    const requestedKitId = req.params.kitId;
    const blocks = blockchain.getFullChain();

    // Filter blocks for the specific kit
    const kitBlocks = blocks.filter(block => block.data && block.data.kitID === requestedKitId);

    if (kitBlocks.length === 0) {
      return res.status(404).json({
        success: false,
        message: `No records found for kit ID: ${requestedKitId}`
      });
    }

    // Check each block for tampering
    const tamperResults = [];
    for (const block of kitBlocks) {
      const expectedHash = blockchain.calculateHash(
        block.index,
        block.timestamp,
        block.data,
        block.previousHash
      );

      const isHashValid = block.hash === expectedHash;
      const blockStatus = isHashValid ? 'verified' : 'tampered';

      tamperResults.push({
        index: block.index,
        timestamp: block.timestamp,
        status: blockStatus,
        hashValid: isHashValid,
        ...(blockStatus === 'tampered' && { tamperReason: 'Invalid block hash' })
      });
    }

    const tamperedCount = tamperResults.filter(result => result.status === 'tampered').length;
    const overallStatus = tamperedCount > 0 ? 'tampered' : 'secure';

    res.status(200).json({
      success: true,
      kitId: requestedKitId,
      overallStatus,
      tamperedCount,
      totalCount: kitBlocks.length,
      blocks: tamperResults
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// NEW: User Registration Endpoint
app.post('/register', loginLimiter, async (req, res) => {
  try {
    const { email, password, role } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    const result = await authService.registerUser(email, password, role || 'user');
    
    if (result.success) {
      res.status(201).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// NEW: User Login Endpoint
app.post('/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    const result = await authService.authenticateUser(email, password);
    
    if (result.success) {
      // Set the token as an HTTP-only cookie
      res.cookie('token', result.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production', // Set to true in production with HTTPS
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: 'strict'
      });
      
      res.status(200).json({
        success: true,
        message: result.message,
        user: result.user
      });
    } else {
      res.status(401).json(result);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// NEW: Logout Endpoint
app.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.status(200).json({
    success: true,
    message: 'Logged out successfully'
  });
});

// NEW: Get user profile (protected route)
app.get('/profile', authenticateToken, (req, res) => {
  try {
    const user = authService.getUserById(req.user.userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Return user data without sensitive information
    const { password, ...userData } = user;
    res.status(200).json({
      success: true,
      user: userData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// NEW: Get all users (admin only)
app.get('/users', authenticateToken, authorizeRoles('admin'), (req, res) => {
  try {
    const users = authService.getUsers();
    
    // Return users without passwords
    const usersWithoutPasswords = users.map(({ password, ...user }) => user);
    
    res.status(200).json({
      success: true,
      users: usersWithoutPasswords
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// NEW: Update user role (admin only)
app.put('/users/:userId/role', authenticateToken, authorizeRoles('admin'), (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;
    
    if (!role) {
      return res.status(400).json({
        success: false,
        message: 'Role is required'
      });
    }
    
    const result = authService.updateUserRole(userId, role, req.user.userId);
    
    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// NEW: Delete user (admin only)
app.delete('/users/:userId', authenticateToken, authorizeRoles('admin'), (req, res) => {
  try {
    const { userId } = req.params;
    
    const result = authService.deleteUser(userId, req.user.userId);
    
    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// NEW: Get intelligence data for a specific location
app.get('/intelligence/location/:location', authenticateToken, async (req, res) => {
  try {
    const { location } = req.params;
    
    const temperatureData = await intelligenceService.fetchTemperature(location);
    
    res.status(200).json({
      success: true,
      location,
      temperature: temperatureData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// NEW: Get intelligence data for a specific flight
app.get('/intelligence/flight/:flightNumber', authenticateToken, async (req, res) => {
  try {
    const { flightNumber } = req.params;
    
    const flightData = await intelligenceService.fetchFlightData(flightNumber);
    
    res.status(200).json({
      success: true,
      flightNumber,
      flightData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// NEW: Get humanitarian reports for a specific region
app.get('/intelligence/reports/:region', authenticateToken, async (req, res) => {
  try {
    const { region } = req.params;
    
    const reports = await intelligenceService.fetchReliefReports(region);
    
    res.status(200).json({
      success: true,
      region,
      reports
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// NEW: Get comprehensive intelligence for a shipment
app.get('/intelligence/shipment/:kitId', authenticateToken, async (req, res) => {
  try {
    const { kitId } = req.params;
    
    // Log the action
    loggingService.logEvent(req.user.userId, req.user.email, 'VIEW_SHIPMENT_INTELLIGENCE', `Kit ID: ${kitId}`);
    
    // Get the kit's history to extract location and other data
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

    let shipmentData = null;
    for (const fileName of blockFiles) {
      const filePath = path.join(ledgerPath, fileName);
      const block = JSON.parse(fs.readFileSync(filePath, 'utf8'));

      if (block.data && block.data.kitID === kitId) {
        shipmentData = {
          id: kitId,
          location: block.data.location,
          destination: block.data.destination || block.data.location, // fallback to location if no destination
          flightNumber: block.data.flightNumber || null
        };
        break; // Get the most recent location data
      }
    }

    if (!shipmentData) {
      return res.status(404).json({
        success: false,
        message: `No records found for kit ID: ${kitId}`
      });
    }

    // Get intelligence data for the shipment
    const intelligenceData = await intelligenceService.getIntelligenceForShipment(shipmentData);
    
    res.status(200).json({
      success: true,
      kitId,
      intelligence: intelligenceData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// NEW: Admin endpoint to get pending users
app.get('/admin/pending-users', authenticateToken, authorizeRoles('admin'), (req, res) => {
  try {
    const pendingUsers = authService.getPendingUsers(req.user.userId);
    
    // Return users without passwords
    const usersWithoutPasswords = pendingUsers.map(({ password, ...user }) => user);
    
    res.status(200).json({
      success: true,
      pendingUsers: usersWithoutPasswords
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// NEW: Admin endpoint to approve a user
app.post('/admin/approve-user', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const { userId, role } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }
    
    const result = authService.approveUser(userId, req.user.userId, role);
    
    if (result.success) {
      // Log the action
      loggingService.logEvent(req.user.userId, req.user.email, 'APPROVE_USER', `User ID: ${userId}, Role: ${role || 'unchanged'}`);
      res.status(200).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// NEW: Admin endpoint to set user status
app.post('/admin/set-user-status', authenticateToken, authorizeRoles('admin'), (req, res) => {
  try {
    const { userId, status } = req.body;
    
    if (!userId || !status) {
      return res.status(400).json({
        success: false,
        message: 'User ID and status are required'
      });
    }
    
    const result = authService.setUserStatus(userId, req.user.userId, status);
    
    if (result.success) {
      // Log the action
      loggingService.logEvent(req.user.userId, req.user.email, 'SET_USER_STATUS', `User ID: ${userId}, Status: ${status}`);
      res.status(200).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// NEW: Admin endpoint for rollback functionality
app.post('/admin/rollback-kit', authenticateToken, authorizeRoles('admin'), (req, res) => {
  try {
    const { kitID } = req.body;
    
    if (!kitID) {
      return res.status(400).json({
        success: false,
        message: 'Kit ID is required'
      });
    }
    
    // Find the kit's blocks in the ledger
    const ledgerPath = path.join(__dirname, 'ledger-data');
    const files = fs.readdirSync(ledgerPath);

    // Filter for block files and sort them by index (descending)
    const blockFiles = files
      .filter(file => file.startsWith('block_') && file.endsWith('.json'))
      .sort((a, b) => {
        const indexA = parseInt(a.match(/block_(\d+)\.json/)[1]);
        const indexB = parseInt(b.match(/block_(\d+)\.json/)[1]);
        return indexB - indexA; // Descending order
      });

    let blocksToDelete = [];
    for (const fileName of blockFiles) {
      const filePath = path.join(ledgerPath, fileName);
      const block = JSON.parse(fs.readFileSync(filePath, 'utf8'));

      if (block.data && block.data.kitID === kitID) {
        blocksToDelete.push({ fileName, block });
      }
    }

    if (blocksToDelete.length === 0) {
      return res.status(404).json({
        success: false,
        message: `No records found for kit ID: ${kitID}`
      });
    }

    // Delete the most recent block for this kit
    const blockToDelete = blocksToDelete[0];
    const blockFilePath = path.join(ledgerPath, blockToDelete.fileName);
    fs.unlinkSync(blockFilePath);

    console.log(`⚠️ ROLLBACK: Admin reverted Kit ${kitID}, deleted block ${blockToDelete.block.index}`);
    
    // Log the action
    loggingService.logEvent(req.user.userId, req.user.email, 'ROLLBACK_KIT', `Kit ID: ${kitID}, Block Index: ${blockToDelete.block.index}`);
    
    res.status(200).json({
      success: true,
      message: `Kit ${kitID} history reverted. Deleted block ${blockToDelete.block.index}.`,
      deletedBlock: blockToDelete.block
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// NEW: Admin endpoint to get audit logs
app.get('/admin/logs', authenticateToken, authorizeRoles('admin'), (req, res) => {
  try {
    const logs = loggingService.getRecentLogs(100); // Get last 100 log entries
    
    res.status(200).json({
      success: true,
      logs
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// NEW: Endpoint to log user actions (for audit trail)
app.post('/log-action', authenticateToken, (req, res) => {
  try {
    const { action, details } = req.body;
    
    if (!action) {
      return res.status(400).json({
        success: false,
        message: 'Action is required'
      });
    }
    
    // Log the action
    loggingService.logEvent(req.user.userId, req.user.email, action, details || '');
    
    res.status(200).json({
      success: true,
      message: 'Action logged successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Route to serve the Register Page
app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

// Route to serve the Login Page
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Route to serve the Admin Page
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Catch-all: Direct everyone else to the main app (Alpine.js handles internal views)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Handle 404 for undefined routes
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Start the server
app.listen(PORT, async () => {
  console.log(`🚀 ICRC Node Running on Port ${PORT}`);

  // Initialize P2P synchronization with known peers if provided
  const knownPeers = process.env.KNOWN_PEERS ? process.env.KNOWN_PEERS.split(',') : [];
  if (knownPeers.length > 0) {
    console.log(`🔗 Initializing P2P synchronization with known peers:`, knownPeers);
    await p2pServer.initializeSync(knownPeers);
  } else {
    console.log('🔗 No known peers provided for initial sync');
  }

  console.log(`📋 Available endpoints:`);
  console.log(`   GET  /health            - Health check`);
  console.log(`   GET  /ledger           - View entire ledger`);
  console.log(`   GET  /ledger/:id       - View history of specific kit`);
  console.log(`   POST /add-kit         - Add new medical kit (requires auth)`);
  console.log(`   GET  /audit           - Audit blockchain integrity (requires auth)`);
  console.log(`   GET  /tamper-check/:id - Check for tampering in kit history (requires auth)`);
  console.log(`   POST /register-node   - Register a new peer node`);
  console.log(`   GET  /sync            - Get full blockchain`);
  console.log(`   POST /receive-block   - Receive block from peer`);
  console.log(`   POST /nodes/register  - Register neighbor node`);
  console.log(`   POST /blocks/receive  - Receive block from neighbor`);
  console.log(`   POST /register        - Register new user`);
  console.log(`   POST /login           - Authenticate user`);
  console.log(`   GET  /profile        - Get user profile (requires auth)`);
  console.log(`   GET  /users          - Get all users (admin only)`);
  console.log(`   PUT  /users/:id/role - Update user role (admin only)`);
  console.log(`   DELETE /users/:id    - Delete user (admin only)`);
  console.log(`   GET  /intelligence/location/:loc - Get temperature for location (requires auth)`);
  console.log(`   GET  /intelligence/flight/:num - Get flight data (requires auth)`);
  console.log(`   GET  /intelligence/reports/:reg - Get humanitarian reports (requires auth)`);
  console.log(`   GET  /intelligence/shipment/:id - Get shipment intelligence (requires auth)`);

  // AUTOMATION: Open browser tabs
  setTimeout(() => {
    try {
      console.log('🌐 Opening browser tabs...');
      // Use exec to open browser tabs (works on Windows)
      exec(`start http://localhost:${PORT}/admin`);
      exec(`start http://localhost:${PORT}/register`);
      console.log('✅ Browser tabs opened successfully');
    } catch (error) {
      console.error('❌ Error opening browser tabs:', error.message);
    }
  }, 2000); // Wait 2 seconds before opening browser tabs
});

// NEW: Update location endpoint for Transporters
app.post('/update-location', authenticateToken, async (req, res) => {
  try {
    const { kitID, newLocation, temperature, notes } = req.body;
    const user = req.user; // Get user info from token

    // Verify user has transporter role
    if (user.role !== 'transporter' && user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only transporters and admins can update location'
      });
    }

    if (!kitID || !newLocation) {
      return res.status(400).json({
        success: false,
        message: 'Kit ID and new location are required'
      });
    }

    // Find the latest block for this kit
    const ledgerPath = path.join(__dirname, 'ledger-data');
    const files = fs.readdirSync(ledgerPath);

    // Filter for block files and sort them by index (descending)
    const blockFiles = files
      .filter(file => file.startsWith('block_') && file.endsWith('.json'))
      .sort((a, b) => {
        const indexA = parseInt(a.match(/block_(\d+)\.json/)[1]);
        const indexB = parseInt(b.match(/block_(\d+)\.json/)[1]);
        return indexB - indexA; // Descending order
      });

    let existingBlock = null;
    for (const fileName of blockFiles) {
      const filePath = path.join(ledgerPath, fileName);
      const block = JSON.parse(fs.readFileSync(filePath, 'utf8'));

      if (block.data && block.data.kitID === kitID) {
        existingBlock = block;
        break; // Get the most recent block for this kit
      }
    }

    if (!existingBlock) {
      return res.status(404).json({
        success: false,
        message: `No records found for kit ID: ${kitID}`
      });
    }

    // Create updated kit data with new location
    const updatedKitData = {
      ...existingBlock.data,
      location: newLocation,
      temperature: temperature !== undefined ? temperature : existingBlock.data.temperature,
      lastUpdatedBy: user.email,
      lastUpdatedRole: user.role,
      lastUpdatedTimestamp: new Date().toISOString(),
      notes: notes || existingBlock.data.notes || ''
    };

    // Add the updated kit to the blockchain
    await blockchain.addBlock(updatedKitData);

    // Get the latest block that was just added
    const newBlock = blockchain.getLatestBlock();
    console.log(`✅ Location update for Kit ${kitID} added as block ${newBlock.index}.`);

    // THE GOSSIP: Broadcast to all registered peers
    peers.forEach(peer => {
      console.log(`📡 Gossiping location update block ${newBlock.index} to: ${peer}`);
      axios.post(`${peer}/blocks/receive`, newBlock)
          .catch(err => console.error(`❌ Failed to sync with ${peer}`, err.message));
    });

    // Log the action
    loggingService.logEvent(user.userId, user.email, 'UPDATE_LOCATION', `Kit ID: ${kitID}, New Location: ${newLocation}, Role: ${user.role}`);

    res.status(200).json({
      success: true,
      message: 'Location updated successfully',
      kit: updatedKitData,
      block: newBlock
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = app;