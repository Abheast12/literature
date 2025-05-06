"use client"

import { PlayingCard } from "./playing-card"
import { cn } from "@/lib/utils"

interface PlayerPositionProps {
  player: {
    id: string
    name: string
    team: string
    cards: any[] | number
  }
  position: number
  isCurrentPlayer: boolean
  isCurrentTurn: boolean
  onClick: () => void
}

export function PlayerPosition({ player, position, isCurrentPlayer, isCurrentTurn, onClick }: PlayerPositionProps) {
  // Calculate position around a circle
  const getPositionStyle = () => {
    // For 6 players, we'll position them in a circle
    // Player 0 at bottom, then clockwise
    const angle = position * 60 - 90 // -90 to start from bottom
    const radius = 42 // percentage of container

    const x = 50 + radius * Math.cos((angle * Math.PI) / 180)
    const y = 50 + radius * Math.sin((angle * Math.PI) / 180)

    return {
      left: `${x}%`,
      top: `${y}%`,
      transform: "translate(-50%, -50%)",
    }
  }

  // Calculate the number of cards the player has
  const cardCount = typeof player.cards === "number" ? player.cards : player.cards.length

  return (
    <div
      className={cn("absolute flex flex-col items-center", isCurrentTurn && "animate-pulse")}
      style={getPositionStyle()}
    >
      {/* Player name and team */}
      <div
        className={cn(
          "px-3 py-1 rounded-full text-white text-sm font-medium mb-2",
          player.team === "A" ? "bg-red-500" : "bg-blue-500",
          isCurrentTurn && "ring-2 ring-white",
        )}
      >
        {player.name}
      </div>

      {/* Player cards */}
      {isCurrentPlayer ? (
        <div className="text-xs text-white mb-2">You</div>
      ) : (
        <div
          className={cn(
            "flex",
            position === 0 || position === 3
              ? "flex-row"
              : position === 1 || position === 2
                ? "flex-col"
                : "flex-col-reverse",
          )}
          onClick={onClick}
        >
          {cardCount > 0 ? (
            Array.from({ length: Math.min(3, cardCount) }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  "transition-transform",
                  position === 0 || position === 3 ? `ml-${i === 0 ? "0" : "-6"}` : `mt-${i === 0 ? "0" : "-6"}`,
                )}
              >
                <PlayingCard card={{ id: `dummy-${i}`, value: "", suit: "" }} faceDown small />
              </div>
            ))
          ) : (
            <div className="text-xs text-white">No cards</div>
          )}
          {cardCount > 3 && <div className="text-xs text-white mt-1">+{cardCount - 3} more</div>}
        </div>
      )}
    </div>
  )
}
