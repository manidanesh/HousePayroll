# Household Payroll System

A secure, desktop payroll application for household employers to manage caregiver payroll while maintaining compliance with U.S. federal and Colorado employment requirements.

## 🎯 Overview

This Electron-based application enables household employers to:
- Manage multiple W-2 caregiver employee profiles with encrypted SSN storage
- Track daily hours worked per caregiver
- Calculate payroll with accurate tax withholdings (Federal, Social Security, Medicare, Colorado SUTA)
- Generate compliant paystubs in PDF format
- Maintain immutable, auditable payroll records
- Export data for W-2 and Schedule H tax form preparation
- Process payments via Stripe integration

## ✨ Key Features

### Security & Privacy
- **Encrypted Data**: SSNs and EINs encrypted using OS-native secure storage
- **Sanitized Logging**: Sensitive data automatically redacted from all logs
- **Local-First**: Database stored in iCloud for backup, not transmitted to external servers
- **PIN Protection**: Optional PIN-based authentication

### Payroll Management
- **Multi-Caregiver Support**: Manage multiple caregivers independently
- **Tax Compliance**: Automated federal and Colorado tax calculations
- **W-4 Form Support**: Proper withholding based on employee W-4 elections
- **Bi-weekly Pay Periods**: Automated pay period tracking
- **Immutable Records**: Finalized payroll records cannot be modified

### Reporting & Export
- **PDF Paystubs**: Colorado-compliant paystub generation
- **Year-End Reports**: W-2 and Schedule H data export
- **Audit Trail**: Complete history of all payroll transactions
- **CSV Export**: Data export for tax preparation

## 🛠️ Technology Stack

### Frontend
- **React 19** - UI framework
- **TypeScript** - Type-safe development
- **Recharts** - Data visualization
- **React Hot Toast** - User notifications
- **Zustand** - State management

### Backend
- **Electron 39** - Desktop application framework
- **Better-SQLite3** - Local database
- **Node.js** - Runtime environment

### Security & Encryption
- **Electron SafeStorage** - OS-native encryption for keys
- **bcryptjs** - Password hashing
- **crypto** (Node.js) - Data encryption

### PDF Generation
- **PDFKit** - Paystub and report generation

### Payment Processing
- **Stripe** - Payment integration (optional)

### Build & Development
- **Webpack 5** - Module bundling
- **TypeScript 5.9** - Compilation
- **Jest** - Testing framework
- **Electron Builder** - Application packaging

## 📁 Project Structure

```
HousePayroll/
├── src/
│   ├── core/                    # Core business logic
│   │   ├── payroll-calculator.ts
│   │   ├── tax-computer.ts
│   │   └── federal-withholding-calculator.ts
│   ├── database/                # Database layer
│   │   └── db.ts               # SQLite setup, encryption, schema
│   ├── main/                    # Electron main process
│   │   ├── main.ts
│   │   └── ipc-handlers.ts
│   ├── renderer/                # React UI
│   │   ├── components/         # React components
│   │   ├── context/            # React context
│   │   ├── hooks/              # Custom hooks
│   │   └── lib/                # Frontend utilities
│   ├── services/                # Business logic services
│   │   ├── caregiver-service.ts
│   │   ├── employer-service.ts
│   │   ├── payroll-service.ts
│   │   ├── reporting-service.ts
│   │   └── ... (17 services total)
│   ├── types/                   # TypeScript type definitions
│   ├── utils/                   # Utility functions
│   │   ├── sanitizer.ts        # Data sanitization
│   │   ├── logger.ts           # Structured logging
│   │   └── paystub-generator.ts
│   └── tests/                   # Test files
├── DB/                          # Database files (iCloud synced)
│   ├── payroll.db
│   ├── .key.enc                # Encrypted encryption key
│   └── logs/
├── docs/                        # Documentation
├── build/                       # Build assets (icons, entitlements)
├── dist/                        # Compiled output
└── release/                     # Packaged applications
```

## 🚀 Getting Started

### Prerequisites
- **macOS** (currently Mac-only, Windows support planned)
- **Node.js 18+** and npm
- **Xcode Command Line Tools** (for native modules)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/manidanesh/HousePayroll.git
   cd HousePayroll
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build the application**
   ```bash
   npm run build
   ```

4. **Run the application**
   ```bash
   npm run start
   ```

### Development

- **Start in development mode**
  ```bash
  npm run dev
  ```

- **Run tests**
  ```bash
  npm test
  npm run test:watch      # Watch mode
  npm run test:coverage   # With coverage
  ```

- **Package for distribution**
  ```bash
  npm run package
  ```
  Creates DMG and ZIP files in `release/` directory

## 📖 Documentation

- **[User Help Guide](docs/HELP.md)** - How to use the application
- **[File Structure](docs/FILE_STRUCTURE.md)** - Detailed code organization
- **[Requirements](docs/requirements.md)** - System requirements and specifications
- **[API Documentation](docs/API.md)** - Service layer documentation

## 🔒 Security Features

### Data Encryption
- SSNs and EINs encrypted using AES-256-CBC
- Encryption keys stored in OS-native secure storage (Keychain on macOS)
- Database files encrypted at rest

### Sanitization
- All sensitive data automatically redacted from logs
- IPC payloads sanitized before logging
- Error messages never expose plain-text SSNs

### Access Control
- Optional PIN-based authentication
- Session management
- Audit logging of all data access

## 📊 Database Schema

The application uses SQLite with the following main tables:
- `employers` - Household employer information
- `caregivers` - Employee profiles (SSN encrypted)
- `time_entries` - Hours worked tracking
- `payroll_records` - Calculated payroll (immutable when finalized)
- `payments` - Payment transaction ledger
- `audit_log` - Complete audit trail
- `tax_configurations` - Tax rates by year

## 🧪 Testing

```bash
npm test                 # Run all tests
npm run test:watch       # Watch mode
npm run test:coverage    # Generate coverage report
```

## 📦 Building for Distribution

### macOS
```bash
npm run package
```

Outputs:
- `release/Household Payroll-1.0.0-arm64.dmg` - Disk image
- `release/Household Payroll-1.0.0-arm64-mac.zip` - ZIP archive
- `release/mac-arm64/Household Payroll.app` - Application bundle

**Note**: The application is currently unsigned. On first launch:
1. Right-click the app
2. Select "Open"
3. Click "Open" in the security dialog

## 🤝 Contributing

This is a personal project, but suggestions and bug reports are welcome via GitHub Issues.

## 📝 License

ISC License - See LICENSE file for details

## 🆘 Support

For help using the application, see [docs/HELP.md](docs/HELP.md)

For technical issues, please open a GitHub issue.

## 🔄 Version History

### v1.0.0 (Current)
- Initial release
- Multi-caregiver payroll management
- Federal and Colorado tax compliance
- Encrypted data storage
- PDF paystub generation
- Stripe payment integration
- iCloud database sync

## 🎯 Roadmap

- [ ] Windows support
- [ ] Additional state tax support
- [ ] Mobile companion app
- [ ] Cloud backup options
- [ ] Advanced reporting features
- [ ] Multi-household support

---

**Author**: Mani Danesh  
**Repository**: https://github.com/manidanesh/HousePayroll  
**Version**: 1.0.0
