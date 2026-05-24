const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Port configuration (Vercel/Render friendly)
const PORT = process.env.PORT || 3000;

// Room State Store
const rooms = {};

// Color mappings for players
const PLAYER_COLORS = {
  2: ['red', 'yellow'],
  3: ['red', 'green', 'blue'],
  4: ['red', 'green', 'yellow', 'blue'],
  5: ['red', 'green', 'yellow', 'blue', 'purple'],
  6: ['red', 'green', 'yellow', 'blue', 'purple', 'orange']
};

// Generates a unique 5-letter alphanumeric room code
function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No easily confused characters like O, 0, I, 1
  let code;
  do {
    code = '';
    for (let i = 0; i < 5; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  } while (rooms[code]);
  return code;
}

// Socket handlers
io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // 1. Create Room
  socket.on('createRoom', ({ name, playerCount }) => {
    const count = parseInt(playerCount);
    if (![2, 3, 4, 5, 6].includes(count)) {
      return socket.emit('errorMsg', 'Invalid player count. Choose 2, 3, 4, 5, or 6.');
    }
    if (!name || name.trim() === '') {
      return socket.emit('errorMsg', 'Please enter a valid nickname.');
    }

    const roomCode = generateRoomCode();
    rooms[roomCode] = {
      code: roomCode,
      playerCount: count,
      status: 'lobby', // 'lobby', 'playing', 'finished'
      hostId: socket.id,
      players: [
        {
          id: socket.id,
          name: name.trim(),
          colorIndex: 0,
          color: PLAYER_COLORS[count][0],
          active: true,
          isFinished: false,
          finishRank: 0
        }
      ],
      turnIndex: 0,
      diceValue: null,
      diceRolled: false,
      consecutiveSixes: 0,
      pieces: {}, // Format: { [socketId]: [step1, step2, step3, step4] }
      winners: [], // List of player socket IDs who completed the game
      lastRollMsg: '',
      history: []
    };

    socket.join(roomCode);
    socket.emit('roomJoined', { roomCode, isHost: true });
    io.to(roomCode).emit('roomUpdated', rooms[roomCode]);
    console.log(`Room created: ${roomCode} by ${name}`);
  });

  // 2. Join Room
  socket.on('joinRoom', ({ name, roomCode }) => {
    if (!roomCode) return socket.emit('errorMsg', 'Room code is required.');
    const code = roomCode.trim().toUpperCase();
    const room = rooms[code];

    if (!room) {
      return socket.emit('errorMsg', 'Room not found.');
    }
    if (room.status !== 'lobby') {
      return socket.emit('errorMsg', 'This game has already started.');
    }
    if (!name || name.trim() === '') {
      return socket.emit('errorMsg', 'Please enter a valid nickname.');
    }
    if (room.players.length >= room.playerCount) {
      return socket.emit('errorMsg', 'This lobby is full.');
    }
    if (room.players.some(p => p.name.toLowerCase() === name.trim().toLowerCase())) {
      return socket.emit('errorMsg', 'This name is already taken in the lobby.');
    }

    const colorIndex = room.players.length;
    const color = PLAYER_COLORS[room.playerCount][colorIndex];

    const newPlayer = {
      id: socket.id,
      name: name.trim(),
      colorIndex,
      color,
      active: true,
      isFinished: false,
      finishRank: 0
    };

    room.players.push(newPlayer);
    socket.join(code);
    socket.emit('roomJoined', { roomCode: code, isHost: false });
    io.to(code).emit('roomUpdated', room);
    console.log(`Player ${name} joined room ${code}`);
  });

  // 3. Start Game
  socket.on('startGame', () => {
    const roomCode = getSocketRoom(socket);
    if (!roomCode) return;
    const room = rooms[roomCode];
    if (!room) return;

    if (room.hostId !== socket.id) {
      return socket.emit('errorMsg', 'Only the host can start the game.');
    }

    // Initialize all pieces
    room.players.forEach((player) => {
      room.pieces[player.id] = [-1, -1, -1, -1]; // -1 represents inside the home yard
    });

    room.status = 'playing';
    room.turnIndex = 0;
    room.diceValue = null;
    room.diceRolled = false;
    room.consecutiveSixes = 0;
    room.winners = [];
    room.lastRollMsg = 'Game started! Red (Player 1) goes first.';
    room.history.push({ type: 'info', text: room.lastRollMsg });

    io.to(roomCode).emit('gameStarted', room);
    io.to(roomCode).emit('roomUpdated', room);
    console.log(`Game started in room ${roomCode}`);
  });

  // 4. Roll Dice
  socket.on('rollDice', () => {
    const roomCode = getSocketRoom(socket);
    if (!roomCode) return;
    const room = rooms[roomCode];
    if (!room || room.status !== 'playing') return;

    const currentPlayer = room.players[room.turnIndex];
    if (currentPlayer.id !== socket.id) {
      return socket.emit('errorMsg', "It's not your turn!");
    }
    if (room.diceRolled) {
      return socket.emit('errorMsg', 'You have already rolled the dice!');
    }

    const roll = Math.floor(Math.random() * 6) + 1;
    room.diceValue = roll;
    room.diceRolled = true;

    room.lastRollMsg = `${currentPlayer.name} rolled a ${roll}!`;
    room.history.push({ type: 'roll', player: currentPlayer.name, color: currentPlayer.color, roll });

    // Handle Consecutive 6s Rule
    if (roll === 6) {
      room.consecutiveSixes++;
      if (room.consecutiveSixes === 3) {
        room.lastRollMsg = `${currentPlayer.name} rolled three 6s! Turn forfeited.`;
        room.history.push({ type: 'alert', text: room.lastRollMsg });
        room.consecutiveSixes = 0;
        advanceTurn(room);
        io.to(roomCode).emit('roomUpdated', room);
        return;
      }
    } else {
      room.consecutiveSixes = 0;
    }

    // Determine if any moves are valid
    const playerPieces = room.pieces[socket.id];
    const maxSteps = 13 * room.playerCount + 2; // Steps required to finish
    const validMoves = [];

    playerPieces.forEach((steps, index) => {
      if (steps === -1) {
        // Can only exit base on a 6
        if (roll === 6) validMoves.push(index);
      } else if (steps < maxSteps) {
        // Can move if it does not overshoot Center Home
        if (steps + roll <= maxSteps) {
          validMoves.push(index);
        }
      }
    });

    // If no valid moves, advance the turn immediately
    if (validMoves.length === 0) {
      room.lastRollMsg += ' No valid moves available.';
      room.history.push({ type: 'info', text: `${currentPlayer.name} has no valid moves.` });
      // Clear roll status and advance turn
      setTimeout(() => {
        advanceTurn(room);
        io.to(roomCode).emit('roomUpdated', room);
      }, 1500); // 1.5 second delay to let players see the roll
    }

    io.to(roomCode).emit('diceRolled', { roll, validMoves, consecutiveSixes: room.consecutiveSixes });
    io.to(roomCode).emit('roomUpdated', room);
  });

  // 5. Move Piece
  socket.on('movePiece', ({ pieceIndex }) => {
    const roomCode = getSocketRoom(socket);
    if (!roomCode) return;
    const room = rooms[roomCode];
    if (!room || room.status !== 'playing') return;

    const currentPlayer = room.players[room.turnIndex];
    if (currentPlayer.id !== socket.id) {
      return socket.emit('errorMsg', "It's not your turn!");
    }
    if (!room.diceRolled) {
      return socket.emit('errorMsg', 'Please roll the dice first!');
    }

    const roll = room.diceValue;
    const playerPieces = room.pieces[socket.id];
    const steps = playerPieces[pieceIndex];
    const maxSteps = 13 * room.playerCount + 2;

    // Validate if the move is actually legal
    let nextSteps;
    if (steps === -1) {
      if (roll !== 6) return socket.emit('errorMsg', 'Must roll a 6 to exit home base!');
      nextSteps = 0;
    } else if (steps + roll <= maxSteps) {
      nextSteps = steps + roll;
    } else {
      return socket.emit('errorMsg', 'Invalid move! Piece overshoots home.');
    }

    // Execute Move
    playerPieces[pieceIndex] = nextSteps;
    let captureOccurred = false;
    let capturePlayerName = '';

    // Check for combat/collisions if the piece is on the outer track
    if (nextSteps >= 0 && nextSteps <= 13 * room.playerCount - 4) {
      const globalCell = getGlobalCellIndex(currentPlayer.colorIndex, nextSteps, room.playerCount);
      
      // Look for opponent pieces occupying this global cell
      for (const player of room.players) {
        if (player.id === socket.id || player.isFinished) continue;

        const opponentPieces = room.pieces[player.id];
        opponentPieces.forEach((opSteps, opIndex) => {
          if (opSteps >= 0 && opSteps <= 13 * room.playerCount - 4) {
            const opGlobalCell = getGlobalCellIndex(player.colorIndex, opSteps, room.playerCount);
            
            if (globalCell === opGlobalCell) {
              // Check if the cell is a Safe Zone
              const isSafe = isSafeCell(globalCell, room.playerCount);
              if (!isSafe) {
                // CAPTURE!
                opponentPieces[opIndex] = -1; // Send back to home base
                captureOccurred = true;
                capturePlayerName = player.name;
                room.history.push({
                  type: 'capture',
                  attacker: currentPlayer.name,
                  attackerColor: currentPlayer.color,
                  victim: player.name,
                  victimColor: player.color
                });
              }
            }
          }
        });
      }
    }

    // Check if player won/finished this piece
    let pieceFinishedMsg = '';
    if (nextSteps === maxSteps) {
      pieceFinishedMsg = ` piece ${pieceIndex + 1} reached Home!`;
      room.history.push({ type: 'info', text: `${currentPlayer.name}'s piece reached the center home!` });
    }

    // Check if player has finished ALL 4 pieces
    const allFinished = playerPieces.every(s => s === maxSteps);
    if (allFinished && !currentPlayer.isFinished) {
      currentPlayer.isFinished = true;
      room.winners.push(currentPlayer.id);
      currentPlayer.finishRank = room.winners.length;
      room.history.push({
        type: 'win',
        text: `🏆 ${currentPlayer.name} finished in Rank #${currentPlayer.finishRank}!`,
        color: currentPlayer.color
      });
    }

    // Check Game End Condition:
    // Game ends if only 1 active player is left who hasn't finished, OR if everyone has finished.
    const playingPlayersCount = room.players.filter(p => !p.isFinished).length;
    if (playingPlayersCount <= 1 || room.winners.length === room.playerCount) {
      room.status = 'finished';
      room.lastRollMsg = 'Game Over! All placements decided.';
      room.history.push({ type: 'alert', text: 'Game Over! All ranks have been decided.' });
      io.to(roomCode).emit('gameOver', room);
    } else {
      // Determine if they get another turn:
      // In Ludo, you get an extra turn if you roll a 6, OR if you capture a piece, OR if your piece reaches home.
      // However, if consecutiveSixes is already active, rolling 6 is already accounted for.
      const extraTurn = (roll === 6 && room.consecutiveSixes > 0) || captureOccurred || (nextSteps === maxSteps);
      
      if (extraTurn && !currentPlayer.isFinished) {
        room.diceRolled = false;
        room.diceValue = null;
        let bonusReason = 'rolled a 6';
        if (captureOccurred) bonusReason = `captured ${capturePlayerName}'s piece`;
        else if (nextSteps === maxSteps) bonusReason = 'brought a piece Home';
        
        room.lastRollMsg = `${currentPlayer.name} gets a bonus turn for ${bonusReason}!`;
        room.history.push({ type: 'info', text: room.lastRollMsg });
      } else {
        advanceTurn(room);
      }
    }

    io.to(roomCode).emit('roomUpdated', room);
  });

  // 6. Return to Lobby
  socket.on('returnToLobby', () => {
    const roomCode = getSocketRoom(socket);
    if (!roomCode) return;
    const room = rooms[roomCode];
    if (!room || room.status !== 'finished') return;

    if (room.hostId !== socket.id) {
      return socket.emit('errorMsg', 'Only the host can reset the game.');
    }

    // Generate a fresh, entirely different Room Code to allow endless separate sessions
    const newRoomCode = generateRoomCode();
    const oldPlayers = [...room.players];
    
    // Create the new room structure
    rooms[newRoomCode] = {
      code: newRoomCode,
      playerCount: room.playerCount,
      status: 'lobby',
      hostId: socket.id,
      players: oldPlayers.map((p, i) => ({
        id: p.id,
        name: p.name,
        colorIndex: i,
        color: PLAYER_COLORS[room.playerCount][i],
        active: p.active,
        isFinished: false,
        finishRank: 0
      })),
      turnIndex: 0,
      diceValue: null,
      diceRolled: false,
      consecutiveSixes: 0,
      pieces: {},
      winners: [],
      lastRollMsg: '',
      history: []
    };

    // Make all players in the old room join the new room code
    io.to(roomCode).emit('lobbyReset', { newRoomCode });
    delete rooms[roomCode]; // Delete the old room
    console.log(`Lobby reset: Room ${roomCode} moved to ${newRoomCode}`);
  });

  // 7. Manual Disconnect
  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
    
    // Find room the socket was in
    for (const code in rooms) {
      const room = rooms[code];
      const playerIndex = room.players.findIndex(p => p.id === socket.id);
      
      if (playerIndex !== -1) {
        const player = room.players[playerIndex];
        player.active = false;
        
        console.log(`Player ${player.name} marked disconnected in room ${code}`);
        
        // If it's a lobby, we can just remove them
        if (room.status === 'lobby') {
          room.players.splice(playerIndex, 1);
          // Re-index remaining colors
          room.players.forEach((p, idx) => {
            p.colorIndex = idx;
            p.color = PLAYER_COLORS[room.playerCount][idx];
          });
          
          if (room.players.length === 0) {
            delete rooms[code];
            console.log(`Deleted empty lobby room: ${code}`);
          } else {
            // Re-assign host if the host disconnected
            if (room.hostId === socket.id) {
              room.hostId = room.players[0].id;
            }
            io.to(code).emit('roomUpdated', room);
          }
        } else {
          // If playing, check if ALL players are disconnected
          const allDisconnected = room.players.every(p => !p.active);
          if (allDisconnected) {
            delete rooms[code];
            console.log(`Deleted inactive game room: ${code}`);
          } else {
            // Notify other players
            room.history.push({ type: 'info', text: `Player ${player.name} disconnected.` });
            
            // If it was their turn, advance the turn
            if (room.turnIndex === playerIndex && room.status === 'playing') {
              // Wait 5 seconds for them to reconnect, then auto-advance
              setTimeout(() => {
                const currentRoomState = rooms[code];
                if (currentRoomState && !player.active && currentRoomState.turnIndex === playerIndex) {
                  currentRoomState.history.push({ type: 'info', text: `Skipping disconnected player ${player.name}'s turn.` });
                  advanceTurn(currentRoomState);
                  io.to(code).emit('roomUpdated', currentRoomState);
                }
              }, 5000);
            }
            
            io.to(code).emit('roomUpdated', room);
          }
        }
        break;
      }
    }
  });
});

// Helper: Advance Ludo Sequential Turn
function advanceTurn(room) {
  room.diceRolled = false;
  room.diceValue = null;
  room.consecutiveSixes = 0;

  let attempts = 0;
  do {
    room.turnIndex = (room.turnIndex + 1) % room.players.length;
    attempts++;
  } while (
    (room.players[room.turnIndex].isFinished || !room.players[room.turnIndex].active) && 
    attempts < room.players.length
  );

  const nextPlayer = room.players[room.turnIndex];
  room.lastRollMsg = `It is now ${nextPlayer.name}'s turn.`;
  room.history.push({ type: 'info', text: room.lastRollMsg });
}

// Helper: Translate player local step to global cell index
function getGlobalCellIndex(colorIndex, steps, playerCount) {
  // Start space of player p is at index: 13 * p + 2
  const startCell = 13 * colorIndex + 2;
  const totalTrackCells = 13 * playerCount;
  return (startCell + steps) % totalTrackCells;
}

// Helper: Detect if a global track cell is a safe zone
function isSafeCell(globalCell, playerCount) {
  // Safe zones are:
  // 1. Starting spaces: 13 * p + 2 for each player p
  // 2. Tip spaces: 13 * p + 6 for each player p (the star cells at the ends of arms)
  for (let p = 0; p < playerCount; p++) {
    const startingSpace = 13 * p + 2;
    const tipSpace = 13 * p + 6;
    if (globalCell === startingSpace || globalCell === tipSpace) {
      return true;
    }
  }
  return false;
}

// Helper: Get room name socket is currently in
function getSocketRoom(socket) {
  const socketRooms = Array.from(socket.rooms);
  return socketRooms.find(r => r !== socket.id);
}

// Bind to port
server.listen(PORT, () => {
  console.log(`Ludo Real-time Game Server running on port ${PORT}`);
});
