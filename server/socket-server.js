const { Server } = require("socket.io")
const http = require("http")
const express = require("express")
const cors = require("cors")

const app = express()
app.use(cors())

const server = http.createServer(app)
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
  },
})

// Store active lobbies
const lobbies = new Map()

// Socket.io connection handler
io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`)
  console.log("Auth data:", socket.handshake.auth)

  const { username, lobbyCode, isAdmin } = socket.handshake.auth

  // Join or create a lobby
  if (lobbyCode) {
    // Create lobby if it doesn't exist
    if (!lobbies.has(lobbyCode)) {
      console.log(`Creating new lobby: ${lobbyCode}`)
      lobbies.set(lobbyCode, {
        players: [],
        admin: isAdmin ? socket.id : null,
        gameState: null,
        settings: {
          turnTime: 30,
        },
      })
    }

    const lobby = lobbies.get(lobbyCode)

    // Check if player already exists in the lobby
    const existingPlayerIndex = lobby.players.findIndex(p => p.id === socket.id)
    if (existingPlayerIndex !== -1) {
      // Update the existing player's socket ID and name
      lobby.players[existingPlayerIndex].id = socket.id
      lobby.players[existingPlayerIndex].name = username
      console.log(`Player ${username} reconnected to lobby ${lobbyCode}`)
    } else {
      // Add new player to lobby
      const player = {
        id: socket.id,
        name: username,
        team: lobby.players.length % 2 === 0 ? "A" : "B",
        isAdmin,
      }
      lobby.players.push(player)
      console.log(`Player ${username} joined lobby ${lobbyCode}`)
    }

    // Join the socket room for this lobby
    socket.join(lobbyCode)

    // Notify all clients in the lobby about the updated player list
    io.to(lobbyCode).emit("player_joined", {
      players: lobby.players,
      settings: lobby.settings,
    })

    // Set up admin if this is the first player
    if (isAdmin && !lobby.admin) {
      lobby.admin = socket.id
    }
  }

  // Handle player leaving
  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`)

    // Find the lobby this player was in
    for (const [code, lobby] of lobbies.entries()) {
      const playerIndex = lobby.players.findIndex((p) => p.id === socket.id)

      if (playerIndex !== -1) {
        // Remove player from lobby
        const removedPlayer = lobby.players.splice(playerIndex, 1)[0]
        console.log(`Player ${removedPlayer.name} left lobby ${code}`)

        // If admin left, assign a new admin
        if (socket.id === lobby.admin && lobby.players.length > 0) {
          lobby.admin = lobby.players[0].id
          lobby.players[0].isAdmin = true

          // Notify the new admin
          io.to(lobby.admin).emit("admin_assigned")
        }

        // Notify remaining players
        io.to(code).emit("player_left", {
          players: lobby.players,
          settings: lobby.settings,
        })

        // Remove lobby if empty
        if (lobby.players.length === 0) {
          lobbies.delete(code)
          console.log(`Lobby ${code} deleted (empty)`)
        }

        break
      }
    }
  })

  // Handle kick player
  socket.on("kick_player", ({ lobbyCode, playerId }) => {
    const lobby = lobbies.get(lobbyCode)

    if (lobby && socket.id === lobby.admin) {
      const playerIndex = lobby.players.findIndex((p) => p.id === playerId)

      if (playerIndex !== -1) {
        // Remove player from lobby
        const kickedPlayer = lobby.players.splice(playerIndex, 1)[0]
        console.log(`Player ${kickedPlayer.name} was kicked from lobby ${lobbyCode}`)

        // Notify the kicked player
        io.to(playerId).emit("kicked")

        // Notify remaining players
        io.to(lobbyCode).emit("player_left", {
          players: lobby.players,
          settings: lobby.settings,
        })
      }
    }
  })

  // Handle toggle team
  socket.on("toggle_team", ({ lobbyCode, playerId }) => {
    const lobby = lobbies.get(lobbyCode)

    if (lobby && socket.id === lobby.admin) {
      const player = lobby.players.find((p) => p.id === playerId)

      if (player) {
        // Toggle team
        player.team = player.team === "A" ? "B" : "A"
        console.log(`Player ${player.name}'s team changed to ${player.team} in lobby ${lobbyCode}`)

        // Notify all players
        io.to(lobbyCode).emit("player_updated", {
          players: lobby.players,
        })
      }
    }
  })

  // Handle update settings
  socket.on("update_settings", ({ lobbyCode, settings }) => {
    const lobby = lobbies.get(lobbyCode)

    if (lobby && socket.id === lobby.admin) {
      lobby.settings = {
        ...lobby.settings,
        ...settings,
      }
      console.log(`Settings updated in lobby ${lobbyCode}:`, lobby.settings)

      // Notify all players
      io.to(lobbyCode).emit("settings_updated", {
        settings: lobby.settings,
      })
    }
  })

  // Handle start game
  socket.on("start_game", ({ lobbyCode }) => {
    const lobby = lobbies.get(lobbyCode)

    if (lobby && socket.id === lobby.admin) {
      console.log(`Starting game in lobby ${lobbyCode} with ${lobby.players.length} players`)

      // Initialize game state
      const gameState = initializeGame(lobby.players)
      lobby.gameState = gameState

      // Notify all players that the game is starting
      io.to(lobbyCode).emit("game_starting")

      // Send each player their cards
      lobby.players.forEach((player) => {
        const playerState = {
          ...gameState,
          // Only send this player's cards
          players: gameState.players.map((p) => ({
            ...p,
            cards: p.id === player.id ? p.cards : p.cards.length,
          })),
        }

        io.to(player.id).emit("game_started", playerState)
      })
    }
  })

  // Handle ask card
  socket.on("ask_card", ({ lobbyCode, playerId, cardId }) => {
    const lobby = lobbies.get(lobbyCode)
    if (!lobby || !lobby.gameState) return

    const askingPlayer = lobby.gameState.players.find(p => p.id === socket.id)
    const targetPlayer = lobby.gameState.players.find(p => p.id === playerId)

    if (!askingPlayer || !targetPlayer) return

    // Check if it's the asking player's turn
    if (lobby.gameState.currentTurn !== socket.id) {
      socket.emit("error", { message: "It's not your turn" })
      return
    }

    // Check if the target player has the card
    const cardIndex = targetPlayer.cards.findIndex(c => c.id === cardId)
    if (cardIndex === -1) {
      // Card not found, switch turns
      lobby.gameState.currentTurn = playerId
      io.to(lobbyCode).emit("turn_changed", {
        currentTurn: playerId,
        players: lobby.gameState.players
      })
      return
    }

    // Transfer the card
    const card = targetPlayer.cards.splice(cardIndex, 1)[0]
    askingPlayer.cards.push(card)

    // Update all players with the new card counts and names
    io.to(lobbyCode).emit("card_counts_updated", {
      players: lobby.gameState.players.map(p => ({
        id: p.id,
        name: p.name,
        team: p.team,
        cardCount: p.cards.length
      }))
    })

    // Send the specific card to the asking player
    socket.emit("card_received", { card })
  })

  // Handle game state request
  socket.on("request_game_state", ({ lobbyCode }) => {
    const lobby = lobbies.get(lobbyCode)
    if (!lobby || !lobby.gameState) return

    const player = lobby.players.find(p => p.id === socket.id)
    if (!player) return

    const playerState = {
      ...lobby.gameState,
      players: lobby.gameState.players.map((p) => ({
        ...p,
        cards: p.id === socket.id ? p.cards : p.cards.length,
      })),
    }

    socket.emit("game_state", playerState)
  })

  // Rest of the socket handlers...
})

// Helper functions
function initializeGame(players) {
  // Create a deck of cards
  const deck = createDeck()

  // Shuffle the deck
  const shuffledDeck = shuffleArray(deck)

  // Deal cards to each player
  const cardsPerPlayer = Math.floor(shuffledDeck.length / players.length)
  const gameStatePlayers = players.map((player, index) => ({
    id: player.id,
    name: player.name,
    team: player.team,
    cards: shuffledDeck.slice(index * cardsPerPlayer, (index + 1) * cardsPerPlayer),
  }))

  // Randomly select a player to start
  const startingPlayerIndex = Math.floor(Math.random() * players.length)

  return {
    players: gameStatePlayers,
    currentTurn: players[startingPlayerIndex].id,
    declaredSets: [],
    gameOver: false,
    winningTeam: null,
  }
}

// Start the server
const PORT = process.env.PORT || 3001
server.listen(PORT, () => {
  console.log(`Socket.io server running on port ${PORT}`)
})

// Import game utility functions
const { createDeck, shuffleArray, getCardsInSet, canAskForCard, validateDeclaration } = require("./game-utils")