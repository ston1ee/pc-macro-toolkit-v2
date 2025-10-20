const { app, BrowserWindow, ipcMain, globalShortcut } = require('electron');
const path = require('path');
const localShortcut = require('electron-localshortcut');
const { keyboard, mouse, Button, Key } = require('@nut-tree/nut-js');

let mainWindow;
let isRecording = false;
let isPlaying = false;
let recordedMacro = [];
let startTime;

// Create the main application window
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: false
    },
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'build/icon.png')
  });

  mainWindow.loadFile('index.html');

  // Register local shortcuts (window-specific)
  localShortcut.register(mainWindow, 'F12', () => {
    mainWindow.webContents.toggleDevTools();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Initialize the application
app.whenReady().then(() => {
  createWindow();

  // Register global shortcuts
  registerGlobalShortcuts();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  // Unregister all global shortcuts
  globalShortcut.unregisterAll();
});

// Register global shortcuts for macro recording
function registerGlobalShortcuts() {
  // F9: Start/Stop Recording
  globalShortcut.register('F9', () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  });

  // F10: Play macro
  globalShortcut.register('F10', () => {
    if (!isPlaying && recordedMacro.length > 0) {
      playMacro();
    }
  });

  // F11: Stop playback
  globalShortcut.register('F11', () => {
    if (isPlaying) {
      stopPlayback();
    }
  });
}

// Start recording macro
function startRecording() {
  isRecording = true;
  recordedMacro = [];
  startTime = Date.now();
  
  if (mainWindow) {
    mainWindow.webContents.send('recording-status', { recording: true });
  }
  
  console.log('Recording started...');
}

// Stop recording macro
function stopRecording() {
  isRecording = false;
  
  if (mainWindow) {
    mainWindow.webContents.send('recording-status', { recording: false });
    mainWindow.webContents.send('macro-recorded', recordedMacro);
  }
  
  console.log('Recording stopped. Recorded events:', recordedMacro.length);
}

// Play recorded macro
async function playMacro() {
  if (recordedMacro.length === 0) {
    console.log('No macro to play');
    return;
  }

  isPlaying = true;
  
  if (mainWindow) {
    mainWindow.webContents.send('playback-status', { playing: true });
  }

  console.log('Playing macro...');

  try {
    for (const event of recordedMacro) {
      if (!isPlaying) break;

      // Wait for the delay
      if (event.delay > 0) {
        await sleep(event.delay);
      }

      // Execute the event
      switch (event.type) {
        case 'keypress':
          await keyboard.type(Key[event.key] || event.key);
          break;
        case 'click':
          await mouse.click(Button[event.button]);
          break;
        case 'move':
          await mouse.setPosition({ x: event.x, y: event.y });
          break;
      }
    }
  } catch (error) {
    console.error('Error during playback:', error);
  }

  isPlaying = false;
  
  if (mainWindow) {
    mainWindow.webContents.send('playback-status', { playing: false });
  }
  
  console.log('Playback finished');
}

// Stop playback
function stopPlayback() {
  isPlaying = false;
  
  if (mainWindow) {
    mainWindow.webContents.send('playback-status', { playing: false });
  }
  
  console.log('Playback stopped');
}

// Helper function for delays
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// IPC Handlers for renderer process communication
ipcMain.on('start-recording', () => {
  startRecording();
});

ipcMain.on('stop-recording', () => {
  stopRecording();
});

ipcMain.on('play-macro', () => {
  playMacro();
});

ipcMain.on('stop-playback', () => {
  stopPlayback();
});

ipcMain.on('save-macro', (event, macro) => {
  recordedMacro = macro;
  console.log('Macro saved with', macro.length, 'events');
});

ipcMain.on('load-macro', (event) => {
  event.reply('macro-loaded', recordedMacro);
});

ipcMain.on('clear-macro', () => {
  recordedMacro = [];
  console.log('Macro cleared');
});

ipcMain.on('add-macro-event', (event, macroEvent) => {
  if (isRecording) {
    const delay = Date.now() - startTime;
    recordedMacro.push({ ...macroEvent, delay });
    startTime = Date.now();
  }
});

// Auto-clicker functionality
let clickerInterval = null;

ipcMain.on('start-clicker', (event, config) => {
  if (clickerInterval) {
    clearInterval(clickerInterval);
  }
  
  const interval = config.interval || 1000;
  const button = config.button || 'LEFT';
  
  clickerInterval = setInterval(async () => {
    try {
      await mouse.click(Button[button]);
    } catch (error) {
      console.error('Click error:', error);
    }
  }, interval);
  
  console.log(`Auto-clicker started: ${button} button every ${interval}ms`);
});

ipcMain.on('stop-clicker', () => {
  if (clickerInterval) {
    clearInterval(clickerInterval);
    clickerInterval = null;
    console.log('Auto-clicker stopped');
  }
});

// Key presser functionality
let keyPresserInterval = null;

ipcMain.on('start-key-presser', (event, config) => {
  if (keyPresserInterval) {
    clearInterval(keyPresserInterval);
  }
  
  const interval = config.interval || 1000;
  const key = config.key || 'Space';
  
  keyPresserInterval = setInterval(async () => {
    try {
      await keyboard.type(Key[key] || key);
    } catch (error) {
      console.error('Key press error:', error);
    }
  }, interval);
  
  console.log(`Key presser started: ${key} every ${interval}ms`);
});

ipcMain.on('stop-key-presser', () => {
  if (keyPresserInterval) {
    clearInterval(keyPresserInterval);
    keyPresserInterval = null;
    console.log('Key presser stopped');
  }
});

// Get current mouse position
ipcMain.handle('get-mouse-position', async () => {
  try {
    const position = await mouse.getPosition();
    return position;
  } catch (error) {
    console.error('Error getting mouse position:', error);
    return { x: 0, y: 0 };
  }
});
