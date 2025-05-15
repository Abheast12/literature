"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { X, Clock, Users } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { connectSocket, disconnectSocket, getSocket } from "@/lib/socket"

interface Player {
  id: string
  name: string
  team: "A" | "B"
  isAdmin: boolean
}

export default function LobbyPage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const lobbyCode = params.code as string
  const isAdmin = searchParams.get("admin") === "true"

  const [players, setPlayers] = useState<Player[]>([])
  const [turnTime, setTurnTime] = useState(30)
  const [username, setUsername] = useState("")
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    // Get username from localStorage
    const storedUsername = localStorage.getItem("username")
    if (storedUsername) {
      setUsername(storedUsername)
    } else {
      // Redirect to landing page if no username
      router.push("/")
      return
    }

    // Connect to the Socket.io server
    try {
      const socketInstance = connectSocket(storedUsername, lobbyCode, isAdmin)

      socketInstance.on("connect", () => {
        console.log("Connected to lobby socket")
        setConnected(true)
        toast({
          title: "Connected to lobby",
          description: `You've joined lobby ${lobbyCode}`,
        })
      })

      socketInstance.on("player_joined", (data) => {
        console.log("Players in lobby:", data.players)
        setPlayers(data.players)
      })

      socketInstance.on("player_left", (data) => {
        setPlayers(data.players)

        if (data.kickedPlayerName) {
          toast({
            title: "Player kicked",
            description: `${data.kickedPlayerName} has been removed from the lobby`,
          })
        }
      })

      socketInstance.on("player_disconnected", (data) => {
        toast({
          title: "Player disconnected",
          description: `${data.playerName} has disconnected`,
          variant: "destructive",
        })
      })

      socketInstance.on("settings_updated", (data) => {
        setTurnTime(data.settings.turnTime)
      })

      socketInstance.on("admin_assigned", () => {
        toast({
          title: "You are now the admin",
          description: "The previous admin left the lobby",
        })

        // Refresh the page to update the admin status
        router.refresh()
      })

      socketInstance.on("kicked", () => {
        toast({
          title: "You were kicked",
          description: "You have been removed from the lobby",
          variant: "destructive",
        })
        router.push("/")
      })

      socketInstance.on("error", (data) => {
        toast({
          title: "Error",
          description: data.message,
          variant: "destructive",
        })
      })

      socketInstance.on("game_started", () => {
        console.log("Game started, navigating to game page")
        router.push(`/game/${lobbyCode}`)
      })

      socketInstance.on("game_reset", () => {
        toast({
          title: "Game reset",
          description: "The game has been reset",
        })
      })
    } catch (error) {
      console.error("Error connecting to socket:", error)
      toast({
        title: "Connection error",
        description: "Could not connect to the game server",
        variant: "destructive",
      })
    }

    return () => {
      // Clean up socket connection
      disconnectSocket()
    }
  }, [lobbyCode, router, toast, isAdmin])

  const handleStartGame = () => {
    if (players.length !== 6) {
      toast({
        title: "Cannot start game",
        description: "You need exactly 6 players to start the game",
        variant: "destructive",
      })
      return
    }

    const socket = getSocket()
    if (socket && socket.connected) {
      // Emit the start_game event to the server
      socket.emit("start_game", { lobbyCode, turnTime })
      console.log("Emitted start_game event")
    } else {
      toast({
        title: "Connection error",
        description: "Not connected to the game server",
        variant: "destructive",
      })
    }
  }

  const handleKickPlayer = (playerId: string) => {
    const socket = getSocket()
    if (socket && socket.connected) {
      socket.emit("kick_player", { lobbyCode, playerId })
    } else {
      toast({
        title: "Connection error",
        description: "Not connected to the game server",
        variant: "destructive",
      })
    }
  }

  const handleToggleTeam = (playerId: string) => {
    const socket = getSocket()
    if (socket && socket.connected) {
      socket.emit("toggle_team", { lobbyCode, playerId })
    } else {
      toast({
        title: "Connection error",
        description: "Not connected to the game server",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-4">
      <Card className="w-full max-w-3xl">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-2xl">Lobby: {lobbyCode}</CardTitle>
              <CardDescription>{connected ? "Connected" : "Connecting..."}</CardDescription>
            </div>
            <Badge variant={isAdmin ? "default" : "outline"}>{isAdmin ? "Admin" : "Player"}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold mb-2 flex items-center">
              <Users className="mr-2 h-5 w-5" />
              Players ({players.length}/6)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {players.map((player) => (
                <div key={player.id} className="flex items-center justify-between p-2 border rounded-md">
                  <div className="flex items-center">
                    <Badge variant={player.team === "A" ? "default" : "secondary"} className="mr-2">
                      Team {player.team}
                    </Badge>
                    <span>
                      {player.name} {player.name === username && "(You)"}
                    </span>
                  </div>
                  {isAdmin && player.name !== username && (
                    <div className="flex items-center space-x-2">
                      <Button variant="ghost" size="sm" onClick={() => handleToggleTeam(player.id)}>
                        Switch Team
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleKickPlayer(player.id)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}

              {Array.from({ length: Math.max(0, 6 - players.length) }).map((_, i) => (
                <div
                  key={`empty-${i}`}
                  className="flex items-center justify-center p-2 border rounded-md border-dashed text-muted-foreground"
                >
                  Waiting for player...
                </div>
              ))}
            </div>
          </div>

          {isAdmin && (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="turn-time" className="flex items-center">
                    <Clock className="mr-2 h-5 w-5" />
                    Turn Time Limit
                  </Label>
                  <span>{turnTime} seconds</span>
                </div>
                <Slider
                  id="turn-time"
                  min={10}
                  max={60}
                  step={5}
                  value={[turnTime]}
                  onValueChange={(value) => setTurnTime(value[0])}
                />
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="outline" onClick={() => router.push("/")}>
            Leave Lobby
          </Button>
          {isAdmin && (
            <Button onClick={handleStartGame} disabled={players.length !== 6}>
              Start Game
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  )
}
