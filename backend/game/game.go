package game

import (
	"errors"
	"strings"
	"sync"
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
	SIDE_ROOK   PieceSide = iota // + (Moves Horizontally or Vertically)
	SIDE_BISHOP                  // x (Moves Diagonally)
)

var (
	ErrNotInGame      = errors.New("must_join_game_first")
	ErrGameFull       = errors.New("game_full")
	ErrGameNotStarted = errors.New("game_not_started")
	ErrNotYourTurn    = errors.New("not_your_turn")
	ErrIllegalMove    = errors.New("illegal_move")
)

// Map of valid board positions for the 3x3 and 5x5 boards
var validPositions3x3 = map[string]BoardPos{
	"A1": {0, 0}, "A2": {0, 1}, "A3": {0, 2},
	"B1": {1, 0}, "B2": {1, 1}, "B3": {1, 2},
	"C1": {2, 0}, "C2": {2, 1}, "C3": {2, 2},
}

var validPositions5x5 = map[string]BoardPos{
	"A1": {0, 0}, "A2": {0, 1}, "A3": {0, 2}, "A4": {0, 3}, "A5": {0, 4},
	"B1": {1, 0}, "B2": {1, 1}, "B3": {1, 2}, "B4": {1, 3}, "B5": {1, 4},
	"C1": {2, 0}, "C2": {2, 1}, "C3": {2, 2}, "C4": {2, 3}, "C5": {2, 4},
	"D1": {3, 0}, "D2": {3, 1}, "D3": {3, 2}, "D4": {3, 3}, "D5": {3, 4},
	"E1": {4, 0}, "E2": {4, 1}, "E3": {4, 2}, "E4": {4, 3}, "E5": {4, 4},
}

type BoardPos struct {
	Row int
	Col int
}

type Piece struct {
	Color    PieceColor
	Side     PieceSide
	Pos      BoardPos
	Captured bool
}

type Player struct {
	ID     string
	color  PieceColor
	active bool
	goal   BoardPos
	pieces []*Piece
}

type GameEvent interface {
	EventName() string
}

type BaseEvent struct {
	Timestamp int64
	FenStr    string
}

type MoveEvent struct {
	BaseEvent
	PlayerID string
	From     string
	To       string
	Side     PieceSide
}

func (e MoveEvent) EventName() string { return "move" }

type GameEndEvent struct {
	BaseEvent
	WinnerID string
}

func (e GameEndEvent) EventName() string { return "game_end" }

type Game struct {
	ID             string
	player1        *Player
	player2        *Player
	GameType       GameType
	GameMode       GameMode
	status         GameStatus
	currentTurn    PieceColor
	password       string
	board          [][]*Piece
	positionCounts map[string]int
	boardHistory   []string
	mu             sync.RWMutex

	updatesCh chan GameEvent
}

func (g *Game) createBoard() [][]*Piece {
	rows := 3
	cols := 3

	// Change the size of the board based on the game type
	if g.GameType == TYPE_FLIPFLOP5x5 || g.GameType == TYPE_FLIPFOUR {
		rows = 5
		cols = 5
	}

	board := make([][]*Piece, rows)
	for i := range board {
		board[i] = make([]*Piece, cols)

		// If the game is of the 'Flip Four' type all cells must be empty
		if g.GameType == TYPE_FLIPFOUR {
			continue // We simply continue to the next iteration and dont add any pieces
		}

		for j := range cols {
			// If it's the first row we set the white pieces
			piece := &Piece{
				Pos: BoardPos{Row: i, Col: j},
			}
			if i == 0 {
				piece.Color = COLOR_WHITE
				piece.Side = SIDE_ROOK

				// Add it to the player's pieces
				g.player1.pieces = append(g.player1.pieces, piece)
			}

			// If it's the last row we add the black pieces
			if i == rows-1 {
				piece.Color = COLOR_BLACK
				piece.Side = SIDE_ROOK

				g.player2.pieces = append(g.player2.pieces, piece)
			}

			// Place the piece on the board
			board[i][j] = piece
		}
	}

	return board
}

func encodeBoardState(board [][]*Piece, currentTurn PieceColor) string {
	// o -> Empty square
	// a -> Black Rook
	// b -> Black Bishop
	// x -> White Rook
	// y -> White Bishop
	// / -> New row
	// 1 -> White turn
	// 2 -> Black turn

	// Example board:
	// [a, o, a]
	// [y, b, o]
	// [o, x, x]

	fenStr := ""
	for i, row := range board {
		for _, piece := range row {
			if piece == nil {
				fenStr += "o"
				continue
			}
			switch {
			case piece.Color == COLOR_BLACK && piece.Side == SIDE_ROOK:
				fenStr += "a"
			case piece.Color == COLOR_BLACK && piece.Side == SIDE_BISHOP:
				fenStr += "b"
			case piece.Color == COLOR_WHITE && piece.Side == SIDE_ROOK:
				fenStr += "x"
			case piece.Color == COLOR_WHITE && piece.Side == SIDE_BISHOP:
				fenStr += "y"
			}
		}

		// Add a '/' to separate rows
		if i < len(board)-1 {
			fenStr += "/"
		}
	}

	// Add the current turn at the end
	if currentTurn == COLOR_WHITE {
		fenStr += "1"
	} else {
		fenStr += "2"
	}

	return fenStr
}

func (g *Game) isGoalSquare(pos BoardPos) bool {
	if g.GameType == TYPE_FLIPFLOP3x3 {
		if pos.Col == 1 && (pos.Row == 0 || pos.Row == 2) {
			return true
		}
	} else {
		if pos.Col == 2 && (pos.Row == 0 || pos.Row == 4) {
			return true
		}
	}

	return false
}

func sign(d int) int {
	if d < 0 {
		return -1
	} else if d > 0 {
		return 1
	}

	return 0
}

func (g *Game) getValidMoves(player *Player) (map[*Piece][]BoardPos, bool) {
	// Represents all valid moves for each piece of the player
	validMoves := make(map[*Piece][]BoardPos)

	// Flag to indicate if the player can make any move
	canMove := false

	// Iterate over all pieces of the player
	for _, piece := range player.pieces {
		if piece.Captured {
			continue
		}

		moves := make([]BoardPos, 0)

		// Check all board positions for valid moves
		var directions []BoardPos
		if piece.Side == SIDE_ROOK {
			// Rook can move horizontally and vertically
			directions = []BoardPos{
				{Row: -1, Col: 0}, // Up
				{Row: 1, Col: 0},  // Down
				{Row: 0, Col: -1}, // Left
				{Row: 0, Col: 1},  // Right
			}
		} else {
			// Bishop can move diagonally
			directions = []BoardPos{
				{Row: -1, Col: -1}, // Up-Left
				{Row: -1, Col: 1},  // Up-Right
				{Row: 1, Col: -1},  // Down-Left
				{Row: 1, Col: 1},   // Down-Right
			}
		}

		pos := piece.Pos
		for _, dir := range directions {
			// Move the piece in the current direction until we hit the board edge or another piece
			for {
				pos.Row += dir.Row
				pos.Col += dir.Col

				// Check if the new position is within board bounds
				if pos.Row < 0 || pos.Row >= len(g.board) || pos.Col < 0 || pos.Col >= len(g.board[0]) {
					break
				}

				occupyingPiece := g.board[pos.Row][pos.Col]
				if occupyingPiece != nil {
					// If there is a piece in the current position, check if it's a goal square and if it belongs to the opponent
					if g.isGoalSquare(pos) && occupyingPiece.Color != piece.Color {
						// Allow the move to the goal square
						moves = append(moves, BoardPos{Row: pos.Row, Col: pos.Col})
						canMove = true
					}

					// Can't move further in this direction
					break
				}

				// Valid move
				moves = append(moves, BoardPos{Row: pos.Row, Col: pos.Col})
				canMove = true
			}
		}

		validMoves[piece] = moves
	}

	return validMoves, canMove
}

func NewGame(gameID string, gameType GameType, gameMode GameMode, password string) *Game {
	var player1Goal, player2Goal BoardPos
	if gameType == TYPE_FLIPFLOP3x3 {
		player1Goal = BoardPos{Row: 0, Col: 1} // Top middle
		player2Goal = BoardPos{Row: 2, Col: 1} // Bottom middle
	} else {
		player1Goal = BoardPos{Row: 0, Col: 2} // Top middle
		player2Goal = BoardPos{Row: 4, Col: 2} // Bottom middle
	}

	game := &Game{
		ID:             gameID,
		player1:        &Player{goal: player1Goal},
		player2:        &Player{goal: player2Goal},
		GameType:       gameType,
		GameMode:       gameMode,
		password:       password,
		status:         STATUS_WAITING_FOR_PLAYER,
		positionCounts: make(map[string]int),
		boardHistory:   make([]string, 0),
		updatesCh:      make(chan GameEvent, 1),
	}

	game.createBoard()

	return game
}

func (g *Game) MakeMove(playerID, fromPos, toPos string) error {
	g.mu.Lock()
	defer g.mu.Unlock()

	if g.status != STATUS_ONGOING {
		return ErrGameNotStarted
	}

	var player *Player
	if g.currentTurn == COLOR_WHITE {
		player = g.player1
	} else {
		player = g.player2
	}

	if player.color != g.currentTurn {
		return ErrNotYourTurn
	}

	// Get all valid moves for the player
	validMoves, canMove := g.getValidMoves(player)
	if !canMove {
		// This is an end game condition, the player loses
		g.status = STATUS_ENDED

		// TODO: Send game end event

		return nil
	}

	// Change fromPos and toPos to uppercase
	fromPos = strings.ToUpper(fromPos)
	toPos = strings.ToUpper(toPos)

	// Check if the fromPos and toPos are valid board positions
	var oldPos *BoardPos = nil
	var newPos *BoardPos = nil
	if g.GameType == TYPE_FLIPFLOP5x5 || g.GameType == TYPE_FLIPFOUR {
		if pos, valid := validPositions5x5[fromPos]; !valid {
			oldPos = &pos
		}

		if pos, valid := validPositions5x5[toPos]; !valid {
			newPos = &pos
		}
	} else {
		if pos, valid := validPositions3x3[fromPos]; !valid {
			oldPos = &pos
		}

		if pos, valid := validPositions3x3[toPos]; !valid {
			newPos = &pos
		}
	}

	if newPos == nil || oldPos == nil {
		return ErrIllegalMove
	}

	// Check if the piece being moved belongs to the player
	piece := g.board[oldPos.Row][oldPos.Col]
	if piece == nil || piece.Color != player.color {
		return ErrIllegalMove
	}

	// Check if the move is valid depending on the piece type.
	validPieceMoves, exists := validMoves[piece]
	if !exists {
		return ErrIllegalMove
	}

	moveValid := false
	for _, pos := range validPieceMoves {
		if pos.Row == newPos.Row && pos.Col == newPos.Col {
			// Valid move found, break out of the loop
			moveValid = true
			break
		}
	}

	if !moveValid {
		return ErrIllegalMove
	}

	// Check if the destination square is occupied by a piece
	occupyingPiece := g.board[newPos.Row][newPos.Col]
	if occupyingPiece != nil {
		// If there is a piece in the current position, check if it's a goal square
		if g.isGoalSquare(*newPos) {
			// Allow the move to the goal square
			occupyingPiece.Captured = true
		} else {
			return ErrIllegalMove
		}
	}

	// Move the piece
	g.board[newPos.Row][newPos.Col] = piece
	g.board[oldPos.Row][oldPos.Col] = nil

	// Flip the piece
	if piece.Side == SIDE_ROOK {
		piece.Side = SIDE_BISHOP
	} else {
		piece.Side = SIDE_ROOK
	}

	// Take a snapshot of the new board state
	fen := encodeBoardState(g.board, g.currentTurn)
	g.boardHistory = append(g.boardHistory, fen)
	g.positionCounts[fen]++

	// Check for game end conditions
	// After the move check if the player has any pieces in their goal
	pieceInGoal := g.board[player.goal.Row][player.goal.Col]
	if pieceInGoal != nil && pieceInGoal.Color != player.color {
		// The player has lost
		g.status = STATUS_ENDED

		// TODO: Send game end event
		return nil
	}

	// Check for threefold repetition
	if g.positionCounts[fen] >= 3 {
		g.status = STATUS_ENDED

		// TODO: Send game end event as draw
		return nil
	}

	// Switch turns
	if g.currentTurn == COLOR_WHITE {
		g.currentTurn = COLOR_BLACK
	} else {
		g.currentTurn = COLOR_WHITE
	}

	// Send move event
	moveEvent := MoveEvent{
		PlayerID: playerID,
		From:     fromPos,
		To:       toPos,
		Side:     piece.Side,
	}
	g.updatesCh <- moveEvent

	return nil
}

func (g *Game) AddPlayer(id string) (PieceColor, error) {
	g.mu.Lock()
	defer g.mu.Unlock()

	if g.player1.active && g.player2.active {
		return -1, ErrGameFull
	}

	var player *Player
	if !g.player1.active {
		player = g.player1
	} else if !g.player2.active {
		player = g.player2
	}

	if player != nil {
		player.ID = id
		player.color = COLOR_WHITE
		player.active = true
	}

	// Start the game when the second player joins
	g.status = STATUS_ONGOING
	g.currentTurn = COLOR_WHITE

	return player.color, nil
}

func (g *Game) RemovePlayer(playerID string) {
	g.mu.Lock()
	defer g.mu.Unlock()

	if g.player1.ID == playerID {
		g.player1.active = false
	} else if g.player2.ID == playerID {
		g.player2.active = false
	}

	// Revert game status if a player leaves
	if g.status == STATUS_ONGOING {
		g.status = STATUS_WAITING_FOR_PLAYER
	}
}

func (g *Game) Forfeit(playerID string) error {
	// TODO: Implement forfeit logic
	return nil
}
