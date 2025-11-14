package games

import (
	"encoding/json"
	"errors"
)

type GameType int
type PlayerSide int

const (
	TYPE_FLIPFLOP3x3 GameType = iota
	TYPE_FLIPFLOP5x5
	TYPE_FLIPFOUR
)

const (
	COLOR_WHITE PlayerSide = iota
	COLOR_BLACK
)

type BaseMove struct {
	From string `json:"from"`
	To   string `json:"to"`
}

type Game interface {
	ApplyMove(moveData json.RawMessage) error
	CurrentTurn() PlayerSide
	GetBoardString() string
	IsGameEnded() bool
	GetWinner() PlayerSide
}

func NewGame(gameType GameType) (Game, error) {
	switch gameType {
	case TYPE_FLIPFLOP3x3:
		return NewFlipFlopGame(FlipFlop3x3), nil
	case TYPE_FLIPFLOP5x5:
		return NewFlipFlopGame(FlipFlop5x5), nil
	case TYPE_FLIPFOUR:
		return nil, errors.New("invalid game type")
	default:
		return nil, errors.New("invalid game type")
	}
}
