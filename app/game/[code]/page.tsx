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
import { createDeck, shuffleArray } from "@/lib/game-utils"

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
  seatingOrder: string[]
}

function rotateArray<T>(arr: T[], startIdx: number): T[] {
  return [...arr.slice(startIdx), ...arr.slice(0, startIdx)];
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

  // Function to force start the game (for debugging purposes)
  const forceStartGame = () => {
    // Connect to socket server
    try {
      const socketInstance = connectSocket(username, lobbyCode)

      socketInstance.on("connect", () => {
        console.log("Connected to socket server in game")
        setSocketConnected(true)
        setConnectionError(null)

        // Let the server know we're in the game page
        socketInstance.emit("join_game", { lobbyCode })

        // If we're already in the game page but haven't received game state,
        // request it from the server
        if (!gameState) {
          socketInstance.emit("request_game_state", { lobbyCode })
        }
      })

      socketInstance.on("connect_error", (err) => {
        console.error("Socket connection error:", err)
        setConnectionError(`Connection error: ${err.message}`)
      })

      // Add handler for game state request response
      socketInstance.on("game_state", (data) => {
        console.log("Game state received:", data)
        const currentPlayer = data.players.find((p: Player) => p.name === username)
        if (currentPlayer) {
          setCurrentPlayerId(currentPlayer.id)
          setGameState(data)
        }
      })

      socketInstance.on("game_started", (data) => {
        console.log("Game started event received:", data)

        // Find the current player's ID based on the username
        const currentPlayer = data.players.find((p: Player) => p.name === username)

        if (currentPlayer) {
          setCurrentPlayerId(currentPlayer.id)
          console.log("Current player ID:", currentPlayer.id)

          // Set the game state with the received data
          setGameState(data)
        } else {
          console.error("Could not find current player in game data")
        }
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
          description: `You got the card from ${data.fromPlayer}`,
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

      socketInstance.on("card_counts_updated", (data) => {
        console.log("Card counts updated:", data)

        setGameState((prev) => {
          if (!prev) return prev;
          // Replace the full players array with the server's data
          return {
            ...prev,
            players: data.players.map((p: any) => ({
              ...p,
              cards: p.id === currentPlayerId ? prev.players.find(pl => pl.id === p.id)?.cards : p.cardCount
            }))
          };
        });
      })

      socketInstance.on("turn_changed", (data) => {
        console.log("Turn changed:", data)

        setGameState((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            currentTurn: data.currentTurn,
            players: data.players || prev.players // use server's player list if provided
          };
        });

        toast({
          title: "Turn changed",
          description: `It's now ${gameState?.players.find((p) => p.id === data.currentTurn)?.name}'s turn`,
        })
      })

      socketInstance.on("set_declared", (data) => {
        console.log("Set declared:", data)

        // Update the game state with the new declared set
        setGameState((prev) => {
          if (!prev) return prev

          // Update card counts for all players
          const updatedPlayers = prev.players.map((player) => {
            if (player.id !== currentPlayerId) {
              const updatedCount = data.players.find((p: { id: string, cardCount: number }) => p.id === player.id)?.cardCount || 0
              return {
                ...player,
                cards: updatedCount,
              }
            } else if (Array.isArray(player.cards)) {
              // Remove cards from the declared set from current player's hand
              return {
                ...player,
                cards: player.cards.filter((card) => card.set !== data.setName),
              }
            }
            return player
          })

          return {
            ...prev,
            players: updatedPlayers,
            declaredSets: data.declaredSets,
            currentTurn: data.currentTurn,
          }
        })

        toast({
          title: data.isValid ? "Declaration successful!" : "Declaration failed!",
          description: data.isValid
            ? `Team ${data.team} has won the ${data.setName} set!`
            : `The declaration was incorrect. Team ${data.team} gets the ${data.setName} set.`,
          variant: data.isValid ? "default" : "destructive",
        })
      })

      socketInstance.on("game_over", (data) => {
        console.log("Game over:", data)

        setGameState((prev) => {
          if (!prev) return prev

          return {
            ...prev,
            gameOver: true,
            winningTeam: data.winningTeam,
            declaredSets: data.declaredSets,
          }
        })

        setGameOverDialogOpen(true)
      })
    } catch (error) {
      console.error("Error setting up socket:", error)
    }
  }

  // If game state is not loaded yet, show loading
  if (!gameState) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
        <div className="text-white text-xl mb-4">Loading game...</div>
        {connectionError && <div className="text-red-400 text-sm mb-4">{connectionError}</div>}
        <div className="text-white text-sm mb-6">
          {socketConnected ? "Connected to server" : "Connecting to server..."}
        </div>
      </div>
    )
  }

  const currentPlayer = gameState.players.find((p) => p.id === currentPlayerId)
  const isCurrentPlayerTurn = gameState.currentTurn === currentPlayerId

  // Get team scores
  const teamAScore = gameState.declaredSets.filter((set) => set.team === "A").length
  const teamBScore = gameState.declaredSets.filter((set) => set.team === "B").length

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

  // Replace the handleAskCard function with this improved version
  const handleAskCard = (card: GameCard) => {
    if (!isCurrentPlayerTurn) {
      toast({
        title: "Not your turn",
        description: "Please wait for your turn to ask for cards",
        variant: "destructive",
      })
      return
    }

    setAskDialogOpen(false)
    if (!selectedPlayer) return

    const socket = getSocket()
    if (socket && socket.connected) {
      socket.emit("ask_card", {
        lobbyCode,
        playerId: selectedPlayer.id,
        cardId: card.id,
      })
    }
  }

  const handleDeclareSet = (setName: string, declarations: Record<string, string[]>) => {
    setDeclareDialogOpen(false)

    const socket = getSocket()
    if (socket && socket.connected) {
      socket.emit("declare_set", {
        lobbyCode,
        setName,
        declarations,
      })
    }
  }

  const handlePlayAgain = () => {
    const socket = getSocket()
    if (socket && socket.connected) {
      socket.emit("play_again", { lobbyCode })
    }
    setGameOverDialogOpen(false)
  }

  // Replace the repositionPlayers function with this improved version
  const repositionPlayers = () => {
    if (!gameState || !currentPlayer) return gameState?.players || [];

    // Use the seatingOrder from the server
    const seatingOrderIds: string[] = (gameState as any).seatingOrder || gameState.players.map(p => p.id);
    const orderedPlayers = seatingOrderIds.map(id => gameState.players.find(p => p.id === id)).filter(Boolean) as Player[];

    // Rotate so current player is at index 0
    const myIdx = orderedPlayers.findIndex(p => p.id === currentPlayer.id);
    return rotateArray(orderedPlayers, myIdx);
  };

  const positionedPlayers = repositionPlayers();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex flex-col">
      {/* Game header */}
      <div className="p-4 flex justify-between items-center bg-slate-800">
        <div className="flex items-center space-x-4">
          <div className="text-sm">Lobby: {lobbyCode}</div>
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
                {gameState.declaredSets
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
                {gameState.declaredSets
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
              isCurrentTurn={player.id === gameState.currentTurn}
              onClick={() => handlePlayerClick(player)}
            />
          ))}
        </div>
      </div>

      {/* Current player's hand and turn display */}
      <div className="p-4 bg-slate-800">
        <div className="flex justify-between items-center mb-2">
          <div className="text-sm">
            Your Cards ({Array.isArray(currentPlayer?.cards) ? currentPlayer.cards.length : 0})
          </div>
          <div className="text-sm font-bold">
            Current Turn: {gameState.players.find((p) => p.id === gameState.currentTurn)?.name}
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
        teammates={gameState.players.filter((p) => p.team === currentPlayer?.team && p.id !== currentPlayerId)}
        onDeclare={handleDeclareSet}
      />

      {/* Game over dialog */}
      <GameOverDialog
        open={gameOverDialogOpen}
        onClose={() => setGameOverDialogOpen(false)}
        winningTeam={gameState.winningTeam || ""}
        currentPlayerTeam={currentPlayer?.team || ""}
        onPlayAgain={handlePlayAgain}
      />
    </div>
  )
}
