# File Structure Documentation

## Overview
This document provides a detailed breakdown of the Household Payroll application's file structure and organization.

## Root Directory

```
HousePayroll/
├── src/                  # Source code
├── DB/                   # Database files (iCloud synced, gitignored)
├── docs/                 # Documentation
├── build/                # Build assets (icons, entitlements)
├── dist/                 # Compiled TypeScript output
├── release/              # Packaged applications
├── node_modules/         # Dependencies
├── package.json          # Project configuration
├── tsconfig.json         # TypeScript configuration
├── webpack.config.js     # Webpack bundler configuration
└── README.md             # Project overview
```

## Source Code (`src/`)

### Core Business Logic (`src/core/`)
Contains pure, functional payroll calculation logic with no side effects.

- **`payroll-calculator.ts`** - Main payroll calculation engine
- **`enhanced-payroll-calculator.ts`** - Extended calculator with additional features
- **`tax-computer.ts`** - Tax calculation logic (FICA, Medicare, FUTA, SUTA)
- **`federal-withholding-calculator.ts`** - Federal income tax withholding based on W-4
- **`__tests__/`** - Unit tests for core logic

### Database Layer (`src/database/`)
- **`db.ts`** - SQLite database initialization, schema, encryption utilities
  - Database connection management
  - Encryption/decryption functions for SSN/EIN
  - Schema creation and migrations
  - Data directory: `~/Library/Mobile Documents/com~apple~CloudDocs/Applications/HousePayroll/DB/`

### Main Process (`src/main/`)
Electron main process - handles system-level operations.

- **`main.ts`** - Application entry point, window management, lifecycle
- **`ipc-handlers.ts`** - Inter-process communication handlers
  - Bridges renderer (UI) and main process
  - Sanitizes sensitive data in error logs
  - Handles all service layer calls

### Renderer Process (`src/renderer/`)
React-based user interface.

#### Components (`src/renderer/components/`)
- **`OnboardingWizard.tsx`** - Initial setup flow
- **`CaregiverManagement.tsx`** - Caregiver CRUD operations
- **`PayrollProcessing.tsx`** - Payroll calculation and finalization
- **`PayrollHistory.tsx`** - Historical payroll records
- **`PayrollDetail.tsx`** - Detailed payroll view
- **`TimeEntryManagement.tsx`** - Hours tracking
- **`TaxConfigurationSettings.tsx`** - Tax rate management
- **`AuditLog.tsx`** - Audit trail viewer
- **`HouseholdSwitcher.tsx`** - Multi-household support (future)
- **`PinSetup.tsx`** - PIN authentication
- **`ErrorBoundary.tsx`** - Error handling wrapper
- **`SuccessModal.tsx`** - Success notifications

#### Context (`src/renderer/context/`)
- **`caregiver-context.tsx`** - Global caregiver state management

#### Hooks (`src/renderer/hooks/`)
- **`useAsync.tsx`** - Async operation handling

#### Library (`src/renderer/lib/`)
- **`ipc.ts`** - Type-safe IPC communication wrapper

#### Styles
- **`App.css`** - Main application styles
- **`index.css`** - Global styles

### Services Layer (`src/services/`)
Business logic and data access layer.

#### Core Services
- **`caregiver-service.ts`** - Caregiver management (CRUD, encryption)
- **`employer-service.ts`** - Employer profile management
- **`payroll-service.ts`** - Payroll processing and finalization
- **`time-entry-service.ts`** - Hours tracking
- **`pay-period-service.ts`** - Pay period calculation

#### Tax & Compliance
- **`tax-configuration-service.ts`** - Tax rate management by year
- **`colorado-tax-service.ts`** - Colorado-specific tax calculations
- **`ytd-service.ts`** - Year-to-date calculations

#### Reporting
- **`reporting-service.ts`** - Report generation
- **`w2-service.ts`** - W-2 form data generation
- **`year-end-service.ts`** - Year-end processing and exports

#### Payment
- **`payment-service.ts`** - Payment transaction management
- **`stripe-service.ts`** - Stripe integration

#### System
- **`auth-service.ts`** - PIN authentication
- **`audit-service.ts`** - Audit logging
- **`backup-service.ts`** - Database backup/restore
- **`database-cleanup.ts`** - Database maintenance

### Types (`src/types/`)
- **`index.ts`** - TypeScript type definitions for all entities
  - Caregiver, Employer, PayrollRecord, TimeEntry, etc.
  - Input/Output types for services
  - Renderer-safe types (no sensitive data)

### Utilities (`src/utils/`)
- **`sanitizer.ts`** - Sensitive data redaction for logs
- **`logger.ts`** - Structured logging system
- **`paystub-generator.ts`** - PDF paystub creation
- **`pay-timing-validator.ts`** - Pay period validation
- **`holiday-calendar.ts`** - Holiday tracking
- **`errors.ts`** - Custom error types

### Tests (`src/tests/`)
- **`setup.ts`** - Jest test configuration
- **`test-utils.ts`** - Testing utilities

## Database (`DB/`)
**Location**: `~/Library/Mobile Documents/com~apple~CloudDocs/Applications/HousePayroll/DB/`

```
DB/
├── payroll.db           # Main SQLite database
├── payroll.db-shm       # Shared memory file
├── payroll.db-wal       # Write-ahead log
├── .key.enc             # Encrypted encryption key
└── logs/                # Application logs
    ├── app-YYYY-MM-DD.log
    └── error-YYYY-MM-DD.log
```

### Database Tables
- `employers` - Household employer profiles
- `caregivers` - Employee profiles (SSN encrypted)
- `time_entries` - Hours worked
- `payroll_records` - Calculated payroll (immutable when finalized)
- `payments` - Payment transactions
- `payment_transactions` - Payment ledger
- `tax_configurations` - Tax rates by year
- `audit_log` - Complete audit trail
- `auth` - PIN authentication
- `export_logs` - Export history

## Documentation (`docs/`)
- **`requirements.md`** - System requirements
- **`implementation_plan.md`** - Technical architecture
- **`task.md`** - Development checklist
- **`HELP.md`** - User help guide
- **`FILE_STRUCTURE.md`** - This document
- **`API.md`** - Service layer API documentation

## Build Assets (`build/`)
- **`icon.icns`** - macOS application icon
- **`icon.ico`** - Windows application icon
- **`entitlements.mac.plist`** - macOS entitlements for code signing

## Configuration Files

### TypeScript
- **`tsconfig.json`** - Base TypeScript configuration
- **`tsconfig.main.json`** - Main process configuration
- **`tsconfig.test.json`** - Test configuration

### Build
- **`webpack.config.js`** - Webpack bundler for renderer process
- **`jest.config.js`** - Jest test runner configuration
- **`package.json`** - npm dependencies and scripts

### Git
- **`.gitignore`** - Excluded files (node_modules, dist, DB/, etc.)

## Output Directories

### `dist/`
Compiled TypeScript output (not committed to git)
```
dist/
├── main/               # Compiled main process
├── renderer/           # Bundled renderer
└── services/           # Compiled services
```

### `release/`
Packaged applications (not committed to git)
```
release/
├── Household Payroll-1.0.0-arm64.dmg
├── Household Payroll-1.0.0-arm64-mac.zip
└── mac-arm64/
    └── Household Payroll.app/
```

## Import Patterns

### Services
```typescript
import { CaregiverService } from '../services/caregiver-service';
```

### Database
```typescript
import { getDatabase, encrypt, decrypt } from '../database/db';
```

### Types
```typescript
import { Caregiver, PayrollRecord } from '../types';
```

### Utilities
```typescript
import { sanitizeData } from '../utils/sanitizer';
import { logger } from '../utils/logger';
```

## Key Architectural Patterns

### Separation of Concerns
- **Core**: Pure business logic, no I/O
- **Services**: Data access and business operations
- **Main**: System integration
- **Renderer**: User interface

### Data Flow
```
User Input (Renderer)
  → IPC Call (ipc.ts)
    → IPC Handler (ipc-handlers.ts)
      → Service Layer (services/)
        → Database (db.ts)
          → SQLite (payroll.db)
```

### Security Layers
1. **Encryption**: SSN/EIN encrypted at rest
2. **Sanitization**: Sensitive data redacted from logs
3. **IPC Protection**: Error payloads sanitized
4. **Type Safety**: Renderer-safe types exclude sensitive fields

## Development Workflow

1. **Edit source** in `src/`
2. **Build** with `npm run build`
   - TypeScript → `dist/`
   - Webpack → `dist/renderer/`
3. **Test** with `npm test`
4. **Run** with `npm start`
5. **Package** with `npm run package` → `release/`

## File Naming Conventions

- **Services**: `*-service.ts`
- **Components**: `PascalCase.tsx`
- **Utilities**: `kebab-case.ts`
- **Types**: `index.ts` (centralized)
- **Tests**: `*.test.ts` or `__tests__/`

---

**Last Updated**: 2026-01-15  
**Version**: 1.0.0
