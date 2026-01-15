import { app, BrowserWindow, dialog } from 'electron';
import { autoUpdater } from 'electron-updater';
import * as path from 'path';
import { initializeDatabase } from '../database/db';
import { registerIpcHandlers } from './ipc-handlers';
import { logger } from '../utils/logger';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
    logger.info('Creating main window');
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
        titleBarStyle: 'hiddenInset', // macOS native look
        backgroundColor: '#1a1a1a',
    });

    // Load the app
    mainWindow.loadFile(path.join(__dirname, '..', 'index.html'));

    // Open DevTools for debugging
    if (!app.isPackaged) {
        mainWindow.webContents.openDevTools();
        logger.info('DevTools opened (development mode)');
    }

    mainWindow.on('closed', () => {
        logger.info('Main window closed');
        mainWindow = null;
    });
}

app.on('ready', () => {
    logger.info('Application starting', {
        version: app.getVersion(),
        platform: process.platform,
        arch: process.arch,
        isPackaged: app.isPackaged
    });

    // Initialize database
    initializeDatabase();
    // Register IPC handlers
    registerIpcHandlers();
    createWindow();

    // Check for updates
    if (app.isPackaged) {
        logger.info('Checking for updates');
        autoUpdater.checkForUpdatesAndNotify();
    }
});

// Auto-update event listeners
autoUpdater.on('update-available', () => {
    logger.info('Update available');
});

autoUpdater.on('update-downloaded', (_info) => {
    logger.info('Update downloaded, prompting user');
    dialog.showMessageBox({
        type: 'info',
        title: 'Update Ready',
        message: 'A new version of Household Payroll has been downloaded. Restart the application to apply the updates?',
        buttons: ['Restart', 'Later']
    }).then((result) => {
        if (result.response === 0) {
            logger.info('User chose to restart for update');
            autoUpdater.quitAndInstall();
        } else {
            logger.info('User chose to update later');
        }
    });
});

app.on('window-all-closed', () => {
    logger.info('All windows closed');
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    logger.info('Application activated');
    if (mainWindow === null) {
        createWindow();
    }
});

// Log unhandled errors
process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception in main process', error);
});

process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled promise rejection in main process', reason as Error);
});
