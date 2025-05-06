"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"

interface CardProps {
  card: {
    id: string
    value: string
    suit: string
  }
  small?: boolean
  faceDown?: boolean
  onClick?: () => void
}

export function PlayingCard({ card, small = false, faceDown = false, onClick }: CardProps) {
  const [isHovered, setIsHovered] = useState(false)

  const getSuitColor = (suit: string) => {
    return ["hearts", "diamonds", "red"].includes(suit) ? "text-red-500" : "text-black"
  }

  const getSuitSymbol = (suit: string) => {
    switch (suit) {
      case "hearts":
        return "♥"
      case "diamonds":
        return "♦"
      case "clubs":
        return "♣"
      case "spades":
        return "♠"
      case "red":
        return "★"
      case "black":
        return "★"
      default:
        return ""
    }
  }

  const getCardValue = (value: string) => {
    if (value === "JOKER") return "JOKER"
    return value
  }

  if (faceDown) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-md border-2 border-white bg-gradient-to-br from-blue-600 to-blue-800 cursor-default",
          small ? "w-10 h-14" : "w-16 h-24",
          onClick && "cursor-pointer hover:shadow-lg transition-shadow",
        )}
        onClick={onClick}
      >
        <div className="text-white font-bold text-xs">♠♥♣♦</div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "relative flex flex-col rounded-md border-2 border-gray-300 bg-white shadow-sm",
        small ? "w-10 h-14" : "w-16 h-24",
        onClick && "cursor-pointer hover:shadow-lg transition-shadow",
        isHovered && "translate-y-[-8px]",
      )}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="absolute top-1 left-1 flex flex-col items-center">
        <span className={cn("text-xs font-bold", getSuitColor(card.suit))}>{getCardValue(card.value)}</span>
        <span className={cn("text-xs", getSuitColor(card.suit))}>{getSuitSymbol(card.suit)}</span>
      </div>

      <div className="absolute inset-0 flex items-center justify-center">
        <span className={cn("text-2xl", getSuitColor(card.suit))}>{getSuitSymbol(card.suit)}</span>
      </div>

      <div className="absolute bottom-1 right-1 flex flex-col items-center rotate-180">
        <span className={cn("text-xs font-bold", getSuitColor(card.suit))}>{getCardValue(card.value)}</span>
        <span className={cn("text-xs", getSuitColor(card.suit))}>{getSuitSymbol(card.suit)}</span>
      </div>
    </div>
  )
}
