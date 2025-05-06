import { io, type Socket } from "socket.io-client"

// This is a singleton pattern to ensure we only create one socket connection
let socket: Socket | null = null

export const getSocket = () => {
  return socket
}

export const connectSocket = (username: string, lobbyCode: string, isAdmin = false) => {
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
    })
  } else {
    // Update auth if socket already exists
    socket.auth = { username, lobbyCode, isAdmin }

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
  }
}
