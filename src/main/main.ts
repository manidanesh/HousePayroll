import { app, BrowserWindow, dialog } from 'electron';
import { autoUpdater } from 'electron-updater';
import * as path from 'path';
import { initializeDatabase } from '../database/db';
import { registerServices } from '../core/service-registry';
import { registerIpcHandlers } from './ipc-handlers';
import { logger } from '../utils/logger';
import { MacIntegration } from './macos-integration';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
    logger.info('Creating main window');
    // Resolve icon path based on execution context
    // In dev/prod (unpackaged), we are in dist/main/, need to go up to build/
    const iconPath = app.isPackaged
        ? path.join(process.resourcesPath, 'icon.png') // In packaged app
        : path.join(__dirname, '../../build/icon.png'); // In dev

    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        icon: iconPath,
        webPreferences: {
            // SECURITY: Enable context isolation and disable node integration
            nodeIntegration: false,
            contextIsolation: true,
            // Use preload script to safely expose IPC API
            preload: path.join(__dirname, 'preload.js'),
            // Additional security settings
            sandbox: false, // Keep false for now to allow IPC
            webSecurity: true,
            allowRunningInsecureContent: false,
        },
        titleBarStyle: 'hiddenInset', // macOS native look
        backgroundColor: '#1a1a1a',
    });

    // Explicitly set dock icon in development on macOS
    if (process.platform === 'darwin' && !app.isPackaged && app.dock) {
        app.dock.setIcon(iconPath);
    }

    // Initialize macOS specific integration
    if (process.platform === 'darwin') {
        new MacIntegration(mainWindow).init();
    }

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
    // Register Services (DI)
    registerServices();
    // Register IPC handlers
    registerIpcHandlers();

    // SECURITY: Content Security Policy (CSP)
    // Modify response headers to strictly control resources
    const { session } = require('electron');
    session.defaultSession.webRequest.onHeadersReceived((details: any, callback: any) => {
        callback({
            responseHeaders: {
                ...details.responseHeaders,
                'Content-Security-Policy': [
                    // Script: Only self and Stripe.js
                    // Style: Self and inline (needed for React styled-components/dynamic styles)
                    // Connect: Self, Stripe API
                    "default-src 'self'; script-src 'self' https://js.stripe.com; style-src 'self' 'unsafe-inline'; connect-src 'self' https://api.stripe.com;"
                ]
            }
        });
    });

    // SECURITY: Certificate Pinning for Stripe API
    // Ensure we are talking to the real Stripe servers
    app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
        if (url.startsWith('https://api.stripe.com')) {
            // Logic to verify certificate fingerprint would go here.
            // For now, we are logging verification attempts.
            // In a strict implementation, we would compare certificate.fingerprint against a known hash.
            // const expectedFingerprint = 'SHA256_FINGERPRINT_FOR_STRIPE'; 
            // const isVerified = certificate.fingerprint === expectedFingerprint;

            // For this phase, we default to standard CA validation (callback(true) overrides validation, false relies on system trust)
            // returning false here means we do NOT override, so standard system trust Store is used.
            // To properly pin, we would need to dynamically fetch or hardcode the rotating pin.
            // Implementing basic trust-on-first-use or strict pinning requires maintenance of the hash.
            logger.info(`Checking certificate for ${url}: ${certificate.subject.commonName}`);

            // We allow the connection to proceed if standard validation fails ONLY if we explicitly verify it here.
            // But 'certificate-error' event is emitted when verification FAILS.
            // So if we trust it, we call callback(true). If not, callback(false).
            // Since we haven't hardcoded the pin yet, we will log and fall back to system trust (allow system to handle it, thus returning false to NOT override).
            callback(false);
        } else {
            callback(false);
        }
    });

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
