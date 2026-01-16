export const app = {
    getPath: jest.fn((name) => {
        if (name === 'userData') return '/tmp/mock-user-data';
        return '/tmp';
    }),
    getVersion: jest.fn(() => '1.0.0'),
    isPackaged: false,
};

export const safeStorage = {
    isEncryptionAvailable: jest.fn(() => true),
    encryptString: jest.fn((str) => Buffer.from(str)),
    decryptString: jest.fn((buf) => buf.toString()),
};

export const ipcMain = {
    handle: jest.fn(),
    on: jest.fn(),
};

export const ipcRenderer = {
    invoke: jest.fn(),
    on: jest.fn(),
    send: jest.fn(),
};

export const dialog = {
    showOpenDialog: jest.fn(),
    showSaveDialog: jest.fn(),
    showMessageBox: jest.fn(),
};

export const BrowserWindow = jest.fn().mockImplementation(() => ({
    loadFile: jest.fn(),
    webContents: {
        openDevTools: jest.fn(),
        send: jest.fn(),
    },
    on: jest.fn(),
}));

export const autoUpdater = {
    checkForUpdatesAndNotify: jest.fn(),
    on: jest.fn(),
};

export const contextBridge = {
    exposeInMainWorld: jest.fn(),
};
