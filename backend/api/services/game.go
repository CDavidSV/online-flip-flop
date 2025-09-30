package services

import (
	"github.com/google/uuid"
)

type GameMode int
type GameType int
type GameStatus int
type PieceColor int
type PieceSide int

const (
	MODE_SINGLEPLAYER GameMode = iota + 1
	MODE_MULTIPLAYER
)

const (
	TYPE_FLIPFLOP3x3 GameType = iota + 1
	TYPE_FLIPFLOP5x5
	TYPE_FLIPFOUR
)

const (
	STATUS_WAITING_FOR_PLAYER GameStatus = iota + 1
	STATUS_ONGOING
	STATUS_ENDED
	STATUS_CANCELED
)

const (
	COLOR_BLACK PieceColor = iota
	COLOR_WHITE
)

const (
	SIDE_ROOK   PieceSide = iota // +
	SIDE_BISHOP                  // x
)

type Player struct {
	ID       string
	Username string
}

type Game struct {
	ID       string
	Players  map[string]*Player
	Type     GameType
	Mode     GameMode
	Status   GameStatus
	Password string
	Board    [][]*Piece
	State    State
}

type Piece struct {
	Color PieceColor
	Side  PieceSide
}

type Move struct {
	PlayerID    string
	PrevPos     [2]int
	NewPos      [2]int
	CurrentSide PieceSide
}

type State struct {
	CurrentTurnID string
	MoveHistory   []Move
}

func createBoard(gameType GameType) [][]*Piece {
	rows := 3
	cols := 3

	// Change the size of the board based on the game type
	if gameType == TYPE_FLIPFLOP5x5 || gameType == TYPE_FLIPFOUR {
		rows = 5
		cols = 5
	}

	board := make([][]*Piece, rows)
	for i := range board {
		board[i] = make([]*Piece, cols)

		// If the game is of the 'Flip Four' type all cells must be emopty
		if gameType == TYPE_FLIPFOUR {
			continue // We simply continue to the next iteration and dont add any pieces
		}

		for j := range cols {
			// If it's the first row we set the bacl pieces
			if i == 0 {
				board[i][j] = &Piece{
					Color: COLOR_BLACK,
					Side:  SIDE_ROOK,
				}
			}

			// If it's the last row we add the white pieces
			if i == rows-1 {
				board[i][j] = &Piece{
					Color: COLOR_WHITE,
					Side:  SIDE_ROOK,
				}
			}
		}
	}

	return board
}

func NewGame(gameID string, gameType GameType, gameMode GameMode, password string) *Game {
	return &Game{
		ID:       gameID,
		Players:  make(map[string]*Player),
		Type:     gameType,
		Mode:     gameMode,
		Password: password,
		Status:   STATUS_WAITING_FOR_PLAYER,
		State: State{
			CurrentTurnID: "",
			MoveHistory:   []Move{},
		},
		Board: createBoard(gameType),
	}
}

func NewPlayer(username string) *Player {
	return &Player{
		ID:       uuid.New().String(),
		Username: username,
	}
}
