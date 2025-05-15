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

  const { username, lobbyCode, isAdmin } = socket.handshake.auth

  // Join or create a lobby
  if (lobbyCode) {
    // Create lobby if it doesn't exist
    if (!lobbies.has(lobbyCode)) {
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

    // Check if player already exists in the lobby (reconnection case)
    const existingPlayerIndex = lobby.players.findIndex((p) => p.name === username)

    if (existingPlayerIndex >= 0) {
      // Update the existing player's socket ID
      const existingPlayer = lobby.players[existingPlayerIndex]
      console.log(`Player ${username} reconnected with new socket ID: ${socket.id}`)

      // Update the socket ID in the player object
      existingPlayer.id = socket.id

      // If this player was the admin, update the admin ID
      if (existingPlayer.isAdmin) {
        lobby.admin = socket.id
      }
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

    // If the game has already started, update the game state with the new socket ID
    if (lobby.gameState) {
      const playerInGame = lobby.gameState.players.find((p) => p.name === username)
      if (playerInGame) {
        playerInGame.id = socket.id
      }
    }
  }

  // Handle join_game event
  socket.on("join_game", ({ lobbyCode }) => {
    console.log(`Player ${socket.id} (${username}) joined game in lobby ${lobbyCode}`)

    const lobby = lobbies.get(lobbyCode)
    if (!lobby) {
      socket.emit("error", { message: "Lobby not found" })
      return
    }

    // If the game has already started, send the current game state to the player
    if (lobby.gameState) {
      // Find the player in the game state by name
      const playerIndex = lobby.gameState.players.findIndex((p) => p.name === username)

      if (playerIndex !== -1) {
        // Update the player's socket ID in the game state
        lobby.gameState.players[playerIndex].id = socket.id

        // Create a personalized game state for this player
        const personalGameState = {
          ...lobby.gameState,
          players: lobby.gameState.players.map((p, i) => ({
            ...p,
            // Only send this player's cards in full detail
            cards: i === playerIndex ? p.cards : p.cards.length,
          })),
        }

        socket.emit("game_started", personalGameState)
        console.log(`Sent game state to player ${username}`)
      } else {
        socket.emit("error", { message: "Player not found in game" })
      }
    } else {
      socket.emit("error", { message: "Game has not started yet" })
    }
  })

  // Handle player leaving
  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`)

    // Find the lobby this player was in
    for (const [code, lobby] of lobbies.entries()) {
      const playerIndex = lobby.players.findIndex((p) => p.id === socket.id)

      if (playerIndex !== -1) {
        // Don't remove the player immediately, they might reconnect
        console.log(`Player ${lobby.players[playerIndex].name} disconnected from lobby ${code}`)

        // If admin left, assign a new admin
        if (socket.id === lobby.admin && lobby.players.length > 0) {
          const newAdminIndex = playerIndex === 0 ? 1 : 0
          if (newAdminIndex < lobby.players.length) {
            lobby.admin = lobby.players[newAdminIndex].id
            lobby.players[newAdminIndex].isAdmin = true

            // Notify the new admin
            io.to(lobby.admin).emit("admin_assigned")
          }
        }

        // Notify remaining players
        io.to(code).emit("player_disconnected", {
          playerId: socket.id,
          playerName: lobby.players[playerIndex].name,
        })

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

        // Notify the kicked player
        io.to(playerId).emit("kicked")

        // Notify remaining players
        io.to(lobbyCode).emit("player_left", {
          players: lobby.players,
          settings: lobby.settings,
          kickedPlayerName: kickedPlayer.name,
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

      // Notify all players
      io.to(lobbyCode).emit("settings_updated", {
        settings: lobby.settings,
      })
    }
  })

  // Handle start game
  socket.on("start_game", ({ lobbyCode }) => {
    const lobby = lobbies.get(lobbyCode)

    if (!lobby || socket.id !== lobby.admin) {
      socket.emit("error", { message: "Not authorized to start game" })
      return
    }

    if (lobby.players.length !== 6) {
      socket.emit("error", { message: "Need exactly 6 players to start the game" })
      return
    }

    console.log(
      `Starting game in lobby ${lobbyCode} with players:`,
      lobby.players.map((p) => p.name),
    )

    // Create a deck of cards
    const deck = createDeck()
    const shuffledDeck = shuffleArray(deck)

    // Assign cards to players
    const cardsPerPlayer = Math.floor(shuffledDeck.length / lobby.players.length)
    const gameStatePlayers = lobby.players.map((player, index) => ({
      id: player.id,
      name: player.name,
      team: player.team,
      cards: shuffledDeck.slice(index * cardsPerPlayer, (index + 1) * cardsPerPlayer),
    }))

    // Randomly select a player to start
    const startingPlayerIndex = Math.floor(Math.random() * lobby.players.length)

    // Create the game state
    lobby.gameState = {
      players: gameStatePlayers,
      currentTurn: lobby.players[startingPlayerIndex].id,
      declaredSets: [],
      gameOver: false,
      winningTeam: null,
    }

    console.log(`Game started. First turn: ${lobby.players[startingPlayerIndex].name}`)

    // Send each player their personalized game state
    lobby.players.forEach((player) => {
      const playerIndex = gameStatePlayers.findIndex((p) => p.id === player.id)

      const personalGameState = {
        ...lobby.gameState,
        players: gameStatePlayers.map((p, i) => ({
          ...p,
          // Only send this player's cards in full detail
          cards: i === playerIndex ? p.cards : p.cards.length,
        })),
      }

      io.to(player.id).emit("game_started", personalGameState)
      console.log(`Sent game state to ${player.name}`)
    })
  })

  // Handle ask for card
 // Improve the ask_card handler in socket-server.js
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

  // Find the asked card by ID
  const cardIndex = targetPlayer.cards.findIndex(c => c.id === cardId)
  const askingPlayerName = askingPlayer.name
  const targetPlayerName = targetPlayer.name

  if (cardIndex === -1) {
    // Card not found, switch turns
    lobby.gameState.currentTurn = playerId
    
    io.to(lobbyCode).emit("turn_changed", {
      currentTurn: playerId,
      fromPlayer: askingPlayerName,
      toPlayer: targetPlayerName,
      success: false
    })
    
    return
  }

  // Transfer the card
  const card = targetPlayer.cards.splice(cardIndex, 1)[0]
  askingPlayer.cards.push(card)

  // Update all players with the new card counts
  io.to(lobbyCode).emit("card_counts_updated", {
    players: lobby.gameState.players.map(p => ({
      id: p.id,
      name: p.name,
      team: p.team,
      cardCount: p.cards.length
    }))
  })

  // Send the specific card to the asking player
  socket.emit("card_received", { 
    card,
    fromPlayer: targetPlayerName 
  })
  
  // Send notification to the target player
  io.to(playerId).emit("card_given", {
    cardId: card.id,
    toPlayer: askingPlayerName
  })
})

  // Handle declare set
  socket.on("declare_set", ({ lobbyCode, setName, declarations }) => {
    const lobby = lobbies.get(lobbyCode)

    if (lobby && lobby.gameState) {
      const gameState = lobby.gameState

      // Check if it's this player's turn
      if (gameState.currentTurn !== socket.id) {
        socket.emit("error", {
          message: "It's not your turn",
        })
        return
      }

      console.log(`${gameState.players.find((p) => p.id === socket.id).name} is declaring set ${setName}`)

      // Validate the declaration
      const isValid = validateDeclaration(declarations, gameState.players, setName)

      // Get the declaring player's team
      const declaringPlayer = gameState.players.find((p) => p.id === socket.id)
      const declaringTeam = declaringPlayer.team

      // Get all cards in the set
      const setCards = getCardsInSet(setName)

      // Remove the cards from all players
      gameState.players.forEach((player) => {
        player.cards = player.cards.filter((card) => card.set !== setName)
      })

      // Add the set to declared sets
      gameState.declaredSets.push({
        set: setName,
        team: isValid ? declaringTeam : declaringTeam === "A" ? "B" : "A",
        cards: setCards,
      })

      console.log(
        `Declaration ${isValid ? "successful" : "failed"}. Set goes to Team ${isValid ? declaringTeam : declaringTeam === "A" ? "B" : "A"}`,
      )

      // Check if game is over
      const teamAScore = gameState.declaredSets.filter((set) => set.team === "A").length
      const teamBScore = gameState.declaredSets.filter((set) => set.team === "B").length

      if (teamAScore >= 5 || teamBScore >= 5) {
        gameState.gameOver = true
        gameState.winningTeam = teamAScore >= 5 ? "A" : "B"

        console.log(`Game over! Team ${gameState.winningTeam} wins!`)

        // Notify all players
        io.to(lobbyCode).emit("game_over", {
          winningTeam: gameState.winningTeam,
          declaredSets: gameState.declaredSets,
        })
      } else {
        // If the current player has no cards left, pass the turn
        if (declaringPlayer.cards.length === 0) {
          // Find next player from opposing team with cards
          const nextPlayer = gameState.players.find((p) => p.team !== declaringTeam && p.cards.length > 0)

          if (nextPlayer) {
            gameState.currentTurn = nextPlayer.id
            console.log(`${declaringPlayer.name} has no cards left. Turn passes to ${nextPlayer.name}`)
          }
        }

        // Notify all players
        io.to(lobbyCode).emit("set_declared", {
          setName,
          isValid,
          team: isValid ? declaringTeam : declaringTeam === "A" ? "B" : "A",
          declaredSets: gameState.declaredSets,
          currentTurn: gameState.currentTurn,
          players: gameState.players.map((p) => ({
            id: p.id,
            cardCount: p.cards.length,
          })),
        })
      }
    }
  })

  // Handle play again
  socket.on("play_again", ({ lobbyCode }) => {
    const lobby = lobbies.get(lobbyCode)

    if (lobby && socket.id === lobby.admin) {
      // Reset game state
      lobby.gameState = null

      // Notify all players
      io.to(lobbyCode).emit("game_reset", {
        players: lobby.players,
        settings: lobby.settings,
      })
    }
  })
})

// Helper functions
function createDeck() {
  // Create a deck of cards
  const suits = ["hearts", "diamonds", "clubs", "spades"]
  const lowValues = ["2", "3", "4", "5", "6", "7"]
  const highValues = ["9", "10", "J", "Q", "K", "A"]

  const cards = []

  // Add low value cards (2-7 of each suit)
  suits.forEach((suit) => {
    lowValues.forEach((value) => {
      cards.push({
        id: `${value}-${suit}`,
        value,
        suit,
        set: `low-${suit}`,
      })
    })
  })

  // Add high value cards (9-A of each suit)
  suits.forEach((suit) => {
    highValues.forEach((value) => {
      cards.push({
        id: `${value}-${suit}`,
        value,
        suit,
        set: `high-${suit}`,
      })
    })
  })

  // Add 8s and jokers
  suits.forEach((suit) => {
    cards.push({
      id: `8-${suit}`,
      value: "8",
      suit,
      set: "eights-jokers",
    })
  })

  cards.push({
    id: "joker-red",
    value: "JOKER",
    suit: "red",
    set: "eights-jokers",
  })

  cards.push({
    id: "joker-black",
    value: "JOKER",
    suit: "black",
    set: "eights-jokers",
  })

  return cards
}

function shuffleArray(array) {
  const newArray = [...array]
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[newArray[i], newArray[j]] = [newArray[j], newArray[i]]
  }
  return newArray
}

function getCardsInSet(setName) {
  // This is a simplified version - in a real implementation, you would have a complete deck definition
  const suits = ["hearts", "diamonds", "clubs", "spades"]
  const cards = []

  if (setName.startsWith("low-")) {
    const suit = setName.split("-")[1]
    for (let i = 2; i <= 7; i++) {
      cards.push({
        id: `${i}-${suit}`,
        value: i.toString(),
        suit,
        set: setName,
      })
    }
  } else if (setName.startsWith("high-")) {
    const suit = setName.split("-")[1]
    const values = ["9", "10", "J", "Q", "K", "A"]
    values.forEach((value) => {
      cards.push({
        id: `${value}-${suit}`,
        value,
        suit,
        set: setName,
      })
    })
  } else if (setName === "eights-jokers") {
    suits.forEach((suit) => {
      cards.push({
        id: `8-${suit}`,
        value: "8",
        suit,
        set: setName,
      })
    })
    cards.push({
      id: "joker-red",
      value: "JOKER",
      suit: "red",
      set: setName,
    })
    cards.push({
      id: "joker-black",
      value: "JOKER",
      suit: "black",
      set: setName,
    })
  }

  return cards
}

function validateDeclaration(declarations, players, setName) {
  // Get all cards that should be in the set
  const setCards = getCardsInSet(setName)
  const setCardIds = new Set(setCards.map((card) => card.id))

  // Get all cards that were declared
  const declaredCardIds = Object.values(declarations).flat()

  // Check if all cards in the set were declared
  if (declaredCardIds.length !== setCards.length) {
    return false
  }

  // Check if all declared cards are in the set
  if (!declaredCardIds.every((id) => setCardIds.has(id))) {
    return false
  }

  // Check if the declaration matches reality
  for (const playerId in declarations) {
    const player = players.find((p) => p.id === playerId)
    if (!player) return false

    const playerCardIds = new Set(player.cards.map((card) => card.id))

    // Check if the player has all the cards declared for them
    if (!declarations[playerId].every((id) => playerCardIds.has(id))) {
      return false
    }
  }

  return true
}

// Start the server
const PORT = process.env.PORT || 3001
server.listen(PORT, () => {
  console.log(`Socket.io server running on port ${PORT}`)
})
