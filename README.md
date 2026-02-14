# ICRC Humanitarian Blockchain Ledger

A blockchain-based supply chain tracking system for the International Committee of the Red Cross (ICRC), inspired by Walmart's blockchain implementation for food safety.

## 🚀 Features

- **Immutable Ledger**: Blockchain-based tracking system with cryptographic verification
- **Real-time Monitoring**: Live dashboard for tracking humanitarian supplies
- **Temperature Compliance**: Automated monitoring of temperature-sensitive medical supplies
- **Multi-location Tracking**: Track supplies from origin to destination
- **Audit Trail**: Complete verification of supply chain integrity

## 🛠️ Tech Stack

- **Backend**: Node.js with Express.js
- **Frontend**: HTML5, Tailwind CSS, Alpine.js
- **Cryptography**: Elliptic Curve (secp256k1) for digital signatures
- **Storage**: File-based ledger (JSON files)

## 📋 Phases Completed

### Phase 1: Core Infrastructure
- [x] Directory structure establishment
- [x] Cryptographic identity module (secp256k1)
- [x] MedicalKit asset model with self-signing logic
- [x] Local environment verification

### Phase 2: Ledger Engine
- [x] Blockchain manager with file-based storage
- [x] Validation logic for medical kits
- [x] Chain integrity verification

### Phase 3: API Gateway
- [x] Express.js API gateway
- [x] RESTful endpoints for ledger access
- [x] Kit submission and validation API

### Phase 4: Traceability Dashboard
- [x] Humanitarian traceability dashboard
- [x] Real-time data visualization
- [x] Interactive kit tracking interface

## 🔐 Security

- Private keys are stored locally and excluded from version control
- All transactions are digitally signed using elliptic curve cryptography
- Chain integrity verification ensures data hasn't been tampered with

## 🚀 Getting Started

1. Clone the repository:
   ```bash
   git clone https://github.com/bucky-ops/icrc-humanitarian-ledger.git
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the server:
   ```bash
   npm run server
   ```

4. Access the dashboard at `http://localhost:3000`

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details.

## 🙏 Acknowledgments

- Inspired by Walmart's blockchain implementation for supply chain transparency
- Built for organisations like the International Committee of the Red Cross (ICRC) humanitarian mission