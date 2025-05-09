"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { PlayingCard } from "./playing-card"
import { ScrollArea } from "@/components/ui/scroll-area"

interface Card {
  id: string
  value: string
  suit: string
  set: string
}

interface AskCardDialogProps {
  open: boolean
  onClose: () => void
  player: {
    name: string;
    id: string;
  };
  currentPlayer: any
  onAsk: (card: any) => void
}

// Fix the AskCardDialog component to handle both array and number card types
export function AskCardDialog({ open, onClose, player, currentPlayer, onAsk }: AskCardDialogProps) {
  const [selectedCard, setSelectedCard] = useState<Card | null>(null)

  // If player or currentPlayer is null or undefined, or if currentPlayer.cards is not an array, return null
  if (!player || !currentPlayer || !Array.isArray(currentPlayer.cards)) return null

  // Get all sets that the current player has at least one card from
  const playerSets = new Set<string>(currentPlayer.cards.map((card: Card) => card.set))

  // Get all cards that the current player can ask for
  const askableCards: Card[] = []

  // For each set the player has cards from
  playerSets.forEach((set) => {
    // Get all possible cards in this set
    const setCards = getCardsInSet(set)

    // Filter out cards the player already has
    const playerCardIds: Set<string> = new Set(currentPlayer.cards.map((card: Card) => card.id))
    const cardsToAsk = setCards.filter((card) => !playerCardIds.has(card.id))

    askableCards.push(...cardsToAsk)
  })

  // Helper function to get all cards in a set
  function getCardsInSet(setName: string): Card[] {
    // This is a simplified version - in a real implementation, you would have a complete deck definition
    const suits: string[] = ["hearts", "diamonds", "clubs", "spades"]
    const cards: Card[] = []

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

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ask {player.name} for a card</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh]">
          <div className="grid grid-cols-3 gap-2 p-2">
            {askableCards.map((card: Card) => (
              <div key={card.id} className="flex justify-center" onClick={() => setSelectedCard(card)}>
              <PlayingCard card={card} onClick={() => setSelectedCard(card)} />
              </div>
            ))}
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => selectedCard && onAsk(selectedCard)} disabled={!selectedCard}>
            Ask for Card
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
