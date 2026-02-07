package games

import (
	"encoding/json"
	"errors"
)

type GameType string
type PlayerSide int

const (
	TYPE_FLIPFLOP3x3 GameType = "flipflop3x3"
	TYPE_FLIPFLOP5x5 GameType = "flipflop5x5"
)

const (
	COLOR_WHITE PlayerSide = iota
	COLOR_BLACK
)

// Represents a basic move with a from and to position.
type BaseMove struct {
	From string `json:"from"`
	To   string `json:"to"`
}

type MoveHistoryEntry struct {
	MoveNumber int             `json:"move_number"`
	Player     PlayerSide      `json:"player"`
	Notation   string          `json:"notation"`
	Data       json.RawMessage `json:"data"` // Game-specific move data
}

type Game interface {
	// Applies a move to the game state. The game implementation should validate the move and return an error if it's illegal.
	ApplyMove(moveData json.RawMessage) error

	// Returns which player's turn it is.
	CurrentTurn() PlayerSide

	// Returns a string representation of the game board.
	GetBoardString() string

	// Returns whether the game has ended.
	IsGameEnded() bool

	// Returns the winner of the game. If the game is a draw or is ongoing, it should return -1.
	GetWinner() PlayerSide

	// Undoes the last move made in the game.
	UndoLastMove()

	// Returns the history of moves made in the game.
	GetMoveHistory() []MoveHistoryEntry
}

// Factory function to create a new game instance based on the specified game type.
func NewGame(gameType GameType) (Game, error) {
	switch gameType {
	case TYPE_FLIPFLOP3x3:
		return NewFlipFlopGame(FlipFlop3x3), nil
	case TYPE_FLIPFLOP5x5:
		return NewFlipFlopGame(FlipFlop5x5), nil
	default:
		return nil, errors.New("invalid game type")
	}
}
