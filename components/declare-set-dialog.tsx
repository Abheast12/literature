"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { PlayingCard } from "./playing-card"

interface DeclareSetDialogProps {
  open: boolean
  onClose: () => void
  currentPlayer: any
  teammates: any[]
  onDeclare: (setName: string, declarations: Record<string, string[]>) => void
}

export function DeclareSetDialog({ open, onClose, currentPlayer, teammates, onDeclare }: DeclareSetDialogProps) {
  const [selectedSet, setSelectedSet] = useState("")
  const [declarations, setDeclarations] = useState<Record<string, string[]>>({})

  if (!currentPlayer) return null

  // Get all sets that the current player has at least one card from
  const playerSets = new Set(currentPlayer.cards.map((card) => card.set))

  // Get all cards in the selected set
  const cardsInSet = selectedSet ? getCardsInSet(selectedSet) : []

  // Group cards by player
  const cardsByPlayer = {
    [currentPlayer.id]: currentPlayer.cards.filter((card) => card.set === selectedSet).map((card) => card.id),
  }

  // Initialize declarations with current player's cards
  if (selectedSet && !declarations[currentPlayer.id]) {
    setDeclarations({
      ...declarations,
      [currentPlayer.id]: cardsByPlayer[currentPlayer.id],
    })
  }

  // Helper function to get all cards in a set
  function getCardsInSet(setName) {
    // This is a simplified version - in a real implementation, you would have a complete deck definition
    const suits = ["hearts", "diamonds", "clubs", "spades"]
    const cards = []

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

  const handleCardAssignment = (cardId, playerId) => {
    // Remove the card from any player who might have it assigned
    const updatedDeclarations = { ...declarations }

    Object.keys(updatedDeclarations).forEach((pid) => {
      updatedDeclarations[pid] = updatedDeclarations[pid].filter((id) => id !== cardId)
    })

    // Add the card to the selected player
    if (!updatedDeclarations[playerId]) {
      updatedDeclarations[playerId] = []
    }

    updatedDeclarations[playerId] = [...updatedDeclarations[playerId], cardId]

    setDeclarations(updatedDeclarations)
  }

  const handleDeclare = () => {
    onDeclare(selectedSet, declarations)
  }

  // Check if all cards in the set have been assigned
  const allCardsAssigned = cardsInSet.every((card) => Object.values(declarations).flat().includes(card.id))

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Declare a Set</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="set-select">Select a Set to Declare</Label>
            <Select value={selectedSet} onValueChange={setSelectedSet}>
              <SelectTrigger id="set-select">
                <SelectValue placeholder="Select a set" />
              </SelectTrigger>
              <SelectContent>
                {Array.from(playerSets).map((set) => (
                  <SelectItem key={set} value={set}>
                    {set}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedSet && (
            <Tabs defaultValue={currentPlayer.id}>
              <TabsList className="grid grid-cols-3">
                <TabsTrigger value={currentPlayer.id}>You</TabsTrigger>
                {teammates.map((teammate) => (
                  <TabsTrigger key={teammate.id} value={teammate.id}>
                    {teammate.name}
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value={currentPlayer.id}>
                <ScrollArea className="h-[200px]">
                  <div className="grid grid-cols-3 gap-2 p-2">
                    {cardsInSet.map((card) => {
                      const isAssigned = declarations[currentPlayer.id]?.includes(card.id)
                      const isOwnedByPlayer = currentPlayer.cards.some((c) => c.id === card.id)

                      return (
                        <div
                          key={card.id}
                          className="flex flex-col items-center"
                          onClick={() => handleCardAssignment(card.id, currentPlayer.id)}
                        >
                          <PlayingCard card={card} small />
                          <div className="mt-1 flex items-center">
                            <input type="checkbox" checked={isAssigned} readOnly className="mr-1" />
                            <span className="text-xs">{isOwnedByPlayer ? "(You have this)" : ""}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </ScrollArea>
              </TabsContent>

              {teammates.map((teammate) => (
                <TabsContent key={teammate.id} value={teammate.id}>
                  <ScrollArea className="h-[200px]">
                    <div className="grid grid-cols-3 gap-2 p-2">
                      {cardsInSet.map((card) => {
                        const isAssigned = declarations[teammate.id]?.includes(card.id)

                        return (
                          <div
                            key={card.id}
                            className="flex flex-col items-center"
                            onClick={() => handleCardAssignment(card.id, teammate.id)}
                          >
                            <PlayingCard card={card} small />
                            <div className="mt-1">
                              <input type="checkbox" checked={isAssigned} readOnly />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </ScrollArea>
                </TabsContent>
              ))}
            </Tabs>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleDeclare} disabled={!selectedSet || !allCardsAssigned}>
            Declare!
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
