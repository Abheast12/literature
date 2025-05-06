"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useRouter } from "next/navigation"

export default function LandingPage() {
  const [username, setUsername] = useState("")
  const [lobbyCode, setLobbyCode] = useState("")
  const [error, setError] = useState("")
  const router = useRouter()

  const handleCreateLobby = () => {
    if (!username.trim()) {
      setError("Username cannot be empty")
      return
    }

    // Generate a random 6-character lobby code if none is provided
    const generatedCode = lobbyCode.trim() || Math.random().toString(36).substring(2, 8).toUpperCase()

    // Store username in localStorage for persistence
    localStorage.setItem("username", username)

    // Navigate to the lobby page with the generated code
    router.push(`/lobby/${generatedCode}?admin=true`)
  }

  const handleJoinLobby = () => {
    if (!username.trim()) {
      setError("Username cannot be empty")
      return
    }

    if (!lobbyCode.trim()) {
      setError("Lobby code cannot be empty")
      return
    }

    // Store username in localStorage for persistence
    localStorage.setItem("username", username)

    // Navigate to the lobby page with the provided code
    router.push(`/lobby/${lobbyCode}`)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold">Literature</CardTitle>
          <CardDescription>The classic card game of memory and teamwork</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="username" className="text-sm font-medium">
              Your Name
            </label>
            <Input
              id="username"
              placeholder="Enter your name"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="lobbyCode" className="text-sm font-medium">
              Lobby Code
            </label>
            <Input
              id="lobbyCode"
              placeholder="Enter lobby code to join or create"
              value={lobbyCode}
              onChange={(e) => setLobbyCode(e.target.value.toUpperCase())}
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}
        </CardContent>
        <CardFooter className="flex flex-col space-y-2">
          <Button className="w-full" onClick={handleCreateLobby}>
            Create New Lobby
          </Button>
          <Button className="w-full" variant="outline" onClick={handleJoinLobby}>
            Join Existing Lobby
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}