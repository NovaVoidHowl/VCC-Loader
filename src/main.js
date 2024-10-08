const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

if (process.env.NODE_ENV === 'development') {
    require('electron-reload')(__dirname, {
        electron: path.join(__dirname, 'node_modules', '.bin', 'electron')
    });
}

let mainWindow;
let deeplinkingUrl;

// Ensure only one instance of the app is running
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        // Someone tried to run a second instance, we should focus our window.
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();

            // Process deeplinking URL from the second instance
            commandLine.forEach(arg => {
                if (arg.startsWith('--vcc-url=')) {
                    deeplinkingUrl = extractDataUrl(arg.split('=')[1]);
                    console.log(`Parsed deeplinking URL from command-line: ${deeplinkingUrl}`);
                    mainWindow.webContents.send('deeplinking-url', deeplinkingUrl);
                } else if (arg.startsWith('vcc://')) {
                    deeplinkingUrl = extractDataUrl(arg);
                    console.log(`Parsed deeplinking URL from command-line: ${deeplinkingUrl}`);
                    mainWindow.webContents.send('deeplinking-url', deeplinkingUrl);
                }
            });
        }
    });

    // This is the first instance, continue with app initialization
    app.on('ready', createWindow);

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

    // Parse command-line arguments for the first instance
    const args = process.argv.slice(1);
    args.forEach(arg => {
        if (arg.startsWith('--vcc-url=')) {
            deeplinkingUrl = extractDataUrl(arg.split('=')[1]);
            console.log(`Parsed deeplinking URL from command-line: ${deeplinkingUrl}`);
        } else if (arg.startsWith('vcc://')) {
            deeplinkingUrl = extractDataUrl(arg);
            console.log(`Parsed deeplinking URL from command-line: ${deeplinkingUrl}`);
        }
    });
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        backgroundColor: '#121212', // Set the background color to a dark color
        show: false, // Don't show the window until it's ready
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    mainWindow.loadFile('src/index.html');

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        if (deeplinkingUrl) {
            mainWindow.webContents.send('deeplinking-url', deeplinkingUrl);
        }
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// Function to extract and decode the actual data URL from the vcc URL
function extractDataUrl(vccUrl) {
    const urlMatch = vccUrl.match(/vcc:\/\/vpm\/addRepo\?url=(.*)/);
    if (urlMatch && urlMatch[1]) {
        return decodeURIComponent(urlMatch[1]);
    }
    return null;
}