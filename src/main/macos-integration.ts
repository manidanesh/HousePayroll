/**
 * macOS Platform Integration
 * Handles Native Touch Bar, Menu Bar, Dock, and Spotlight integration
 */

import { app, Menu, TouchBar, BrowserWindow, MenuItemConstructorOptions, Notification, MenuItem } from 'electron';
import { logger } from '../utils/logger';

const { TouchBarButton, TouchBarSpacer } = TouchBar;

export class MacIntegration {
    private mainWindow: BrowserWindow;

    constructor(window: BrowserWindow) {
        this.mainWindow = window;
    }

    /**
     * Initialize all macOS specific integrations
     */
    init() {
        if (process.platform !== 'darwin') return;

        this.setupTouchBar();
        this.setupApplicationMenu();
        this.setupDockMenu();
        this.registerProtocolHandler();

        logger.info('macOS integration initialized');
    }

    /**
     * Setup MacBook Pro Touch Bar controls
     */
    private setupTouchBar() {
        const runPayrollBtn = new TouchBarButton({
            label: '💰 Run Payroll',
            backgroundColor: '#28a745',
            click: () => {
                this.mainWindow.webContents.send('verify-payroll-status', 'start');
                // We'd rely on renderer to listen to this or use an IPC call
                this.mainWindow.webContents.send('navigate', '/payroll/run');
            }
        });

        const addCaregiverBtn = new TouchBarButton({
            label: '➕ New Caregiver',
            click: () => {
                this.mainWindow.webContents.send('navigate', '/caregivers/new');
            }
        });

        const touchBar = new TouchBar({
            items: [
                runPayrollBtn,
                new TouchBarSpacer({ size: 'small' }),
                addCaregiverBtn
            ]
        });

        this.mainWindow.setTouchBar(touchBar);
    }

    /**
     * Setup Native Application Menu
     */
    private setupApplicationMenu() {
        const template: MenuItemConstructorOptions[] = [
            {
                label: app.name,
                submenu: [
                    { role: 'about' },
                    { type: 'separator' },
                    { label: 'Preferences...', accelerator: 'Cmd+,', click: () => this.mainWindow.webContents.send('navigate', '/settings') },
                    { type: 'separator' },
                    { role: 'services' },
                    { type: 'separator' },
                    { role: 'hide' },
                    { role: 'hideOthers' },
                    { role: 'unhide' },
                    { type: 'separator' },
                    { role: 'quit' }
                ]
            },
            {
                label: 'File',
                submenu: [
                    { label: 'New Caregiver', accelerator: 'Cmd+N', click: () => this.mainWindow.webContents.send('navigate', '/caregivers/new') },
                    { type: 'separator' },
                    { label: 'Export Backup...', click: () => this.mainWindow.webContents.send('trigger-backup-export') },
                    { label: 'Import Backup...', click: () => this.mainWindow.webContents.send('trigger-backup-import') },
                    { type: 'separator' },
                    { role: 'close' }
                ]
            },
            {
                label: 'Edit',
                submenu: [
                    { role: 'undo' },
                    { role: 'redo' },
                    { type: 'separator' },
                    { role: 'cut' },
                    { role: 'copy' },
                    { role: 'paste' },
                    { role: 'selectAll' }
                ]
            },
            {
                label: 'View',
                submenu: [
                    { role: 'reload' },
                    { role: 'forceReload' },
                    { role: 'toggleDevTools' },
                    { type: 'separator' },
                    { role: 'resetZoom' },
                    { role: 'zoomIn' },
                    { role: 'zoomOut' },
                    { type: 'separator' },
                    { role: 'togglefullscreen' }
                ]
            },
            {
                label: 'Window',
                submenu: [
                    { role: 'minimize' },
                    { role: 'zoom' },
                    { type: 'separator' },
                    { role: 'front' }
                ]
            },
            {
                role: 'help',
                submenu: [
                    {
                        label: 'Learn More',
                        click: async () => {
                            const { shell } = require('electron');
                            await shell.openExternal('https://github.com/manidanesh/HousePayroll');
                        }
                    }
                ]
            }
        ];

        const menu = Menu.buildFromTemplate(template);
        Menu.setApplicationMenu(menu);
    }

    /**
     * Setup Dock right-click menu
     */
    private setupDockMenu() {
        if (app.dock) {
            const dockMenu = Menu.buildFromTemplate([
                {
                    label: 'New Caregiver',
                    click: () => this.mainWindow.webContents.send('navigate', '/caregivers/new')
                },
                {
                    label: 'Run Payroll',
                    click: () => this.mainWindow.webContents.send('navigate', '/payroll/run')
                }
            ]);
            app.dock.setMenu(dockMenu);
        }
    }

    /**
     * Register Custom Protocol (Spotlight integration essentially)
     * e.g. housepayroll://caregiver/123
     */
    private registerProtocolHandler() {
        if (!app.isDefaultProtocolClient('housepayroll')) {
            app.setAsDefaultProtocolClient('housepayroll');
        }

        app.on('open-url', (event, url) => {
            event.preventDefault();
            logger.info('App opened via URL', { url });

            // Send to renderer which can handle routing
            if (this.mainWindow) {
                if (this.mainWindow.isMinimized()) this.mainWindow.restore();
                this.mainWindow.focus();
                this.mainWindow.webContents.send('deep-link', url);
            }
        });
    }

    /**
     * Show a native notification
     */
    static showNotification(title: string, body: string, callback?: () => void) {
        if (!Notification.isSupported()) return;

        const notification = new Notification({
            title,
            body,
            silent: false
        });

        if (callback) {
            notification.on('click', callback);
        }

        notification.show();
    }
}
