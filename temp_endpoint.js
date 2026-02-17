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