// Card types
const createDeck = () => {
    const suits = ["hearts", "diamonds", "clubs", "spades"]
    const lowValues = ["2", "3", "4", "5", "6", "7"]
    const highValues = ["9", "10", "J", "Q", "K", "A"]
  
    const cards = []
  
    // Add low value cards (2-7 of each suit)
    suits.forEach((suit) => {
      lowValues.forEach((value) => {
        cards.push({
          id: `${value}-${suit}`,
          value,
          suit,
          set: `low-${suit}`,
        })
      })
    })
  
    // Add high value cards (9-A of each suit)
    suits.forEach((suit) => {
      highValues.forEach((value) => {
        cards.push({
          id: `${value}-${suit}`,
          value,
          suit,
          set: `high-${suit}`,
        })
      })
    })
  
    // Add 8s and jokers
    suits.forEach((suit) => {
      cards.push({
        id: `8-${suit}`,
        value: "8",
        suit,
        set: "eights-jokers",
      })
    })
  
    cards.push({
      id: "joker-red",
      value: "JOKER",
      suit: "red",
      set: "eights-jokers",
    })
  
    cards.push({
      id: "joker-black",
      value: "JOKER",
      suit: "black",
      set: "eights-jokers",
    })
  
    return cards
  }
  
  // Shuffle an array using Fisher-Yates algorithm
  const shuffleArray = (array) => {
    const newArray = [...array]
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray
  }
  
  // Get all cards in a specific set
  const getCardsInSet = (setName) => {
    const allCards = createDeck()
    return allCards.filter(card => card.set === setName)
  }
  
  // Check if a player can ask for a specific card
  const canAskForCard = (player, cardId) => {
    const card = createDeck().find(c => c.id === cardId)
    if (!card) return false
    
    // Player must have at least one card from the set
    const hasCardFromSet = player.cards.some(c => c.set === card.set)
    
    // Player must not already have the card
    const doesNotHaveCard = !player.cards.some(c => c.id === cardId)
    
    return hasCardFromSet && doesNotHaveCard
  }
  
  // Validate a set declaration
  const validateDeclaration = (declaration, players, setName) => {
    // Get all cards that should be in the set
    const setCards = getCardsInSet(setName)
    const setCardIds = new Set(setCards.map(card => card.id))
    
    // Get all cards that were declared
    const declaredCardIds = Object.values(declaration).flat()
    
    // Check if all cards in the set were declared
    if (declaredCardIds.length !== setCards.length) {
      return false
    }
    
    // Check if all declared cards are in the set
    if (!declaredCardIds.every(id => setCardIds.has(id))) {
      return false
    }
    
    // Check if the declaration matches reality
    for (const playerId in declaration) {
      const player = players.find(p => p.id === playerId)
      if (!player) return false
      
      const playerCardIds = new Set(player.cards.map(card => card.id))
      
      // Check if the player has all the cards declared for them
      if (!declaration[playerId].every(id => playerCardIds.has(id))) {
        return false
      }
    }
    
    return true
  }
  
  module.exports = {
    createDeck,
    shuffleArray,
    getCardsInSet,
    canAskForCard,
    validateDeclaration
  }