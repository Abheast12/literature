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
import { connectSocket } from "@/lib/socket"
import { Socket } from "socket.io-client"

interface Player {
  id: string
  name: string
  team: string
  isAdmin?: boolean
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
  const [socket, setSocket] = useState<Socket | null>(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    // Get username from localStorage
    const storedUsername = localStorage.getItem("username")
    if (storedUsername) {
      setUsername(storedUsername)
    } else {
      // Redirect to landing page if no username
      router.push("/")
      return // Exit early if no username
    }

    // Connect to the Socket.io server
    try {
      const socketInstance = connectSocket(storedUsername, lobbyCode, isAdmin)
      setSocket(socketInstance)

      socketInstance.on("connect", () => {
        setConnected(true)
        toast({
          title: "Connected to lobby",
          description: `You've joined lobby ${lobbyCode}`,
        })
      })

      socketInstance.on("game_starting", () => {
        // Navigate to the game page for non-admin players
        if (!isAdmin) {
          router.push(`/game/${lobbyCode}`)
        }
      })

      socketInstance.on("player_joined", (data) => {
        console.log("Players in lobby:", data.players)
        setPlayers(data.players)
      })

      socketInstance.on("player_left", (data) => {
        console.log("Player left, remaining players:", data.players)
        setPlayers(data.players)
      })

      socketInstance.on("settings_updated", (data) => {
        setTurnTime(data.settings.turnTime)
      })

      socketInstance.on("admin_assigned", () => {
        toast({
          title: "You are now the admin",
          description: "The previous admin left the lobby",
        })
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

      socketInstance.on("player_updated", (data) => {
        console.log("Players updated:", data.players)
        setPlayers(data.players)
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
      if (socket) {
        socket.disconnect()
      }
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

    if (socket && socket.connected) {
      // Emit the start_game event to the server
      socket.emit("start_game", { lobbyCode, turnTime })

      // Navigate to the game page
      router.push(`/game/${lobbyCode}`)
    } else {
      toast({
        title: "Connection error",
        description: "Not connected to the game server",
        variant: "destructive",
      })
    }
  }

  const handleKickPlayer = (playerId: string) => {
    if (socket && socket.connected) {
      socket.emit("kick_player", { lobbyCode, playerId })
    }
  }

  const handleToggleTeam = (playerId: string) => {
    if (socket && socket.connected) {
      socket.emit("toggle_team", { lobbyCode, playerId })
    }
  }

  const currentPlayer = players.find((p) => p.id === username)

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
                    <span>{player.name}</span>
                    {player.isAdmin && <Badge variant="outline" className="ml-2">Admin</Badge>}
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
              <div>
                <Label htmlFor="turn-time" className="flex items-center">
                  <Clock className="mr-2 h-4 w-4" />
                  Turn Time: {turnTime} seconds
                </Label>
                <Slider
                  id="turn-time"
                  min={15}
                  max={60}
                  step={5}
                  value={[turnTime]}
                  onValueChange={(value) => {
                    setTurnTime(value[0])
                    if (socket && socket.connected) {
                      socket.emit("update_settings", { lobbyCode, settings: { turnTime: value[0] } })
                    }
                  }}
                />
              </div>

              <Button
                className="w-full"
                onClick={handleStartGame}
                disabled={players.length !== 6 || !connected}
              >
                Start Game
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
