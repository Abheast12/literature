"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { PlayingCard } from "./playing-card"
import { getCardsInSet } from "@/lib/game-utils"

interface DeclareSetDialogProps {
  open: boolean
  onClose: () => void
  currentPlayer: any
  teammates: any[]
  onDeclare: (setName: string, declarations: Record<string, string[]>) => void
}

// Fix the DeclareSetDialog component to handle both array and number card types
export function DeclareSetDialog({ open, onClose, currentPlayer, teammates, onDeclare }: DeclareSetDialogProps) {
  const [selectedSet, setSelectedSet] = useState("")
  const [declarations, setDeclarations] = useState<Record<string, string[]>>({})

  // If currentPlayer is null or undefined, or if currentPlayer.cards is not an array, return null
  if (!currentPlayer || !Array.isArray(currentPlayer.cards)) return null

  // Get all sets that the current player has at least one card from
  interface Card {
    id: string;
    set: string;
    value: string;
    suit: string;
  }
  
  const playerSets = new Set<string>((currentPlayer.cards as Card[]).map((card) => card.set))

  // Get all cards in the selected set
  const cardsInSet = selectedSet ? getCardsInSet(selectedSet) : []

  // Group cards by player
  // Interface for card grouping by player ID
  interface CardsByPlayer {
    [playerId: string]: string[];
  }

  // Group cards by player
  const cardsByPlayer: CardsByPlayer = {
    [currentPlayer.id]: currentPlayer.cards
      .filter((card: Card) => card.set === selectedSet)
      .map((card: Card) => card.id),
  }

  // Initialize declarations with current player's cards
  if (selectedSet && !declarations[currentPlayer.id]) {
    setDeclarations({
      ...declarations,
      [currentPlayer.id]: cardsByPlayer[currentPlayer.id],
    })
  }

  // Interface for the declarations state
  interface Declarations {
    [playerId: string]: string[];
  }

  const handleCardAssignment = (cardId: string, playerId: string): void => {
    // Remove the card from any player who might have it assigned
    const updatedDeclarations: Declarations = { ...declarations };

    Object.keys(updatedDeclarations).forEach((pid: string) => {
      updatedDeclarations[pid] = updatedDeclarations[pid].filter((id: string) => id !== cardId);
    });

    // Add the card to the selected player
    if (!updatedDeclarations[playerId]) {
      updatedDeclarations[playerId] = [];
    }

    updatedDeclarations[playerId] = [...updatedDeclarations[playerId], cardId];

    setDeclarations(updatedDeclarations);
  };

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
                        const isOwnedByPlayer: boolean = (currentPlayer.cards as Card[]).some((c: Card): boolean => c.id === card.id)

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
