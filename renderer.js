const { ipcRenderer } = require('electron');

let isRecording = false;
let isPlaying = false;
let currentMacro = [];
let currentTab = 'macro';

// DOM Elements
const tabButtons = document.querySelectorAll('.tab-button');
const tabContents = document.querySelectorAll('.tab-content');

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  initializeTabs();
  initializeMacroTab();
  initializeClickerTab();
  initializeKeyPresserTab();
  setupIPCListeners();
  loadSavedMacro();
});

// Tab Navigation
function initializeTabs() {
  const tabs = document.querySelectorAll('.tab-button');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });
}

function switchTab(tabName) {
  currentTab = tabName;
  
  // Update tab buttons
  document.querySelectorAll('.tab-button').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
  
  // Update tab content
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.toggle('active', content.id === `${tabName}-tab`);
  });
}

// Macro Tab Functionality
function initializeMacroTab() {
  const recordBtn = document.getElementById('record-btn');
  const playBtn = document.getElementById('play-btn');
  const stopBtn = document.getElementById('stop-btn');
  const clearBtn = document.getElementById('clear-btn');
  const saveBtn = document.getElementById('save-macro-btn');
  const loadBtn = document.getElementById('load-macro-btn');

  recordBtn?.addEventListener('click', toggleRecording);
  playBtn?.addEventListener('click', playMacro);
  stopBtn?.addEventListener('click', stopPlayback);
  clearBtn?.addEventListener('click', clearMacro);
  saveBtn?.addEventListener('click', saveMacro);
  loadBtn?.addEventListener('click', loadMacro);
}

function toggleRecording() {
  if (isRecording) {
    stopRecording();
  } else {
    startRecording();
  }
}

function startRecording() {
  isRecording = true;
  currentMacro = [];
  ipcRenderer.send('start-recording');
  updateMacroStatus('Recording...', 'recording');
  updateMacroButtons();
}

function stopRecording() {
  isRecording = false;
  ipcRenderer.send('stop-recording');
  updateMacroStatus('Recording stopped', 'idle');
  updateMacroButtons();
}

function playMacro() {
  if (currentMacro.length === 0) {
    updateMacroStatus('No macro to play', 'error');
    return;
  }
  
  isPlaying = true;
  ipcRenderer.send('play-macro');
  updateMacroStatus('Playing macro...', 'playing');
  updateMacroButtons();
}

function stopPlayback() {
  isPlaying = false;
  ipcRenderer.send('stop-playback');
  updateMacroStatus('Playback stopped', 'idle');
  updateMacroButtons();
}

function clearMacro() {
  if (confirm('Are you sure you want to clear the current macro?')) {
    currentMacro = [];
    ipcRenderer.send('clear-macro');
    updateMacroEventList();
    updateMacroStatus('Macro cleared', 'idle');
  }
}

function saveMacro() {
  if (currentMacro.length === 0) {
    updateMacroStatus('No macro to save', 'error');
    return;
  }
  
  const macroData = JSON.stringify(currentMacro, null, 2);
  const blob = new Blob([macroData], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'macro.json';
  a.click();
  URL.revokeObjectURL(url);
  updateMacroStatus('Macro saved', 'success');
}

function loadMacro() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          currentMacro = JSON.parse(event.target.result);
          ipcRenderer.send('save-macro', currentMacro);
          updateMacroEventList();
          updateMacroStatus('Macro loaded successfully', 'success');
        } catch (error) {
          updateMacroStatus('Error loading macro file', 'error');
        }
      };
      reader.readAsText(file);
    }
  };
  input.click();
}

function loadSavedMacro() {
  ipcRenderer.send('load-macro');
}

function updateMacroEventList() {
  const eventList = document.getElementById('macro-events');
  if (!eventList) return;
  
  eventList.innerHTML = '';
  
  if (currentMacro.length === 0) {
    eventList.innerHTML = '<div class="no-events">No events recorded</div>';
    return;
  }
  
  currentMacro.forEach((event, index) => {
    const eventDiv = document.createElement('div');
    eventDiv.className = 'macro-event';
    eventDiv.innerHTML = `
      <span class="event-index">${index + 1}</span>
      <span class="event-type">${event.type}</span>
      <span class="event-delay">${event.delay}ms</span>
      <span class="event-details">${formatEventDetails(event)}</span>
    `;
    eventList.appendChild(eventDiv);
  });
}

function formatEventDetails(event) {
  switch (event.type) {
    case 'keypress':
      return `Key: ${event.key}`;
    case 'click':
      return `Button: ${event.button}`;
    case 'move':
      return `Position: (${event.x}, ${event.y})`;
    default:
      return '';
  }
}

function updateMacroStatus(message, status) {
  const statusEl = document.getElementById('macro-status');
  if (statusEl) {
    statusEl.textContent = message;
    statusEl.className = `status ${status}`;
  }
}

function updateMacroButtons() {
  const recordBtn = document.getElementById('record-btn');
  const playBtn = document.getElementById('play-btn');
  const stopBtn = document.getElementById('stop-btn');
  
  if (recordBtn) {
    recordBtn.textContent = isRecording ? 'Stop Recording (F9)' : 'Start Recording (F9)';
    recordBtn.disabled = isPlaying;
  }
  
  if (playBtn) {
    playBtn.disabled = isRecording || isPlaying || currentMacro.length === 0;
  }
  
  if (stopBtn) {
    stopBtn.disabled = !isPlaying;
  }
}

// Auto-Clicker Tab Functionality
function initializeClickerTab() {
  const startBtn = document.getElementById('start-clicker-btn');
  const stopBtn = document.getElementById('stop-clicker-btn');
  
  let clickerActive = false;
  
  startBtn?.addEventListener('click', () => {
    const interval = parseInt(document.getElementById('clicker-interval').value);
    const button = document.getElementById('clicker-button').value;
    
    if (interval < 10) {
      updateClickerStatus('Interval must be at least 10ms', 'error');
      return;
    }
    
    ipcRenderer.send('start-clicker', { interval, button });
    clickerActive = true;
    updateClickerButtons(true);
    updateClickerStatus('Auto-clicker active', 'running');
  });
  
  stopBtn?.addEventListener('click', () => {
    ipcRenderer.send('stop-clicker');
    clickerActive = false;
    updateClickerButtons(false);
    updateClickerStatus('Auto-clicker stopped', 'idle');
  });
}

function updateClickerButtons(active) {
  const startBtn = document.getElementById('start-clicker-btn');
  const stopBtn = document.getElementById('stop-clicker-btn');
  
  if (startBtn) startBtn.disabled = active;
  if (stopBtn) stopBtn.disabled = !active;
}

function updateClickerStatus(message, status) {
  const statusEl = document.getElementById('clicker-status');
  if (statusEl) {
    statusEl.textContent = message;
    statusEl.className = `status ${status}`;
  }
}

// Key Presser Tab Functionality
function initializeKeyPresserTab() {
  const startBtn = document.getElementById('start-keypresser-btn');
  const stopBtn = document.getElementById('stop-keypresser-btn');
  
  let keyPresserActive = false;
  
  startBtn?.addEventListener('click', () => {
    const interval = parseInt(document.getElementById('keypresser-interval').value);
    const key = document.getElementById('keypresser-key').value;
    
    if (interval < 10) {
      updateKeyPresserStatus('Interval must be at least 10ms', 'error');
      return;
    }
    
    ipcRenderer.send('start-key-presser', { interval, key });
    keyPresserActive = true;
    updateKeyPresserButtons(true);
    updateKeyPresserStatus('Key presser active', 'running');
  });
  
  stopBtn?.addEventListener('click', () => {
    ipcRenderer.send('stop-key-presser');
    keyPresserActive = false;
    updateKeyPresserButtons(false);
    updateKeyPresserStatus('Key presser stopped', 'idle');
  });
}

function updateKeyPresserButtons(active) {
  const startBtn = document.getElementById('start-keypresser-btn');
  const stopBtn = document.getElementById('stop-keypresser-btn');
  
  if (startBtn) startBtn.disabled = active;
  if (stopBtn) stopBtn.disabled = !active;
}

function updateKeyPresserStatus(message, status) {
  const statusEl = document.getElementById('keypresser-status');
  if (statusEl) {
    statusEl.textContent = message;
    statusEl.className = `status ${status}`;
  }
}

// IPC Listeners
function setupIPCListeners() {
  ipcRenderer.on('recording-status', (event, data) => {
    isRecording = data.recording;
    updateMacroButtons();
  });
  
  ipcRenderer.on('macro-recorded', (event, macro) => {
    currentMacro = macro;
    updateMacroEventList();
  });
  
  ipcRenderer.on('playback-status', (event, data) => {
    isPlaying = data.playing;
    updateMacroButtons();
    if (!data.playing) {
      updateMacroStatus('Playback finished', 'success');
    }
  });
  
  ipcRenderer.on('macro-loaded', (event, macro) => {
    currentMacro = macro;
    updateMacroEventList();
  });
}

// Theme Toggle
function toggleTheme() {
  const body = document.body;
  const currentTheme = body.getAttribute('data-theme') || 'dark';
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  body.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
}

// Load saved theme
const savedTheme = localStorage.getItem('theme') || 'dark';
document.body.setAttribute('data-theme', savedTheme);
