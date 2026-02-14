// setup.js - Node.js initialization script to create the directory structure
const fs = require('fs');
const path = require('path');

// Define the directory structure
const directories = [
  'bin',
  'config',
  'ledger-data',
  path.join('identity', 'icrc-hq'),
  path.join('identity', 'suppliers'),
  'contracts',
  'logs'
];

console.log('Creating directory structure for ICRC Supply Chain Tracking System...');

// Create each directory
directories.forEach(dir => {
  const dirPath = path.join(__dirname, dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`Created directory: ${dir}`);
  } else {
    console.log(`Directory already exists: ${dir}`);
  }
});

console.log('\nDirectory structure created successfully!');
console.log('\nNext steps:');
console.log('1. Run: npm init -y');
console.log('2. Install dependencies: npm install crypto-js elliptic dotenv');
console.log('3. Create the required modules as specified');