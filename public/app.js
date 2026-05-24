// Frontend Ludo Realm Application Controller
const socket = io();

// Connection Status Management
const connectionStatus = document.getElementById('connectionStatus');

function setConnectionState(state) {
  if (!connectionStatus) return;
  if (state === 'connected') {
    connectionStatus.className = "flex items-center space-x-2 text-xs font-semibold px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
    connectionStatus.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span><span>Connected to Server</span>`;
    btnCreateRoom.style.opacity = "1";
    btnCreateRoom.style.pointerEvents = "auto";
    btnJoinRoom.style.opacity = "1";
    btnJoinRoom.style.pointerEvents = "auto";
  } else if (state === 'connecting') {
    connectionStatus.className = "flex items-center space-x-2 text-xs font-semibold px-3 py-1.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20";
    connectionStatus.innerHTML = `<span class="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span><span>Waking up Server (~50s)...</span>`;
    btnCreateRoom.style.opacity = "0.5";
    btnCreateRoom.style.pointerEvents = "none";
    btnJoinRoom.style.opacity = "0.5";
    btnJoinRoom.style.pointerEvents = "none";
  } else {
    connectionStatus.className = "flex items-center space-x-2 text-xs font-semibold px-3 py-1.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20";
    connectionStatus.innerHTML = `<span class="w-2 h-2 rounded-full bg-rose-400"></span><span>Disconnected</span>`;
    btnCreateRoom.style.opacity = "0.5";
    btnCreateRoom.style.pointerEvents = "none";
    btnJoinRoom.style.opacity = "0.5";
    btnJoinRoom.style.pointerEvents = "none";
  }
}

// Initial state is connecting
setTimeout(() => setConnectionState(socket.connected ? 'connected' : 'connecting'), 100);

socket.on('connect', () => {
  console.log("Socket connected successfully!");
  setConnectionState('connected');
});

socket.on('disconnect', () => {
  console.log("Socket disconnected.");
  setConnectionState('disconnected');
});

socket.on('connect_error', () => {
  console.log("Socket connection error (Server is likely sleeping).");
  setConnectionState('connecting');
});

// UI Screen Elements
const screenLanding = document.getElementById('screenLanding');
const screenLobby = document.getElementById('screenLobby');
const screenGame = document.getElementById('screenGame');
const screenGameOver = document.getElementById('screenGameOver');

// Form Fields & Buttons
const createNameInput = document.getElementById('createName');
const joinNameInput = document.getElementById('joinName');
const joinCodeInput = document.getElementById('joinCode');
const btnCreateRoom = document.getElementById('btnCreateRoom');
const btnJoinRoom = document.getElementById('btnJoinRoom');
const btnLeaveLobby = document.getElementById('btnLeaveLobby');
const btnStartGame = document.getElementById('btnStartGame');
const btnCopyCode = document.getElementById('btnCopyCode');
const btnReturnToLobby = document.getElementById('btnReturnToLobby');
const btnLeaveGame = document.getElementById('btnLeaveGame');

// Display Fields
const lobbyRoomCode = document.getElementById('lobbyRoomCode');
const joinedCount = document.getElementById('joinedCount');
const targetCount = document.getElementById('targetCount');
const playerSlotsList = document.getElementById('playerSlotsList');
const lobbyStatusDot = document.getElementById('lobbyStatusDot');
const gameRoomCodeDisp = document.getElementById('gameRoomCodeDisp');
const scoreboardList = document.getElementById('scoreboardList');
const rollStatusText = document.getElementById('rollStatusText');
const gameFeedLogs = document.getElementById('gameFeedLogs');
const podiumList = document.getElementById('podiumList');
const gameOverClientMsg = document.getElementById('gameOverClientMsg');
const alertBanner = document.getElementById('alertBanner');
const alertMessage = document.getElementById('alertMessage');

// Dice Roll Elements
const btnRollDice = document.getElementById('btnRollDice');
const dice3d = document.getElementById('dice3d');
const diceGlow = document.getElementById('diceGlow');
const diceWrapper = document.getElementById('diceWrapper');

// Canvas Configuration
const canvas = document.getElementById('ludoBoard');
const ctx = canvas.getContext('2d');
let boardScale = 1;

// Global Game Variables
let myRoomCode = '';
let isHost = false;
let currentLobbyState = null;
let selectedPlayerCount = 4; // 4, 5, or 6
let validMoveIndexes = [];
let consecutiveSixesState = 0;
let previousTrackPositions = {}; // Remembers previous positions for animations
let isMyTurn = false;

// Format color theme configurations
const COLOR_THEMES = {
  red: { primary: '#ff4a5a', secondary: '#ff8a95', light: 'rgba(255, 74, 90, 0.25)', text: '#ffffff' },
  green: { primary: '#2ec4b6', secondary: '#80e2d9', light: 'rgba(46, 196, 182, 0.25)', text: '#ffffff' },
  yellow: { primary: '#ffbf00', secondary: '#ffe066', light: 'rgba(255, 191, 0, 0.25)', text: '#0f172a' },
  blue: { primary: '#0077b6', secondary: '#00b4d8', light: 'rgba(0, 119, 182, 0.25)', text: '#ffffff' },
  purple: { primary: '#9d4edd', secondary: '#c77dff', light: 'rgba(157, 78, 221, 0.25)', text: '#ffffff' },
  orange: { primary: '#f77f00', secondary: '#fcbf49', light: 'rgba(247, 127, 0, 0.25)', text: '#ffffff' }
};

const DICE_ICONS = {
  1: 'fa-dice-one',
  2: 'fa-dice-two',
  3: 'fa-dice-three',
  4: 'fa-dice-four',
  5: 'fa-dice-five',
  6: 'fa-dice-six'
};

// ----------------------------------------------------
// UI Logic & Navigation
// ----------------------------------------------------

// Tab toggle (Create vs Join Room)
function switchLandingTab(tab) {
  const cTab = document.getElementById('toggleCreateTab');
  const jTab = document.getElementById('toggleJoinTab');
  const cForm = document.getElementById('formCreate');
  const jForm = document.getElementById('formJoin');

  if (tab === 'create') {
    cTab.className = "py-3 rounded-xl font-semibold text-sm transition-all duration-300 bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/25";
    jTab.className = "py-3 rounded-xl font-semibold text-sm transition-all duration-300 text-slate-400 hover:text-slate-200";
    cForm.classList.remove('hidden');
    jForm.classList.add('hidden');
  } else {
    jTab.className = "py-3 rounded-xl font-semibold text-sm transition-all duration-300 bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/25";
    cTab.className = "py-3 rounded-xl font-semibold text-sm transition-all duration-300 text-slate-400 hover:text-slate-200";
    jForm.classList.remove('hidden');
    cForm.classList.add('hidden');
  }
}

// Select Player Count format
document.querySelectorAll('.format-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.format-btn').forEach(b => b.classList.remove('active-format'));
    btn.classList.add('active-format');
    selectedPlayerCount = parseInt(btn.dataset.count);
  });
});

// Show alert banner
function showAlert(message) {
  alertMessage.innerText = message;
  alertBanner.classList.remove('hidden');
  setTimeout(() => {
    alertBanner.classList.add('hidden');
  }, 4500);
}

// Socket joining events handlers
btnCreateRoom.addEventListener('click', () => {
  const name = createNameInput.value.trim();
  socket.emit('createRoom', { name, playerCount: selectedPlayerCount });
});

btnJoinRoom.addEventListener('click', () => {
  const name = joinNameInput.value.trim();
  const code = joinCodeInput.value.trim();
  socket.emit('joinRoom', { name, roomCode: code });
});

btnLeaveLobby.addEventListener('click', () => {
  window.location.reload();
});

btnLeaveGame.addEventListener('click', () => {
  if (confirm("Are you sure you want to abandon the match?")) {
    window.location.reload();
  }
});

btnStartGame.addEventListener('click', () => {
  socket.emit('startGame');
});

btnCopyCode.addEventListener('click', () => {
  navigator.clipboard.writeText(myRoomCode);
  btnCopyCode.innerHTML = `<i class="fa-solid fa-check text-emerald-400"></i>`;
  setTimeout(() => {
    btnCopyCode.innerHTML = `<i class="fa-solid fa-copy"></i>`;
  }, 2000);
});

btnReturnToLobby.addEventListener('click', () => {
  socket.emit('returnToLobby');
});

// ----------------------------------------------------
// Socket Listeners
// ----------------------------------------------------
socket.on('errorMsg', (msg) => {
  showAlert(msg);
});

socket.on('roomJoined', ({ roomCode, isHost: hostStatus }) => {
  myRoomCode = roomCode;
  isHost = hostStatus;
  
  screenLanding.classList.add('hidden');
  screenLobby.classList.remove('hidden');
  lobbyRoomCode.innerText = roomCode;
});

socket.on('roomUpdated', (room) => {
  currentLobbyState = room;
  
  // 1. Update Lobby View
  joinedCount.innerText = room.players.length;
  targetCount.innerText = room.playerCount;
  
  // Fill slots
  playerSlotsList.innerHTML = '';
  for (let i = 0; i < room.playerCount; i++) {
    const player = room.players[i];
    const colorTheme = COLOR_THEMES[PLAYER_COLORS(room.playerCount)[i]];
    
    let cardHTML = '';
    if (player) {
      const isMe = player.id === socket.id;
      const isHostPlayer = room.hostId === player.id;
      
      cardHTML = `
        <div class="flex items-center justify-between bg-slate-950/40 border ${isMe ? 'border-indigo-500/50' : 'border-glassBorder'} rounded-2xl p-4 shadow-sm transition-all duration-300">
          <div class="flex items-center space-x-3">
            <div class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shadow-md shadow-black/30" style="background-color: ${colorTheme.primary}; color: ${colorTheme.text};">
              ${player.name.charAt(0).toUpperCase()}
            </div>
            <div class="flex flex-col">
              <span class="font-bold text-sm text-slate-100 flex items-center">
                ${player.name} ${isMe ? '<span class="text-[9px] text-indigo-400 font-medium ml-1.5 px-1.5 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20">Me</span>' : ''}
              </span>
              <span class="text-[9px] font-bold uppercase tracking-wider mt-0.5" style="color: ${colorTheme.primary};">${colorTheme.primary} Base</span>
            </div>
          </div>
          <div class="flex items-center space-x-2">
            ${isHostPlayer ? '<i class="fa-solid fa-crown text-amber-400 text-xs" title="Lobby Host"></i>' : ''}
            <span class="w-2.5 h-2.5 rounded-full ${player.active ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}" title="${player.active ? 'Active' : 'Offline'}"></span>
          </div>
        </div>
      `;
    } else {
      cardHTML = `
        <div class="flex items-center justify-between border border-dashed border-slate-700/60 rounded-2xl p-4 text-slate-600 transition-all">
          <div class="flex items-center space-x-3">
            <div class="w-8 h-8 rounded-full border border-dashed border-slate-700 flex items-center justify-center text-xs">
              <i class="fa-solid fa-user-plus text-[10px]"></i>
            </div>
            <div class="flex flex-col">
              <span class="text-xs font-semibold italic">Waiting for Player...</span>
              <span class="text-[9px] font-bold uppercase tracking-wider mt-0.5" style="color: ${colorTheme.primary}80;">${PLAYER_COLORS(room.playerCount)[i]} Base</span>
            </div>
          </div>
          <span class="w-2 h-2 rounded-full bg-slate-800"></span>
        </div>
      `;
    }
    playerSlotsList.innerHTML += cardHTML;
  }

  // Lobby Status Dot & host button enable/disable
  if (room.players.length === room.playerCount) {
    lobbyStatusDot.className = "flex items-center text-xs text-emerald-400 font-semibold bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-1 rounded-full space-x-1.5";
    lobbyStatusDot.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span><span>Lobby Full! Ready to play.</span>`;
    
    if (isHost) btnStartGame.removeAttribute('disabled');
  } else {
    lobbyStatusDot.className = "flex items-center text-xs text-amber-400 font-semibold bg-amber-500/10 border border-amber-500/25 px-2.5 py-1 rounded-full space-x-1.5 animate-pulse";
    lobbyStatusDot.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-amber-400"></span><span>Waiting for players...</span>`;
    
    if (isHost) btnStartGame.setAttribute('disabled', 'true');
  }

  // 2. Update Game Screen if playing
  if (room.status === 'playing' || room.status === 'finished') {
    screenLobby.classList.add('hidden');
    screenGame.classList.remove('hidden');
    gameRoomCodeDisp.innerText = `Code: ${room.code}`;
    
    // Update active turns states
    const activePlayer = room.players[room.turnIndex];
    isMyTurn = activePlayer.id === socket.id;
    
    // Dice controller button states
    if (isMyTurn && !room.diceRolled && room.status === 'playing') {
      btnRollDice.removeAttribute('disabled');
      rollStatusText.innerHTML = `<span class="text-emerald-400 font-bold animate-pulse">It is your turn! Roll the dice!</span>`;
      btnRollDice.innerHTML = `<i class="fa-solid fa-dice text-lg mr-1.5 animate-spin"></i><span>Roll Dice</span>`;
    } else {
      btnRollDice.setAttribute('disabled', 'true');
      if (room.status === 'playing') {
        rollStatusText.innerText = `Waiting for ${activePlayer.name} to roll...`;
        btnRollDice.innerHTML = `<span>Waiting...</span>`;
      } else {
        rollStatusText.innerText = `Game Over! Placements finished.`;
      }
    }

    // Update scoreboard side section
    updateScoreboard(room);

    // Update battlefield logs
    updateBattlefeedLogs(room.history);

    // Update 3D Dice faces
    updateDiceVisual(room.diceValue);

    // Sync visual pieces and activate rendering loop
    syncVisualPieces(room);
    startGameLoop(room);
  }

  if (room.status === 'finished') {
    renderGameOver(room);
  }
});

socket.on('diceRolled', ({ roll, validMoves, consecutiveSixes }) => {
  validMoveIndexes = validMoves;
  consecutiveSixesState = consecutiveSixes;
  
  // Trigger spin animation
  triggerDiceSpin(roll, () => {
    // Highlighting valid choices text
    if (isMyTurn) {
      if (validMoves.length > 0) {
        rollStatusText.innerHTML = `<span class="text-amber-300 font-extrabold animate-pulse"><i class="fa-solid fa-arrow-right"></i> Choose a highlighted piece to move!</span>`;
      } else {
        rollStatusText.innerHTML = `<span class="text-rose-400 font-semibold">No valid moves. Skipping turn...</span>`;
      }
    }
  });
});

socket.on('lobbyReset', ({ newRoomCode }) => {
  stopGameLoop();
  screenGameOver.classList.add('hidden');
  screenGame.classList.add('hidden');
  screenLobby.classList.remove('hidden');
  
  myRoomCode = newRoomCode;
  lobbyRoomCode.innerText = newRoomCode;
  validMoveIndexes = [];
  isMyTurn = false;
  
  // Quick request to re-sync lobby lists
  socket.emit('joinRoom', { name: createNameInput.value.trim() || joinNameInput.value.trim(), roomCode: newRoomCode });
});

// ----------------------------------------------------
// UI Render Helpers
// ----------------------------------------------------

function updateScoreboard(room) {
  scoreboardList.innerHTML = '';
  room.players.forEach((player, idx) => {
    const isCurrent = room.turnIndex === idx && room.status === 'playing';
    const colorTheme = COLOR_THEMES[player.color];
    const isMe = player.id === socket.id;
    
    // Count pieces completed
    const piecesFinished = room.pieces[player.id].filter(pos => pos === (13 * room.playerCount + 2)).length;
    
    let statusText = '';
    if (player.isFinished) {
      statusText = `<span class="text-[10px] font-bold bg-amber-500/20 text-yellow-400 border border-yellow-500/20 py-0.5 px-2 rounded-full uppercase tracking-wider"><i class="fa-solid fa-crown mr-1"></i>Rank #${player.finishRank}</span>`;
    } else if (!player.active) {
      statusText = `<span class="text-[9px] font-semibold text-rose-400/80 bg-rose-500/10 py-0.5 px-2 rounded-full uppercase tracking-wider">AFK</span>`;
    } else if (isCurrent) {
      statusText = `<span class="text-[9px] font-bold text-emerald-400 bg-emerald-500/15 py-0.5 px-2 rounded-full uppercase tracking-widest animate-pulse">ROLLING</span>`;
    } else {
      statusText = `<span class="text-[9px] text-slate-400 bg-slate-900 py-0.5 px-2 rounded-full uppercase">Waiting</span>`;
    }

    scoreboardList.innerHTML += `
      <div class="flex items-center justify-between p-3.5 bg-slate-950/40 rounded-2xl border ${isCurrent ? `glow-border-${player.color}` : 'border-glassBorder/70'} ${isCurrent ? `glow-bg-${player.color}` : ''} transition-all duration-300">
        <div class="flex items-center space-x-3">
          <div class="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border border-white/10" style="background-color: ${colorTheme.primary}; color: ${colorTheme.text};">
            ${player.name.charAt(0).toUpperCase()}
          </div>
          <div class="flex flex-col">
            <span class="font-bold text-sm text-slate-100 flex items-center">
              ${player.name} ${isMe ? '<span class="text-[8px] text-indigo-400 font-semibold ml-1 font-mono">Me</span>' : ''}
            </span>
            <div class="flex items-center space-x-2 mt-0.5">
              <span class="text-[9px] text-slate-500">Finished:</span>
              <span class="text-xs font-extrabold text-slate-300">${piecesFinished}/4</span>
            </div>
          </div>
        </div>
        <div class="flex items-center space-x-2">
          ${statusText}
        </div>
      </div>
    `;
  });
}

function updateBattlefeedLogs(history) {
  gameFeedLogs.innerHTML = '';
  const lastHistory = history.slice(-30).reverse(); // Show last 30 logs in reverse
  
  if (lastHistory.length === 0) {
    gameFeedLogs.innerHTML = `<div>&gt; Waiting for game events...</div>`;
    return;
  }

  lastHistory.forEach((log) => {
    let logHTML = '';
    
    if (log.type === 'info') {
      logHTML = `<div class="text-slate-400"><span class="text-slate-600">&gt;</span> ${log.text}</div>`;
    } else if (log.type === 'alert') {
      logHTML = `<div class="text-rose-400"><span class="text-rose-600 font-bold">&gt;</span> ${log.text}</div>`;
    } else if (log.type === 'roll') {
      logHTML = `<div class="text-slate-300"><span class="text-slate-600">&gt;</span> <span style="color: ${COLOR_THEMES[log.color].secondary}; font-weight: 700;">${log.player}</span> rolled <span class="font-bold text-white">${log.roll}</span></div>`;
    } else if (log.type === 'capture') {
      logHTML = `<div class="text-amber-400"><span class="text-amber-600 font-bold">&gt;</span> <span style="color: ${COLOR_THEMES[log.attackerColor].primary}; font-weight:700;">${log.attacker}</span> captured <span style="color: ${COLOR_THEMES[log.victimColor].primary}; font-weight:700;">${log.victim}</span>'s piece!</div>`;
    } else if (log.type === 'win') {
      logHTML = `<div class="text-yellow-400 font-bold"><span class="text-yellow-600">&gt;</span> ${log.text}</div>`;
    }
    
    gameFeedLogs.innerHTML += logHTML;
  });
}

function renderGameOver(room) {
  podiumList.innerHTML = '';
  
  // Sort players by rank
  const sortedPlayers = [...room.players].sort((a, b) => {
    if (a.isFinished && b.isFinished) return a.finishRank - b.finishRank;
    if (a.isFinished) return -1;
    if (b.isFinished) return 1;
    return 0;
  });

  sortedPlayers.forEach((player, i) => {
    const colorTheme = COLOR_THEMES[player.color];
    const rankIcons = ['fa-medal text-yellow-400', 'fa-medal text-slate-300', 'fa-medal text-amber-600'];
    
    podiumList.innerHTML += `
      <div class="flex items-center justify-between p-4 bg-slate-900 border border-glassBorder rounded-2xl shadow-inner">
        <div class="flex items-center space-x-3">
          <span class="text-slate-500 font-mono font-bold w-4">${i+1}.</span>
          <div class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border border-white/5" style="background-color: ${colorTheme.primary}; color: ${colorTheme.text};">
            ${player.name.charAt(0).toUpperCase()}
          </div>
          <span class="font-bold text-sm text-slate-100">${player.name}</span>
        </div>
        <div class="flex items-center space-x-1 text-slate-400 font-bold text-xs">
          ${player.isFinished ? `<i class="fa-solid ${rankIcons[player.finishRank - 1] || 'fa-award text-slate-400'} text-base"></i>` : '<span>DNF</span>'}
        </div>
      </div>
    `;
  });

  if (isHost) {
    gameOverHostPanel.classList.remove('hidden');
    gameOverClientMsg.classList.add('hidden');
  } else {
    gameOverHostPanel.classList.add('hidden');
    gameOverClientMsg.classList.remove('hidden');
  }

  screenGameOver.classList.remove('hidden');
}

// ----------------------------------------------------
// Dice 3D Spin Animation Utilities
// ----------------------------------------------------
function updateDiceVisual(val) {
  if (!val) {
    dice3d.innerHTML = `<i class="fa-solid fa-dice-one text-indigo-900 opacity-40"></i>`;
    return;
  }
  const icon = DICE_ICONS[val];
  dice3d.innerHTML = `<i class="fa-solid ${icon} text-indigo-950 scale-110"></i>`;
}

function triggerDiceSpin(result, callback) {
  dice3d.classList.add('dice-rolling');
  diceGlow.classList.remove('opacity-0');
  diceGlow.classList.add('opacity-100');
  
  let spinCounter = 0;
  const spinInterval = setInterval(() => {
    const randomFace = Math.floor(Math.random() * 6) + 1;
    updateDiceVisual(randomFace);
    spinCounter++;
    if (spinCounter > 8) clearInterval(spinInterval);
  }, 60);

  setTimeout(() => {
    dice3d.classList.remove('dice-rolling');
    diceGlow.classList.remove('opacity-100');
    diceGlow.classList.add('opacity-0');
    updateDiceVisual(result);
    if (callback) callback();
  }, 600);
}

// Trigger dice roll event on server
btnRollDice.addEventListener('click', () => {
  if (!isMyTurn || currentLobbyState.diceRolled) return;
  socket.emit('rollDice');
});

diceWrapper.addEventListener('click', () => {
  if (isMyTurn && !currentLobbyState.diceRolled && currentLobbyState.status === 'playing') {
    socket.emit('rollDice');
  }
});

// ----------------------------------------------------
// Canvas Ludo Board Generator & Drawing Engine
// ----------------------------------------------------

// Colors lists helper based on count
function PLAYER_COLORS(count) {
  if (count === 2) return ['red', 'yellow'];
  if (count === 3) return ['red', 'green', 'blue'];
  if (count === 4) return ['red', 'green', 'yellow', 'blue'];
  if (count === 5) return ['red', 'green', 'yellow', 'blue', 'purple'];
  return ['red', 'green', 'yellow', 'blue', 'purple', 'orange'];
}

// Setup scaling dynamically for high-DPI screens
function setupCanvasResolution() {
  const rect = canvas.parentNode ? canvas.parentNode.getBoundingClientRect() : { width: 0, height: 0 };
  let width = rect.width;
  let height = rect.height;
  
  // Fallback if width/height is 0 (element hidden during initial render / reflow latency)
  if (width === 0) {
    const parentWidth = canvas.parentNode ? canvas.parentNode.clientWidth : 0;
    width = parentWidth || Math.min(window.innerWidth - 48, 600);
    height = width;
  }
  
  canvas.style.width = width + 'px';
  canvas.style.height = height + 'px';
  
  const dpr = window.devicePixelRatio || 1;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  
  ctx.scale(dpr, dpr);
  boardScale = width;
}

window.addEventListener('resize', () => {
  if (currentLobbyState && (currentLobbyState.status === 'playing' || currentLobbyState.status === 'finished')) {
    setupCanvasResolution();
    drawLudoBoard(currentLobbyState, true);
  }
});

// Canvas Coordinate Mapping Math Engine
function getBoardCoordinates(playerCount) {
  const center = boardScale / 2;
  const outerR = boardScale * 0.46;
  const innerR = boardScale * 0.14;
  const cellsCount = 6;
  
  const widthRad = (outerR - innerR) / cellsCount; // Radial width of each cell
  const perpOffset = widthRad * 0.95; // Perpendicular cell width offset
  
  const armAngles = [];
  for (let p = 0; p < playerCount; p++) {
    // Symmetrical offset so the first arm points exactly UP (-90 degrees)
    armAngles.push(p * (2 * Math.PI / playerCount) - Math.PI / 2);
  }
  
  return { center, outerR, innerR, widthRad, perpOffset, armAngles };
}

// Calculate the center coordinates of a path cell
function getCellPosition(colorIndex, steps, playerCount, isHomeStretch = false) {
  const geom = getBoardCoordinates(playerCount);
  
  if (isHomeStretch) {
    // Private Home Stretch: c = 0, d = steps + 1
    const angle = geom.armAngles[colorIndex];
    const u = { x: Math.cos(angle), y: Math.sin(angle) };
    
    // Radial step coordinate (d from 1 to 5)
    const dist = geom.innerR + (steps + 0.5) * geom.widthRad;
    return {
      x: geom.center + dist * u.x,
      y: geom.center + dist * u.y
    };
  }

  // Translate local steps to column offset (c) and radial distance (d)
  // Inside an arm:
  // - Outward track cells (steps 0 to 5): c = -1, d = steps + 1
  // - Tip cell (step 6): c = 0, d = 6
  // - Inward track cells (steps 7 to 12): c = 1, d = 6 - (steps - 7) = 13 - steps
  let c = 0;
  let d = 0;
  
  if (steps >= 0 && steps <= 5) {
    c = -1;
    d = steps + 1;
  } else if (steps === 6) {
    c = 0;
    d = 6;
  } else if (steps >= 7 && steps <= 12) {
    c = 1;
    d = 13 - steps;
  }

  const angle = geom.armAngles[colorIndex];
  const u = { x: Math.cos(angle), y: Math.sin(angle) };
  const v = { x: -Math.sin(angle), y: Math.cos(angle) }; // Perpendicular vector (right-hand)
  
  const radialDist = geom.innerR + (d - 0.5) * geom.widthRad;
  const sideOffset = c * geom.perpOffset;
  
  return {
    x: geom.center + radialDist * u.x + sideOffset * v.x,
    y: geom.center + radialDist * u.y + sideOffset * v.y
  };
}

// Get global circular track positions
function getGlobalTrackPosition(globalCellIndex, playerCount) {
  // To keep drawing consistent, map global cell back to color index and steps
  // There are 13 cells per player. Global cell indices range from 0 to 13N - 1
  const colorIndex = Math.floor(globalCellIndex / 13);
  const steps = globalCellIndex % 13;
  return getCellPosition(colorIndex, steps, playerCount, false);
}

// ----------------------------------------------------
// Piece Smooth Hopping and Capturing Animations Engine
// ----------------------------------------------------
let visualPieces = {};
let gameLoopActive = false;

function initVisualPieces(room) {
  room.players.forEach((player, pIndex) => {
    if (!visualPieces[player.id]) {
      visualPieces[player.id] = [];
      const pieceSteps = room.pieces[player.id] || [-1, -1, -1, -1];
      
      pieceSteps.forEach((steps, pieceIndex) => {
        const target = getStaticPiecePosition(player.id, pIndex, steps, pieceIndex, room);
        visualPieces[player.id].push({
          x: target.x,
          y: target.y,
          steps: steps,
          pathQueue: []
        });
      });
    }
  });
}

function syncVisualPieces(room) {
  initVisualPieces(room);
  
  room.players.forEach((player, pIndex) => {
    const currentSteps = room.pieces[player.id] || [-1, -1, -1, -1];
    const visualList = visualPieces[player.id];
    if (!visualList) return;
    
    currentSteps.forEach((steps, pieceIndex) => {
      const visual = visualList[pieceIndex];
      if (!visual) return;
      const oldSteps = visual.steps;
      
      if (steps !== oldSteps) {
        visual.steps = steps;
        
        if (steps > oldSteps && oldSteps >= -1) {
          // Hopping forward cell-by-cell!
          for (let s = oldSteps + 1; s <= steps; s++) {
            const stepPos = getStaticPiecePosition(player.id, pIndex, s, pieceIndex, room);
            visual.pathQueue.push(stepPos);
          }
        } else {
          // Slide back straight to base (captured)
          visual.pathQueue = []; // Clear
          const homePos = getStaticPiecePosition(player.id, pIndex, steps, pieceIndex, room);
          visual.pathQueue.push(homePos); // Add final home position to queue for sliding
        }
      }
    });
  });
}

// Helper: Calculate standard coordinates before stack adjustments
function getStaticPiecePosition(playerId, playerIndex, steps, pieceIndex, room) {
  const geom = getBoardCoordinates(room.playerCount);
  let pos = { x: 0, y: 0 };
  
  if (steps === -1) {
    const baseAngle = geom.armAngles[playerIndex] - Math.PI / room.playerCount;
    const baseDist = geom.innerR + (geom.outerR - geom.innerR) * 0.78;
    const baseX = geom.center + baseDist * Math.cos(baseAngle);
    const baseY = geom.center + baseDist * Math.sin(baseAngle);
    const baseSize = boardScale * 0.088;
    const padsAngles = [Math.PI/4, 3*Math.PI/4, 5*Math.PI/4, 7*Math.PI/4];
    const padDist = baseSize * 0.52;
    
    pos.x = baseX + padDist * Math.cos(padsAngles[pieceIndex]);
    pos.y = baseY + padDist * Math.sin(padsAngles[pieceIndex]);
  } else if (steps === (13 * room.playerCount + 2)) {
    const angle = geom.armAngles[playerIndex];
    const centerDist = geom.innerR * 0.55;
    pos.x = geom.center + centerDist * Math.cos(angle);
    pos.y = geom.center + centerDist * Math.sin(angle);
    
    const offsetAngles = [0, Math.PI/2, Math.PI, 3*Math.PI/2];
    const offsetDist = geom.widthRad * 0.12;
    pos.x += offsetDist * Math.cos(offsetAngles[pieceIndex]);
    pos.y += offsetDist * Math.sin(offsetAngles[pieceIndex]);
  } else if (steps >= 13 * room.playerCount - 3) {
    const homeStepsIdx = steps - (13 * room.playerCount - 3);
    pos = getCellPosition(playerIndex, homeStepsIdx, room.playerCount, true);
  } else {
    const globalIdx = (13 * playerIndex + 2 + steps) % (13 * room.playerCount);
    pos = getGlobalTrackPosition(globalIdx, room.playerCount);
  }
  return pos;
}

// 60FPS Game tick update loops
function animateVisualTick(room) {
  const speed = boardScale * 0.018; // Velocity

  room.players.forEach((player) => {
    const visualList = visualPieces[player.id];
    if (!visualList) return;

    visualList.forEach((visual) => {
      if (visual.pathQueue.length > 0) {
        const target = visual.pathQueue[0];
        const dx = target.x - visual.x;
        const dy = target.y - visual.y;
        const dist = Math.hypot(dx, dy);

        if (dist < speed) {
          visual.x = target.x;
          visual.y = target.y;
          visual.pathQueue.shift();
        } else {
          visual.x += (dx / dist) * speed;
          visual.y += (dy / dist) * speed;
        }
      }
    });
  });

  // Always redraw on every animation frame for 60FPS fluid updates!
  drawLudoBoard(room, true);
}

function startGameLoop(room) {
  if (gameLoopActive) return;
  gameLoopActive = true;
  
  const tick = () => {
    if (!gameLoopActive) return;
    animateVisualTick(room);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function stopGameLoop() {
  gameLoopActive = false;
}

// Draw the entire Ludo board dynamically
function drawLudoBoard(room, fromAnimation = false) {
  // If canvas width or board scale is 0/falsy, force setup resolution
  if (canvas.width === 0 || boardScale === 0) {
    setupCanvasResolution();
  }
  if (!canvas.width) return;
  
  if (!fromAnimation) {
    setupCanvasResolution();
    syncVisualPieces(room);
  }
  
  const geom = getBoardCoordinates(room.playerCount);
  
  // Clear canvas
  ctx.clearRect(0, 0, boardScale, boardScale);
  
  // 1. Draw Star Outer Polygon Border & Background
  ctx.beginPath();
  for (let p = 0; p < room.playerCount; p++) {
    const angle = geom.armAngles[p];
    const prevAngle = geom.armAngles[(p - 1 + room.playerCount) % room.playerCount];
    const midAngle = angle - Math.PI / room.playerCount;
    
    const outerRadius = geom.outerR + geom.perpOffset;
    const cornerRadius = geom.innerR + geom.perpOffset * 1.5;
    
    // Outer arm tip left
    const pt1 = getArmCorner(geom.center, angle, geom.outerR + geom.perpOffset * 0.7, -geom.perpOffset * 1.5);
    ctx.lineTo(pt1.x, pt1.y);
    
    // Tip center cell
    const pt2 = getArmCorner(geom.center, angle, geom.outerR + geom.perpOffset * 0.7, 0);
    ctx.lineTo(pt2.x, pt2.y);
    
    // Outer arm tip right
    const pt3 = getArmCorner(geom.center, angle, geom.outerR + geom.perpOffset * 0.7, geom.perpOffset * 1.5);
    ctx.lineTo(pt3.x, pt3.y);
    
    // Inner valley corner
    const valleyX = geom.center + cornerRadius * Math.cos(midAngle);
    const valleyY = geom.center + cornerRadius * Math.sin(midAngle);
    ctx.lineTo(valleyX, valleyY);
  }
  ctx.closePath();
  ctx.fillStyle = '#0f172a';
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 30;
  ctx.fill();
  ctx.shadowBlur = 0; // reset
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.stroke();

  // 2. Draw each player's private base (Yard circles)
  room.players.forEach((player, idx) => {
    const baseColor = player.color;
    const theme = COLOR_THEMES[baseColor];
    
    // Position bases in valleys between arms
    const baseAngle = geom.armAngles[idx] - Math.PI / room.playerCount;
    const baseDist = geom.innerR + (geom.outerR - geom.innerR) * 0.78;
    const baseX = geom.center + baseDist * Math.cos(baseAngle);
    const baseY = geom.center + baseDist * Math.sin(baseAngle);
    const baseSize = boardScale * 0.088; // size radius
    
    // Base ring shadow
    ctx.beginPath();
    ctx.arc(baseX, baseY, baseSize + 5, 0, 2 * Math.PI);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.4)';
    ctx.fill();

    // Base body fill
    ctx.beginPath();
    ctx.arc(baseX, baseY, baseSize, 0, 2 * Math.PI);
    const gradient = ctx.createRadialGradient(baseX - 5, baseY - 5, 5, baseX, baseY, baseSize);
    gradient.addColorStop(0, theme.secondary);
    gradient.addColorStop(1, theme.primary);
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.stroke();

    // Renders 4 circular slots for pieces
    const padsAngles = [Math.PI/4, 3*Math.PI/4, 5*Math.PI/4, 7*Math.PI/4];
    const padDist = baseSize * 0.52;
    for (let k = 0; k < 4; k++) {
      const padX = baseX + padDist * Math.cos(padsAngles[k]);
      const padY = baseY + padDist * Math.sin(padsAngles[k]);
      ctx.beginPath();
      ctx.arc(padX, padY, baseSize * 0.28, 0, 2 * Math.PI);
      ctx.fillStyle = '#0f172a';
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.stroke();
    }
  });

  // 3. Draw Track Cells
  for (let p = 0; p < room.playerCount; p++) {
    const baseColor = PLAYER_COLORS(room.playerCount)[p];
    const theme = COLOR_THEMES[baseColor];
    
    // Render the 13 outer cells for each arm
    for (let s = 0; s < 13; s++) {
      const pos = getCellPosition(p, s, room.playerCount, false);
      const isStart = s === 2; // Starting cells index 2
      const isTip = s === 6;   // Tip star cell index 6
      
      // Cell background fill
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, geom.widthRad * 0.42, 0, 2 * Math.PI);
      
      if (isStart) {
        ctx.fillStyle = theme.primary; // Start color
      } else {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.04)'; // Default grid track cell background
      }
      ctx.fill();
      
      // Border outlines
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = isStart ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.06)';
      ctx.stroke();
      
      // Draw Stars/Safe shields inside specific slots
      if (isStart || isTip) {
        ctx.fillStyle = isStart ? '#ffffff' : theme.primary;
        drawStarSymbol(ctx, pos.x, pos.y, 5, geom.widthRad * 0.18, geom.widthRad * 0.09);
      }
    }

    // Render 5 Home Stretch cells per player
    for (let h = 0; h < 5; h++) {
      const pos = getCellPosition(p, h, room.playerCount, true);
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, geom.widthRad * 0.42, 0, 2 * Math.PI);
      ctx.fillStyle = theme.light; // Translucent glow colors
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = theme.primary + '50'; // Semi-transparent colored borders
      ctx.stroke();
    }
  }

  // 4. Center Home area
  ctx.beginPath();
  ctx.arc(geom.center, geom.center, geom.innerR, 0, 2 * Math.PI);
  ctx.fillStyle = '#0f172a';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.stroke();

  // Draw Center Home Triangles/Sectors pointing to middle
  for (let p = 0; p < room.playerCount; p++) {
    const angle1 = geom.armAngles[p] - Math.PI / room.playerCount;
    const angle2 = geom.armAngles[p] + Math.PI / room.playerCount;
    const baseColor = PLAYER_COLORS(room.playerCount)[p];
    const theme = COLOR_THEMES[baseColor];

    ctx.beginPath();
    ctx.moveTo(geom.center, geom.center);
    ctx.arc(geom.center, geom.center, geom.innerR - 1, angle1, angle2);
    ctx.closePath();
    ctx.fillStyle = theme.primary + '20';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = theme.primary + '50';
    ctx.stroke();
    
    // Glowing ring near center tips
    const innerTipDist = geom.innerR * 0.55;
    const tipX = geom.center + innerTipDist * Math.cos(geom.armAngles[p]);
    const tipY = geom.center + innerTipDist * Math.sin(geom.armAngles[p]);
    ctx.beginPath();
    ctx.arc(tipX, tipY, geom.widthRad * 0.32, 0, 2 * Math.PI);
    ctx.fillStyle = theme.primary;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#ffffff50';
    ctx.stroke();
  }

  // 5. Draw active Player Pieces
  // Group pieces by visual key to manage overlapping stacks
  const occupancyMap = {};
  
  room.players.forEach((player, pIndex) => {
    const pieceSteps = room.pieces[player.id];
    const visualList = visualPieces[player.id];
    if (!pieceSteps || !visualList) return;

    pieceSteps.forEach((steps, pieceIndex) => {
      const visual = visualList[pieceIndex];
      if (!visual) return;
      
      let key = '';
      if (steps === -1) {
        key = `base_${player.id}_${pieceIndex}`;
      } else if (steps === (13 * room.playerCount + 2)) {
        key = `finished_${player.id}_${pieceIndex}`;
      } else if (steps >= 13 * room.playerCount - 3) {
        const homeStepsIdx = steps - (13 * room.playerCount - 3);
        key = `homeStretch_${player.id}_${homeStepsIdx}`;
      } else {
        const globalIdx = (13 * pIndex + 2 + steps) % (13 * room.playerCount);
        key = `track_${globalIdx}`;
      }
      
      if (!occupancyMap[key]) occupancyMap[key] = [];
      occupancyMap[key].push({
        id: player.id,
        playerName: player.name,
        color: player.color,
        pieceIndex,
        steps,
        visualState: visual
      });
    });
  });

  // Render visual pieces with stacking offsets applied ONLY to static (non-animating) pieces
  for (const cellKey in occupancyMap) {
    const list = occupancyMap[cellKey];
    const len = list.length;
    
    list.forEach((item, j) => {
      let drawX = item.visualState.x;
      let drawY = item.visualState.y;
      
      // If the piece is NOT actively hopping in a path, apply visual stack offsets so they disperse neatly!
      if (len > 1 && item.visualState.pathQueue.length === 0 && !cellKey.startsWith('base') && !cellKey.startsWith('finished')) {
        const offsetR = geom.widthRad * 0.22;
        const offsetAngle = j * (2 * Math.PI / len);
        drawX += offsetR * Math.cos(offsetAngle);
        drawY += offsetR * Math.sin(offsetAngle);
      }
      
      // Cache coordinates for mouse hitboxes lookup
      item.renderedX = drawX;
      item.renderedY = drawY;

      // Draw shadow circle
      ctx.beginPath();
      ctx.arc(drawX, drawY + 2, geom.widthRad * 0.32, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fill();

      // Check if this is my piece and it is legal to move
      const isMovable = isMyTurn && validMoveIndexes.includes(item.pieceIndex) && item.id === socket.id;

      // Draw active halos for selection cues
      if (isMovable) {
        ctx.beginPath();
        ctx.arc(drawX, drawY, geom.widthRad * 0.38, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
      }

      // Draw Piece Core
      const theme = COLOR_THEMES[item.color];
      const pRadius = geom.widthRad * 0.28;
      
      ctx.beginPath();
      ctx.arc(drawX, drawY, pRadius, 0, 2 * Math.PI);
      const pieceGrad = ctx.createRadialGradient(drawX - 2, drawY - 2, 2, drawX, drawY, pRadius);
      pieceGrad.addColorStop(0, theme.secondary);
      pieceGrad.addColorStop(1, theme.primary);
      ctx.fillStyle = pieceGrad;
      ctx.fill();
      
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#ffffff80';
      ctx.stroke();

      // Draw a sleek inner dot to make it look premium
      ctx.beginPath();
      ctx.arc(drawX, drawY, pRadius * 0.4, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#ffffff50';
      ctx.stroke();
    });
  }

  // Keep reference of current lists for mouse-click triggers
  renderedPiecesCache = occupancyMap;
}

// Global cached variable for clicking interactions
let renderedPiecesCache = {};

// Click coordinate mapping handler to detect piece selections
canvas.addEventListener('click', (event) => {
  if (!isMyTurn || validMoveIndexes.length === 0) return;

  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width / (window.devicePixelRatio || 1);
  const scaleY = canvas.height / rect.height / (window.devicePixelRatio || 1);
  
  const clickX = (event.clientX - rect.left) * scaleX;
  const clickY = (event.clientY - rect.top) * scaleY;

  let clickedPiece = null;
  let minDistance = 22; // Click radius hitbox

  // Scan all rendered active pieces
  for (const cellKey in renderedPiecesCache) {
    const list = renderedPiecesCache[cellKey];
    list.forEach((item) => {
      // Must be a valid movable piece belonging to the active player client
      if (item.id === socket.id && validMoveIndexes.includes(item.pieceIndex)) {
        const dist = Math.hypot(clickX - item.renderedX, clickY - item.renderedY);
        if (dist < minDistance) {
          minDistance = dist;
          clickedPiece = item;
        }
      }
    });
  }

  if (clickedPiece !== null) {
    console.log(`Clicked valid piece ${clickedPiece.pieceIndex}!`);
    socket.emit('movePiece', { pieceIndex: clickedPiece.pieceIndex });
    validMoveIndexes = []; // Reset indicators
  }
});

// Helper: Calculate polygon arm edge coordinates for Ludo layout geometry
function getArmCorner(center, angle, radius, perpOffset) {
  const u = { x: Math.cos(angle), y: Math.sin(angle) };
  const v = { x: -Math.sin(angle), y: Math.cos(angle) };
  return {
    x: center + radius * u.x + perpOffset * v.x,
    y: center + radius * u.y + perpOffset * v.y
  };
}

// Draw star symbols inside canvas path cells
function drawStarSymbol(context, cx, cy, spikes, outerRadius, innerRadius) {
  let rot = Math.PI / 2 * 3;
  let x = cx;
  let y = cy;
  const step = Math.PI / spikes;

  context.beginPath();
  context.moveTo(cx, cy - outerRadius);
  for (let i = 0; i < spikes; i++) {
    x = cx + Math.cos(rot) * outerRadius;
    y = cy + Math.sin(rot) * outerRadius;
    context.lineTo(x, y);
    rot += step;

    x = cx + Math.cos(rot) * innerRadius;
    y = cy + Math.sin(rot) * innerRadius;
    context.lineTo(x, y);
    rot += step;
  }
  context.lineTo(cx, cy - outerRadius);
  context.closePath();
  context.fill();
}
