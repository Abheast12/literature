"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { PlayingCard } from "@/components/playing-card"
import { PlayerPosition } from "@/components/player-position"
import { DeclareSetDialog } from "@/components/declare-set-dialog"
import { AskCardDialog } from "@/components/ask-card-dialog"
import { GameOverDialog } from "@/components/game-over-dialog"
import { connectSocket, disconnectSocket, getSocket } from "@/lib/socket"

// Game state types
type CardValue = "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K" | "A" | "JOKER"
type CardSuit = "hearts" | "diamonds" | "clubs" | "spades" | "red" | "black"
type Team = "A" | "B"

interface GameCard {
  id: string
  value: CardValue
  suit: CardSuit
  set: string
}

interface Player {
  id: string
  name: string
  team: Team
  cards: GameCard[] | number
}

interface DeclaredSet {
  set: string
  team: Team
  cards: GameCard[]
}

interface GameState {
  players: Player[]
  currentTurn: string
  declaredSets: DeclaredSet[]
  gameOver: boolean
  winningTeam: Team | null
}

export default function GamePage() {
  const router = useRouter()
  const params = useParams()
  const { toast } = useToast()
  const lobbyCode = params.code as string

  const [gameState, setGameState] = useState<GameState | null>(null)
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null)
  const [askDialogOpen, setAskDialogOpen] = useState(false)
  const [declareDialogOpen, setDeclareDialogOpen] = useState(false)
  const [gameOverDialogOpen, setGameOverDialogOpen] = useState(false)
  const [socketConnected, setSocketConnected] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [username, setUsername] = useState("")
  const [currentPlayerId, setCurrentPlayerId] = useState("")
  const [isLoading, setIsLoading] = useState(true)

 // Fix how current player ID is determined
useEffect(() => {
  // Get username from localStorage
  const storedUsername = localStorage.getItem("username")
  if (storedUsername) {
    setUsername(storedUsername)
  } else {
    // Redirect to landing page if no username
    router.push("/")
  }
  
  // Connect to socket server
  try {
    const socketInstance = connectSocket(storedUsername || "", lobbyCode)
    
    // Other socket event handlers...
    socketInstance.on("turn_changed", (data) => {
      console.log("Turn changed:", data)
  
      setGameState((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          currentTurn: data.currentTurn,
        };
      });
  
      const newTurnPlayerName = gameState?.players.find((p) => p.id === data.currentTurn)?.name || "another player";
      
      toast({
        title: data.success === false ? "Card not found" : "Turn changed",
        description: data.success === false 
          ? `${data.fromPlayer} asked ${data.toPlayer} for a card but it wasn't found. It's now ${newTurnPlayerName}'s turn.`
          : `It's now ${newTurnPlayerName}'s turn`,
      })
    })
  
    socketInstance.on("card_received", (data) => {
      console.log("Card received:", data)
  
      setGameState((prev) => {
        if (!prev) return prev
  
        // Add the card to the current player's hand
        const updatedPlayers = prev.players.map((player) => {
          if (player.id === currentPlayerId && Array.isArray(player.cards)) {
            return {
              ...player,
              cards: [...player.cards, data.card],
            }
          }
          return player
        })
  
        return {
          ...prev,
          players: updatedPlayers,
        }
      })
  
      toast({
        title: "Card found!",
        description: `You got a card from ${data.fromPlayer}`,
      })
    })
  
    socketInstance.on("card_given", (data) => {
      console.log("Card given:", data)
  
      setGameState((prev) => {
        if (!prev) return prev
  
        // Remove the card from the current player's hand
        const updatedPlayers = prev.players.map((player) => {
          if (player.id === currentPlayerId && Array.isArray(player.cards)) {
            return {
              ...player,
              cards: player.cards.filter((card) => card.id !== data.cardId),
            }
          }
          return player
        })
  
        return {
          ...prev,
          players: updatedPlayers,
        }
      })
  
      toast({
        title: "Card given",
        description: `You gave a card to ${data.toPlayer}`,
      })
    })
    
    
    socketInstance.on("game_state", (data) => {
      console.log("Game state received:", data)
      // Find current player by NAME, not by ID
      const currentPlayer = data.players.find((p: Player) => p.name === storedUsername)
      if (currentPlayer) {
        setCurrentPlayerId(currentPlayer.id)
        setGameState(data)
      }
    })
    
    socketInstance.on("game_started", (data) => {
      console.log("Game started event received:", data)
      // Find current player by NAME, not by ID
      const currentPlayer = data.players.find((p: Player) => p.name === storedUsername)
      if (currentPlayer) {
        setCurrentPlayerId(currentPlayer.id)
        setGameState(data)
      } else {
        console.error("Could not find current player in game data")
      }
    })
  } catch (error) {
    console.error("Error setting up socket:", error)
  }
}, [lobbyCode, router, username, currentPlayerId])

  // If game state is not loaded yet, show loading
  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
        <div className="text-white text-xl mb-4">Loading game...</div>
        {connectionError && <div className="text-red-400 text-sm mb-4">{connectionError}</div>}
        <div className="text-white text-sm mb-6">
          {socketConnected ? "Connected to server" : "Connecting to server..."}
        </div>
        <Button onClick={() => router.push(`/lobby/${lobbyCode}`)}>Return to Lobby</Button>
      </div>
    )
  }

  // Assert gameState is non-null since we've passed the loading check
  const gameStateNonNull = gameState!
  const currentPlayer = gameStateNonNull.players.find((p) => p.id === currentPlayerId)
  const isCurrentPlayerTurn = gameStateNonNull.currentTurn === currentPlayerId

  // Get team scores
  const teamAScore = gameStateNonNull.declaredSets.filter((set) => set.team === "A").length
  const teamBScore = gameStateNonNull.declaredSets.filter((set) => set.team === "B").length

  const handlePlayerClick = (player: Player) => {
    if (!isCurrentPlayerTurn) {
      toast({
        title: "Not your turn",
        description: "Please wait for your turn to ask for cards",
        variant: "destructive",
      })
      return
    }
    
    if (player.id === currentPlayerId) return
    if (player.cards === 0 || (Array.isArray(player.cards) && player.cards.length === 0)) return
    if (currentPlayer && player.team === currentPlayer.team) return
  
    setSelectedPlayer(player)
    setAskDialogOpen(true)
  }

  const handleAskCard = (card: GameCard) => {
    setAskDialogOpen(false)

    if (!selectedPlayer) return

    const socket = getSocket()
    if (socket && socket.connected) {
      console.log("Asking for card:", card.id, "from player:", selectedPlayer.id)
      socket.emit("ask_card", {
        lobbyCode,
        playerId: selectedPlayer.id,
        cardId: card.id,
      })
    } else {
      toast({
        title: "Connection error",
        description: "Not connected to the game server",
        variant: "destructive",
      })
    }

    setSelectedPlayer(null)
  }

  const handleDeclareSet = (setName: string, declarations: Record<string, string[]>) => {
    setDeclareDialogOpen(false)

    const socket = getSocket()
    if (socket && socket.connected) {
      console.log("Declaring set:", setName, "with declarations:", declarations)
      socket.emit("declare_set", {
        lobbyCode,
        setName,
        declarations,
      })
    } else {
      toast({
        title: "Connection error",
        description: "Not connected to the game server",
        variant: "destructive",
      })
    }
  }

  const handlePlayAgain = () => {
    const socket = getSocket()
    if (socket && socket.connected) {
      socket.emit("play_again", { lobbyCode })
    }
    setGameOverDialogOpen(false)
    router.push(`/lobby/${lobbyCode}`)
  }

  // Reposition players so current player is at the bottom (position 0)
  // Fix the repositionPlayers function
const repositionPlayers = () => {
  if (!gameState || !currentPlayerId) return [];
  
  // Get the current player from the state
  const currentPlayer = gameState.players.find(p => p.id === currentPlayerId);
  if (!currentPlayer) return gameState.players;
  
  // Get all players in the game
  const allPlayers = [...gameState.players];
  
  // Find the index of the current player
  const currentPlayerIndex = allPlayers.findIndex(p => p.id === currentPlayerId);
  
  // If player not found, return all players in original order
  if (currentPlayerIndex === -1) return allPlayers;
  
  // Rotate the array so current player is at index 0
  return [
    ...allPlayers.slice(currentPlayerIndex),
    ...allPlayers.slice(0, currentPlayerIndex)
  ];
};

  const positionedPlayers = repositionPlayers()

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex flex-col">
      {/* Game header */}
      <div className="p-4 flex justify-between items-center bg-slate-800">
        <div className="flex items-center space-x-4">
          <div className="text-sm">Lobby: {lobbyCode}</div>
          <div className="text-sm">
            Turn:{" "}
            <span className={`font-bold ${isCurrentPlayerTurn ? "text-green-400" : ""}`}>
              {gameStateNonNull.players.find((p) => p.id === gameStateNonNull.currentTurn)?.name}
              {isCurrentPlayerTurn ? " (Your Turn)" : ""}
            </span>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-red-500 mr-2"></div>
            <span>Team A: {teamAScore}</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-blue-500 mr-2"></div>
            <span>Team B: {teamBScore}</span>
          </div>
        </div>
      </div>

      {/* Game table */}
      <div className="flex-1 relative overflow-hidden">
        {/* Center table with declared sets */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-[80%] h-[80%] rounded-full bg-slate-700 flex">
            {/* Team A sets (left side) */}
            <div className="w-1/2 h-full flex items-center justify-center p-4">
              <div className="grid grid-cols-3 gap-2">
                {gameStateNonNull.declaredSets
                  .filter((set) => set.team === "A")
                  .map((declaredSet, index) => (
                    <div key={`set-a-${index}`} className="text-center">
                      <div className="text-xs mb-1">{declaredSet.set}</div>
                      <div className="flex justify-center">
                        <PlayingCard card={declaredSet.cards[0]} small />
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* Team B sets (right side) */}
            <div className="w-1/2 h-full flex items-center justify-center p-4">
              <div className="grid grid-cols-3 gap-2">
                {gameStateNonNull.declaredSets
                  .filter((set) => set.team === "B")
                  .map((declaredSet, index) => (
                    <div key={`set-b-${index}`} className="text-center">
                      <div className="text-xs mb-1">{declaredSet.set}</div>
                      <div className="flex justify-center">
                        <PlayingCard card={declaredSet.cards[0]} small />
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>

        {/* Players positioned in a circle */}
        <div className="absolute inset-0">
          {positionedPlayers.map((player, index) => (
            <PlayerPosition
              key={player.id}
              player={player}
              position={index}
              isCurrentPlayer={player.id === currentPlayerId}
              isCurrentTurn={player.id === gameStateNonNull.currentTurn}
              onClick={() => handlePlayerClick(player)}
            />
          ))}
        </div>
      </div>

      {/* Current player's hand */}
      <div className="p-4 bg-slate-800">
        <div className="flex justify-between items-center mb-2">
          <div className="text-sm">
            Your Cards ({Array.isArray(currentPlayer?.cards) ? currentPlayer.cards.length : 0})
          </div>
          {isCurrentPlayerTurn && (
            <Button
              onClick={() => setDeclareDialogOpen(true)}
              disabled={!Array.isArray(currentPlayer?.cards) || currentPlayer.cards.length === 0}
            >
              Declare Set
            </Button>
          )}
        </div>
        <div className="flex justify-center overflow-x-auto py-2">
          <div className="flex space-x-2">
            {Array.isArray(currentPlayer?.cards) &&
              currentPlayer.cards
                .sort((a, b) => {
                  if (a.suit !== b.suit) return a.suit.localeCompare(b.suit)
                  const valueOrder = "23456789TJQKA"
                  return valueOrder.indexOf(a.value[0]) - valueOrder.indexOf(b.value[0])
                })
                .map((card) => <PlayingCard key={card.id} card={card} />)}
          </div>
        </div>
      </div>

      {/* Ask card dialog */}
      <AskCardDialog
        open={askDialogOpen}
        onClose={() => setAskDialogOpen(false)}
        player={selectedPlayer || { name: "", id: "" }}
        currentPlayer={currentPlayer}
        onAsk={handleAskCard}
      />

      {/* Declare set dialog */}
      <DeclareSetDialog
        open={declareDialogOpen}
        onClose={() => setDeclareDialogOpen(false)}
        currentPlayer={currentPlayer}
        teammates={gameStateNonNull.players.filter((p) => p.team === currentPlayer?.team && p.id !== currentPlayerId)}
        onDeclare={handleDeclareSet}
      />

      {/* Game over dialog */}
      <GameOverDialog
        open={gameOverDialogOpen}
        onClose={() => setGameOverDialogOpen(false)}
        winningTeam={gameStateNonNull.winningTeam || ""}
        currentPlayerTeam={currentPlayer?.team || ""}
        onPlayAgain={handlePlayAgain}
      />
    </div>
  )
}
