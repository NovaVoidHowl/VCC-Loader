const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const storage = require('node-persist');
const { exec } = require('child_process');
const winVersionInfo = require('win-version-info');
const semver = require('semver');

let mainWindow;
let deeplinkingUrl;

// Initialize node-persist with a custom storage directory
async function initializeStorage() {
  try {
    await storage.init({
      dir: path.join(app.getPath('userData'), 'user-data')
    });
    console.log('Storage initialized successfully');
  } catch (error) {
    console.error('Failed to initialize storage:', error);
    app.quit();
  }
}

initializeStorage();

if (process.env.NODE_ENV === 'development') {
  require('electron-reload')(__dirname, {
    electron: path.join(__dirname, 'node_modules', '.bin', 'electron')
  });
}

// Ensure only one instance of the app is running
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
  
      // Parse command-line arguments for the second instance
      commandLine.forEach(arg => {
        if (arg.startsWith('--vcc-url=')) {
          deeplinkingUrl = extractDataUrl(arg.split('=')[1]);
          console.log(`Parsed deeplinking URL from command-line: ${deeplinkingUrl}`);
        } else if (arg.startsWith('vcc://')) {
          deeplinkingUrl = extractDataUrl(arg);
          console.log(`Parsed deeplinking URL from command-line: ${deeplinkingUrl}`);
        }
      });
  
      // Send the deeplink URL to the renderer process
      if (deeplinkingUrl) {
        mainWindow.webContents.send('deeplinking-url', deeplinkingUrl);
      }
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

  // Handle storing and retrieving URLs
  ipcMain.on('save-url', async (event, url) => {
    try {
      let urls = await storage.getItem('urls') || [];
      if (!urls.includes(url)) {
        urls.push(url);
        await storage.setItem('urls', urls);
      }
      event.reply('url-saved', urls);
    } catch (error) {
      console.error('Failed to save URL:', error);
    }
  });

  ipcMain.on('get-urls', async (event) => {
    try {
      const urls = await storage.getItem('urls') || [];
      event.reply('urls', urls);
    } catch (error) {
      console.error('Failed to get URLs:', error);
    }
  });

  ipcMain.on('delete-url', async (event, url) => {
    try {
      let urls = await storage.getItem('urls') || [];
      urls = urls.filter(storedUrl => storedUrl !== url);
      await storage.setItem('urls', urls);
      event.reply('url-saved', urls);
    } catch (error) {
      console.error('Failed to delete URL:', error);
    }
  });

  // Handle version number requests
  ipcMain.on('request-version', (event) => {
    const packageJsonPath = path.join(__dirname, '..', 'package.json');
    fs.readFile(packageJsonPath, 'utf8', (err, data) => {
      if (err) {
        console.error('Failed to read package.json:', err);
        return;
      }
      const packageJson = JSON.parse(data);
      const appVersion = packageJson.version;
      event.reply('app-version', appVersion);
    });
  });

  // Handle storing and retrieving Unity projects
  ipcMain.on('save-project', async (event, project) => {
    try {
      let projects = await storage.getItem('projects') || [];
      if (!projects.some(p => p.path === project.path)) {
        projects.push(project);
        await storage.setItem('projects', projects);
      }
      event.reply('project-saved', projects);
    } catch (error) {
      console.error('Failed to save project:', error);
    }
  });

  ipcMain.on('get-projects', async (event) => {
    try {
      const projects = await storage.getItem('projects') || [];
      event.reply('projects', projects);
    } catch (error) {
      console.error('Failed to get projects:', error);
    }
  });

  ipcMain.on('delete-project', async (event, projectPath) => {
    try {
      let projects = await storage.getItem('projects') || [];
      projects = projects.filter(storedProject => storedProject.path !== projectPath);
      await storage.setItem('projects', projects);
      event.reply('project-saved', projects);
    } catch (error) {
      console.error('Failed to delete project:', error);
    }
  });

  ipcMain.on('select-project-folder', async (event) => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    });

    if (!result.canceled && result.filePaths.length > 0) {
      const projectPath = result.filePaths[0];
      const isValidUnityProject = fs.existsSync(path.join(projectPath, 'ProjectSettings')) && fs.existsSync(path.join(projectPath, 'Assets'));

      if (isValidUnityProject) {
        const projectVersionPath = path.join(projectPath, 'ProjectSettings', 'ProjectVersion.txt');
        let unityVersion = 'Unknown';
        if (fs.existsSync(projectVersionPath)) {
          const versionContent = fs.readFileSync(projectVersionPath, 'utf8');
          const versionMatch = versionContent.match(/m_EditorVersion: (.+)/);
          if (versionMatch) {
            unityVersion = versionMatch[1];
          }
        }
  
        const project = { path: projectPath, version: unityVersion };
        event.reply('project-saved', [project]);
        ipcMain.emit('save-project', event, project);
      } else {
        dialog.showErrorBox('Invalid Unity Project', 'The selected folder does not appear to be a valid Unity project.');
      }
    }
  });

  // Handle storing and retrieving Unity versions
  ipcMain.on('save-unity-version', async (event, unityVersion) => {
    try {
      let unityVersions = await storage.getItem('unityVersions') || [];
      if (!unityVersions.some(uv => uv.version === unityVersion.version)) {
        unityVersions.push(unityVersion);
        await storage.setItem('unityVersions', unityVersions);
      }
      event.reply('unity-versions', unityVersions);
    } catch (error) {
      console.error('Failed to save Unity version:', error);
    }
  });

  // Handle retrieving Unity versions
  ipcMain.handle('get-unity-versions', async () => {
    try {
      const unityVersions = await storage.getItem('unityVersions') || [];
      return unityVersions;
    } catch (error) {
      console.error('Failed to get Unity versions:', error);
      throw error;
    }
  });

  // Add an 'on' event to trigger the 'handle' function
  ipcMain.on('request-unity-versions', async (event) => {
    try {
      const unityVersions = await storage.getItem('unityVersions') || [];
      event.reply('unity-versions', unityVersions);
    } catch (error) {
      console.error('Failed to get Unity versions:', error);
    }
  });

  ipcMain.on('delete-unity-version', async (event, version) => {
    try {
      let unityVersions = await storage.getItem('unityVersions') || [];
      unityVersions = unityVersions.filter(uv => uv.version !== version);
      await storage.setItem('unityVersions', unityVersions);
      event.reply('unity-versions', unityVersions);
    } catch (error) {
      console.error('Failed to delete Unity version:', error);
    }
  });

  // Handle open-file-dialog event
  ipcMain.handle('open-file-dialog', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [{ name: 'Unity Executable', extensions: ['exe'] }]
    });

    if (!result.canceled && result.filePaths.length > 0) {
      const selectedFile = result.filePaths[0];
      if (path.basename(selectedFile).toLowerCase() === 'unity.exe') {
        // Extract Unity version from the executable
          const versionInfo = winVersionInfo(selectedFile);
        let unityVersion = versionInfo.ProductVersion;
        console.log('Unity version pre clean:', unityVersion);
  
        // Remove metadata after the underscore
        if (unityVersion.includes('_')) {
          unityVersion = unityVersion.split('_')[0];
            }
        
        console.log('Unity version post trim:', unityVersion);

        // remove any preceding or trailing whitespace
        unityVersion = unityVersion.trim();

        return { canceled: false, filePaths: result.filePaths, unityVersion };
      } else {
        dialog.showErrorBox('Invalid File', 'Please select the Unity.exe file.');
        return { canceled: true, filePaths: [] };
      }
    }

    return result;
  });

  // Update the open-project handler to use the stored Unity versions
  ipcMain.on('open-project', async (event, projectPath) => {
    const projectVersionPath = path.join(projectPath, 'ProjectSettings', 'ProjectVersion.txt');
    let unityVersion = 'Unknown';
    if (fs.existsSync(projectVersionPath)) {
      const versionContent = fs.readFileSync(projectVersionPath, 'utf8');
      const versionMatch = versionContent.match(/m_EditorVersion: (.+)/);
      if (versionMatch) {
        unityVersion = versionMatch[1];
      }
    }

    const unityVersions = await storage.getItem('unityVersions') || [];
    const unityPath = unityVersions.find(uv => uv.version === unityVersion)?.path;
    if (!unityPath) {
      console.error(`Unity executable for version ${unityVersion} not found.`);
      return;
    }

    exec(`"${unityPath}" -projectPath "${projectPath}"`, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error opening Unity project: ${error.message}`);
        return;
      }
      if (stderr) {
        console.error(`stderr: ${stderr}`);
        return;
      }
      console.log(`stdout: ${stdout}`);
    });
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

    // Read the version number from package.json and send it to the renderer process
    const packageJsonPath = path.join(__dirname, '..', 'package.json');
    fs.readFile(packageJsonPath, 'utf8', (err, data) => {
      if (err) {
        console.error('Failed to read package.json:', err);
        return;
      }
      const packageJson = JSON.parse(data);
      const appVersion = packageJson.version;
      mainWindow.webContents.send('app-version', appVersion);
    });
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