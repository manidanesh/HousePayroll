import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { getDatabase, closeDatabase } from '../database/db';

// Use Electron's userData directory (platform-independent)
const DATA_DIR = app.getPath('userData');
const DB_PATH = path.join(DATA_DIR, 'payroll.db');
const KEY_PATH_ENC = path.join(DATA_DIR, '.key.enc');

export class BackupService {
    /**
     * Exports the database and encryption key to a destination
     */
    static async exportBackup(destPath: string): Promise<void> {
        // Ensure the source exists
        if (!fs.existsSync(DB_PATH)) {
            throw new Error('Database file not found');
        }

        // We'll create a folder at destPath if it doesn't exist, or use it as a base
        // Actually, best to just copy the files to the specified paths

        const dbDest = destPath.endsWith('.db') ? destPath : path.join(destPath, 'payroll_backup.db');
        const keyDest = dbDest + '.key';

        fs.copyFileSync(DB_PATH, dbDest);
        if (fs.existsSync(KEY_PATH_ENC)) {
            fs.copyFileSync(KEY_PATH_ENC, keyDest);
        }
    }

    /**
     * Imports a database and key from a source
     */
    static async importBackup(dbSrc: string): Promise<void> {
        if (!fs.existsSync(dbSrc)) {
            throw new Error('Source database file not found');
        }

        const keySrc = dbSrc + '.key';

        // Close the database connection before replacing the file
        closeDatabase();

        try {
            // Backup current files just in case
            const timestamp = Date.now();
            if (fs.existsSync(DB_PATH)) {
                fs.renameSync(DB_PATH, `${DB_PATH}.${timestamp}.bak`);
            }
            if (fs.existsSync(KEY_PATH_ENC)) {
                fs.renameSync(KEY_PATH_ENC, `${KEY_PATH_ENC}.${timestamp}.bak`);
            }

            // Copy new files
            fs.copyFileSync(dbSrc, DB_PATH);
            if (fs.existsSync(keySrc)) {
                fs.copyFileSync(keySrc, KEY_PATH_ENC);
            }
        } catch (err) {
            console.error('Failed to import backup:', err);
            throw err;
        } finally {
            // Re-open/Initialize db will happen automatically on next getDatabase() call
            // as 'db' variable in db.ts will be null.
            // Wait, db.ts needs to be aware that the connection was closed.
            // I'll need to reset the 'db' variable in db.ts if I want it to re-open.
        }
    }
}
