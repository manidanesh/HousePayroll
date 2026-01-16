/**
 * BackupService Unit Tests
 */

import { BackupService } from '../backup-service';
import * as fs from 'fs';
import { app } from 'electron';
jest.mock('fs');
jest.mock('electron', () => ({
    app: {
        getPath: jest.fn().mockReturnValue('/mock/user/data'),
        getVersion: jest.fn().mockReturnValue('1.0.0'),
    }
}));

// Mock db directly to avoid better-sqlite3 binding issues in this specific test suite
jest.mock('../../database/db', () => ({
    getDatabase: jest.fn().mockReturnValue({
        prepare: jest.fn().mockReturnValue({
            run: jest.fn(),
            get: jest.fn(),
            all: jest.fn()
        })
    }),
    closeDatabase: jest.fn(),
    resetTestDatabase: jest.fn()
}));

// No need to import DBCode or getDatabase from it anymore, we use the mocked module
import { getDatabase } from '../../database/db';

jest.mock('../../utils/logger');
jest.mock('../../utils/password-crypto', () => ({
    validatePassword: jest.fn().mockReturnValue(null), // Valid
    encryptWithPassword: jest.fn().mockReturnValue({ salt: 's', iv: 'i', authTag: 'a', ciphertext: 'c' }),
    decryptWithPassword: jest.fn().mockReturnValue(JSON.stringify({ data: 'base64data', created: 'date', platform: 'test' })),
}));

describe('BackupService', () => {
    let service: BackupService;

    beforeEach(() => {
        service = new BackupService(getDatabase());
        jest.clearAllMocks();
        (fs.existsSync as jest.Mock).mockReturnValue(true);
    });

    describe('exportBackup', () => {
        it('should copy database files', async () => {
            await service.exportBackup('/dest/path');

            expect(fs.copyFileSync).toHaveBeenCalled();
        });
    });

    describe('exportEncryptedBackup', () => {
        it('should write encrypted file', async () => {
            (fs.readFileSync as jest.Mock).mockReturnValue(Buffer.from('test db content'));
            (fs.statSync as jest.Mock).mockReturnValue({ size: 100 });

            await service.exportEncryptedBackup('password123', '/dest/backup.json');

            expect(fs.writeFileSync).toHaveBeenCalled();
        });
    });
});
