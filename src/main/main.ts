import { app, BrowserWindow, dialog } from 'electron';
import { autoUpdater } from 'electron-updater';
import * as path from 'path';
import { initializeDatabase } from '../database/db';
import { registerIpcHandlers } from './ipc-handlers';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
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
    mainWindow.webContents.openDevTools();

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.on('ready', () => {
    // Initialize database
    initializeDatabase();
    // Register IPC handlers
    registerIpcHandlers();
    createWindow();

    // Check for updates
    if (app.isPackaged) {
        autoUpdater.checkForUpdatesAndNotify();
    }
});

// Auto-update event listeners
autoUpdater.on('update-available', () => {
    console.log('Update available');
});

autoUpdater.on('update-downloaded', (_info) => {
    dialog.showMessageBox({
        type: 'info',
        title: 'Update Ready',
        message: 'A new version of Household Payroll has been downloaded. Restart the application to apply the updates?',
        buttons: ['Restart', 'Later']
    }).then((result) => {
        if (result.response === 0) {
            autoUpdater.quitAndInstall();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});
