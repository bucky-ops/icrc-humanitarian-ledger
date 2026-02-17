# ICRC Humanitarian Blockchain Ledger

A blockchain-based supply chain tracking system for humanitarian organizations, inspired by Walmart's blockchain implementation for food safety. Built for the International Committee of the Red Cross (ICRC).

## 🚀 Features

- **Immutable Ledger**: Blockchain-based tracking system with cryptographic verification
- **Real-time Monitoring**: Live dashboard for tracking humanitarian supplies
- **Temperature Compliance**: Automated monitoring of temperature-sensitive medical supplies (2°C to 8°C)
- **Multi-location Tracking**: Track supplies from origin to destination across global hubs
- **Audit Trail**: Complete verification of supply chain integrity
- **P2P Synchronization**: Distributed ledger synchronization across network nodes
- **User Authentication**: Secure login and registration system
- **Intelligence Services**: Advanced analytics and monitoring

## 🛠️ Tech Stack

- **Backend**: Node.js with Express.js
- **Frontend**: HTML5, Tailwind CSS, Alpine.js, Lucide Icons
- **Cryptography**: Elliptic Curve (secp256k1) for digital signatures
- **Storage**: File-based ledger (JSON files)
- **Security**: JWT authentication, middleware protection

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
- [x] Audit ledger script

### Phase 3: API Gateway
- [x] Express.js API gateway
- [x] RESTful endpoints for ledger access
- [x] Kit submission and validation API
- [x] Health check and audit endpoints

### Phase 4: Traceability Dashboard
- [x] Humanitarian traceability dashboard
- [x] Real-time data visualization
- [x] Interactive kit tracking interface
- [x] Search and filter functionality
- [x] Temperature compliance indicators

### Phase 5: P2P Synchronization
- [x] P2P network module for node communication
- [x] Distributed ledger synchronization
- [x] User authentication system
- [x] Security middleware
- [x] Intelligence services for analytics
- [x] Logging services for audit trails

### Phase 6: Humanitarian Forecasting (Prediction Markets)
- [x] Prediction market creation and management
- [x] Constant Product Market Maker (AMM) implementation
- [x] YES/NO share trading system
- [x] Incentive credits for performance tracking
- [x] Automated market resolution based on blockchain data
- [x] Leaderboard and gamification for field staff
- [x] Dark mode trading interface (Polymarket-style)

## 🔐 Security

- Private keys are stored locally and excluded from version control
- All transactions are digitally signed using elliptic curve cryptography
- Chain integrity verification ensures data hasn't been tampered with
- JWT-based authentication for API access
- Security middleware for request validation

## 🚀 Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/bucky-ops/icrc-humanitarian-ledger.git
   ```

2. Navigate to the project directory:
   ```bash
   cd icrc-humanitarian-ledger
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Start the server:
   ```bash
   npm run server
   ```

5. Access the dashboard at `http://localhost:3000`

### API Endpoints

#### Core Blockchain Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check endpoint |
| GET | `/ledger` | Retrieve entire ledger |
| GET | `/ledger/:id` | Get specific kit history |
| POST | `/add-kit` | Add new medical kit |
| GET | `/audit` | Audit blockchain integrity |

#### Prediction Market Endpoints (Phase 6)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/markets` | Get all prediction markets |
| GET | `/api/markets/:id` | Get specific market details |
| POST | `/api/markets` | Create new prediction market (Admin) |
| POST | `/api/markets/:id/buy` | Buy YES/NO shares |
| POST | `/api/markets/:id/sell` | Sell YES/NO shares |
| GET | `/api/leaderboard` | Get top forecasters leaderboard |
| GET | `/api/user/:id/positions` | Get user's market positions |
| POST | `/api/markets/:id/resolve` | Resolve a market |

## 🧪 Testing

Run the API test suite:
```bash
node test-api.js
```

Run the P2P synchronization test:
```bash
node test-p2p.js
```

Run the ledger integrity test:
```bash
node test-ledger.js
```

Run the prediction market test:
```bash
node test-prediction.js
```

## 📁 Project Structure

```
icrc-humanitarian-ledger/
├── bin/                    # Utility scripts
├── config/                 # Configuration files
├── contracts/              # Smart contracts and models
│   ├── asset.js           # MedicalKit asset model
│   ├── ledger.js          # Blockchain manager
│   ├── market.js          # Prediction market logic
│   ├── shares.js          # Share management
│   └── rules.js           # Validation rules
├── identity/               # Cryptographic identities
├── ledger-data/            # Blockchain ledger data
├── middleware/             # Security middleware
├── public/                 # Frontend assets
│   ├── index.html         # Main dashboard
│   ├── markets.html       # Prediction markets UI
│   ├── login.html         # Login page
│   └── register.html      # Registration page
├── services/               # Business logic services
├── server.js               # Main server file
├── test-*.js               # Test files
└── README.md               # Project documentation
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

### How to Contribute

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details.

## 🙏 Acknowledgments

- Inspired by Walmart's blockchain implementation for supply chain transparency
- Built for organizations like the International Committee of the Red Cross (ICRC) humanitarian mission
- Uses secp256k1 elliptic curve cryptography (same as Bitcoin)

## 📬 Contact

- **Repository**: [icrc-humanitarian-ledger](https://github.com/bucky-ops/icrc-humanitarian-ledger)
- **Issues**: [GitHub Issues](https://github.com/bucky-ops/icrc-humanitarian-ledger/issues)

## 🏷️ Version

Current Release: v1.1.0 (Phase 6 - Humanitarian Forecasting)