import { io, type Socket } from "socket.io-client"

// This is a singleton pattern to ensure we only create one socket connection
let socket: Socket | null = null

interface SocketAuth {
  username: string
  lobbyCode: string
  isAdmin: boolean
}

export const getSocket = () => {
  return socket
}

export const connectSocket = (username: string, lobbyCode: string, isAdmin = false): Socket => {
  if (!socket) {
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001"
    console.log("Connecting to socket server at:", socketUrl)

    socket = io(socketUrl, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      auth: { username, lobbyCode, isAdmin },
    })

    // Add global error handler
    socket.on("error", (error) => {
      console.error("Socket error:", error)
    })

    // Add global disconnect handler
    socket.on("disconnect", (reason) => {
      console.log("Socket disconnected:", reason)
      // Clear the socket instance on disconnect
      socket = null
    })
  } else {
    // If socket exists but auth is different, disconnect and create new connection
    const currentAuth = socket.auth as SocketAuth
    if (currentAuth.username !== username || currentAuth.lobbyCode !== lobbyCode || currentAuth.isAdmin !== isAdmin) {
      socket.disconnect()
      socket = null
      return connectSocket(username, lobbyCode, isAdmin)
    }

    // Reconnect if not connected
    if (!socket.connected) {
      socket.connect()
    }
  }

  return socket
}

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}
