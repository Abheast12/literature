"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Trophy } from "lucide-react"

interface GameOverDialogProps {
  open: boolean
  onClose: () => void
  winningTeam: string
  currentPlayerTeam: string
  onPlayAgain: () => void
}

export function GameOverDialog({ open, onClose, winningTeam, currentPlayerTeam, onPlayAgain }: GameOverDialogProps) {
  const isWinner = winningTeam === currentPlayerTeam

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-2xl">Game Over</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center justify-center py-6">
          <Trophy className={`w-16 h-16 ${isWinner ? "text-yellow-500" : "text-gray-400"} mb-4`} />
          <h2 className="text-3xl font-bold mb-2">{isWinner ? "You Win!" : "You Lose!"}</h2>
          <p className="text-center text-muted-foreground">
            {isWinner
              ? "Congratulations! Your team collected 5 sets and won the game."
              : `Team ${winningTeam} collected 5 sets and won the game.`}
          </p>
        </div>

        <DialogFooter>
          <Button className="w-full" onClick={onPlayAgain}>
            Play Again
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
