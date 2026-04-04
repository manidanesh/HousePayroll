import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { getDatabase, closeDatabase } from '../database/db';
import { BaseRepository } from '../core/base-repository';
import { encryptWithPassword, decryptWithPassword, validatePassword } from '../utils/password-crypto';
import { logger } from '../utils/logger';

// Use Electron's userData directory (platform-independent)
// NOTE: evaluated lazily so app.setPath() in main.ts takes effect first.
const getDataDir = () => app.getPath('userData');
const getDbPath = () => path.join(getDataDir(), 'payroll.db');
const getKeyPathEnc = () => path.join(getDataDir(), '.key.enc');

export class BackupService extends BaseRepository<any> {

    // Abstract implementation dummy
    create(data: Partial<any>): any { throw new Error('Not implemented'); }
    update(id: number, data: Partial<any>): any { throw new Error('Not implemented'); }
    delete(id: number): void { throw new Error('Not implemented'); }
    getById(id: number): any | null { throw new Error('Not implemented'); }

    // Static Compatibility Layer
    static async exportBackup(destPath: string): Promise<void> {
        return new BackupService(getDatabase()).exportBackup(destPath);
    }

    static async importBackup(dbSrc: string): Promise<void> {
        return new BackupService(getDatabase()).importBackup(dbSrc);
    }

    static async exportEncryptedBackup(password: string, savePath: string): Promise<void> {
        return new BackupService(getDatabase()).exportEncryptedBackup(password, savePath);
    }

    static async importFromBackup(backupPath: string, password: string): Promise<void> {
        return new BackupService(getDatabase()).importFromBackup(backupPath, password);
    }

    // Instance Methods

    async exportBackup(destPath: string): Promise<void> {
        const DB_PATH = getDbPath();
        const KEY_PATH_ENC = getKeyPathEnc();

        if (!fs.existsSync(DB_PATH)) {
            throw new Error('Database file not found');
        }

        const dbDest = destPath.endsWith('.db') ? destPath : path.join(destPath, 'payroll_backup.db');
        const keyDest = dbDest + '.key';

        fs.copyFileSync(DB_PATH, dbDest);
        if (fs.existsSync(KEY_PATH_ENC)) {
            fs.copyFileSync(KEY_PATH_ENC, keyDest);
        }
    }

    async importBackup(dbSrc: string): Promise<void> {
        const DB_PATH = getDbPath();
        const KEY_PATH_ENC = getKeyPathEnc();

        if (!fs.existsSync(dbSrc)) {
            throw new Error('Source database file not found');
        }

        const keySrc = dbSrc + '.key';

        closeDatabase();

        try {
            const timestamp = Date.now();
            if (fs.existsSync(DB_PATH)) {
                fs.renameSync(DB_PATH, `${DB_PATH}.${timestamp}.bak`);
            }
            if (fs.existsSync(KEY_PATH_ENC)) {
                fs.renameSync(KEY_PATH_ENC, `${KEY_PATH_ENC}.${timestamp}.bak`);
            }

            fs.copyFileSync(dbSrc, DB_PATH);
            if (fs.existsSync(keySrc)) {
                fs.copyFileSync(keySrc, KEY_PATH_ENC);
            }
        } catch (err) {
            console.error('Failed to import backup:', err);
            throw err;
        }
    }

    async exportEncryptedBackup(password: string, savePath: string): Promise<void> {
        const DB_PATH = getDbPath();
        logger.info('Starting encrypted backup export', { savePath });

        const passwordError = validatePassword(password);
        if (passwordError) {
            throw new Error(passwordError);
        }

        if (!fs.existsSync(DB_PATH)) {
            throw new Error('Database file not found');
        }

        try {
            const dbData = fs.readFileSync(DB_PATH);
            const dbBase64 = dbData.toString('base64');

            const backupData = {
                version: '1.0',
                created: new Date().toISOString(),
                appVersion: app.getVersion(),
                platform: process.platform,
                data: dbBase64
            };

            const jsonData = JSON.stringify(backupData);
            const encrypted = encryptWithPassword(jsonData, password);

            const backupFile = {
                version: '1.0',
                created: backupData.created,
                encrypted: true,
                data: `${encrypted.salt}:${encrypted.iv}:${encrypted.authTag}:${encrypted.ciphertext}`
            };

            fs.writeFileSync(savePath, JSON.stringify(backupFile, null, 2), 'utf8');

            logger.info('Encrypted backup exported successfully', {
                savePath,
                size: fs.statSync(savePath).size
            });
        } catch (error) {
            logger.error('Failed to export encrypted backup', { error });
            throw error;
        }
    }

    async importFromBackup(backupPath: string, password: string): Promise<void> {
        const DB_PATH = getDbPath();
        logger.info('Starting encrypted backup import', { backupPath });

        if (!fs.existsSync(backupPath)) {
            throw new Error('Backup file not found');
        }

        try {
            const backupContent = fs.readFileSync(backupPath, 'utf8');
            const backupFile = JSON.parse(backupContent);

            if (!backupFile.version || !backupFile.encrypted || !backupFile.data) {
                throw new Error('Invalid backup file format');
            }

            const parts = backupFile.data.split(':');
            if (parts.length !== 4) {
                throw new Error('Corrupted backup file');
            }

            const encrypted = {
                salt: parts[0],
                iv: parts[1],
                authTag: parts[2],
                ciphertext: parts[3]
            };

            let decryptedJson: string;
            try {
                decryptedJson = decryptWithPassword(encrypted, password);
            } catch (error) {
                throw new Error('Incorrect password or corrupted backup file');
            }

            const backupData = JSON.parse(decryptedJson);

            if (!backupData.data) {
                throw new Error('Invalid backup data structure');
            }

            closeDatabase();

            const timestamp = Date.now();
            if (fs.existsSync(DB_PATH)) {
                const backupDbPath = `${DB_PATH}.${timestamp}.bak`;
                fs.renameSync(DB_PATH, backupDbPath);
                logger.info('Current database backed up', { backupDbPath });
            }

            const dbData = Buffer.from(backupData.data, 'base64');
            fs.writeFileSync(DB_PATH, dbData);

            logger.info('Encrypted backup imported successfully', {
                backupPath,
                created: backupData.created,
                platform: backupData.platform
            });
        } catch (error) {
            logger.error('Failed to import encrypted backup', { error });
            throw error;
        }
    }
}
