package games

import (
	"encoding/json"
	"strings"

	"github.com/CDavidSV/online-flip-flop/internal/apperrors"
)

type FlipFlopType int
type PieceSide int

const (
	SIDE_ROOK   PieceSide = iota // + (Moves Horizontally or Vertically)
	SIDE_BISHOP                  // x (Moves Diagonally)
)

const (
	FlipFlop3x3 FlipFlopType = 3
	FlipFlop5x5 FlipFlopType = 5
)

type FFBoardPos struct {
	Row int
	Col int
}

type FFPiece struct {
	Color    PlayerSide
	Side     PieceSide
	Pos      FFBoardPos
	Captured bool
}

type FFPlayer struct {
	color      PlayerSide
	goal       FFBoardPos
	pieces     []*FFPiece
	onCheck    bool
	validMoves map[*FFPiece][]FFBoardPos
}

type FlipFlop struct {
	player1        *FFPlayer
	player2        *FFPlayer
	Type           FlipFlopType
	gameEnded      bool
	currentTurn    PlayerSide
	board          [][]*FFPiece
	winner         PlayerSide
	positionCounts map[string]int
	boardHistory   []string
}

type FlipFlopMove struct {
	From string
	To   string
}

// Retuns a string of the name of the piece.
func (p *FFPiece) String() string {
	if p.Side == SIDE_ROOK {
		return "rook"
	}
	return "bishop"
}

func isPosEqual(pos1, pos2 FFBoardPos) bool {
	return pos1.Row == pos2.Row && pos1.Col == pos2.Col
}

// Encodes the current board state into a string representation (similar to a fen string).
func encodeBoardState(board [][]*FFPiece, currentTurn PlayerSide) string {
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

	// Example string: "aoa/ybo/oxx 1"

	var fenStr strings.Builder
	for i, row := range board {
		for _, piece := range row {
			if piece == nil {
				fenStr.WriteString("o")
				continue
			}
			switch {
			case piece.Color == COLOR_BLACK && piece.Side == SIDE_ROOK:
				fenStr.WriteString("a")
			case piece.Color == COLOR_BLACK && piece.Side == SIDE_BISHOP:
				fenStr.WriteString("b")
			case piece.Color == COLOR_WHITE && piece.Side == SIDE_ROOK:
				fenStr.WriteString("x")
			case piece.Color == COLOR_WHITE && piece.Side == SIDE_BISHOP:
				fenStr.WriteString("y")
			}
		}

		// Add a '/' to separate rows
		if i < len(board)-1 {
			fenStr.WriteString("/")
		}
	}

	// Add the current turn at the end
	if currentTurn == COLOR_WHITE {
		fenStr.WriteString("1")
	} else {
		fenStr.WriteString("2")
	}

	return fenStr.String()
}

// Initializes the game board and places the pieces in their starting positions.
func (g *FlipFlop) createBoard() {
	rows := int(g.Type)
	cols := rows

	g.board = make([][]*FFPiece, rows)
	for r := range g.board {
		g.board[r] = make([]*FFPiece, cols)
	}

	// White pieces are placed in the first row
	for c := range cols {
		blackPiece := &FFPiece{
			Pos:   FFBoardPos{Row: 0, Col: c},
			Side:  SIDE_ROOK,
			Color: COLOR_BLACK,
		}

		whitePiece := &FFPiece{
			Pos:   FFBoardPos{Row: rows - 1, Col: c},
			Side:  SIDE_ROOK,
			Color: COLOR_WHITE,
		}

		g.player1.pieces = append(g.player1.pieces, whitePiece)
		g.player2.pieces = append(g.player2.pieces, blackPiece)
		g.board[0][c] = blackPiece
		g.board[rows-1][c] = whitePiece
	}
}

// Checks if the provided position is a goal square.
func (g *FlipFlop) isGoalSquare(pos FFBoardPos) bool {
	if g.Type == FlipFlop3x3 {
		whiteGoal := FFBoardPos{Row: 0, Col: 1}
		blackGoal := FFBoardPos{Row: 2, Col: 1}

		if isPosEqual(pos, whiteGoal) || isPosEqual(pos, blackGoal) {
			return true
		}
	} else {
		whiteGoal := FFBoardPos{Row: 0, Col: 2}
		blackGoal := FFBoardPos{Row: 4, Col: 2}
		if isPosEqual(pos, whiteGoal) || isPosEqual(pos, blackGoal) {
			return true
		}
	}

	return false
}

// Parses a position string like "A1" into board coordinates.
func (g *FlipFlop) parsePosition(pos string) (*FFBoardPos, error) {
	if len(pos) != 2 {
		return nil, apperrors.ErrIllegalMove
	}

	boardSize := int(g.Type)               // 3 or 5
	col := int(pos[0] - 'A')               // A=0, B=1, C=2
	row := boardSize - 1 - int(pos[1]-'1') // 1=2, 2=1, 3=0

	if col < 0 || col >= boardSize || row < 0 || row >= boardSize {
		return nil, apperrors.ErrIllegalMove
	}

	return &FFBoardPos{Row: row, Col: col}, nil
}

// Returns a map per piece of all all valid moves.
// Returns a bolean indicating if the player has any moves available.
func (g *FlipFlop) getValidMoves(player *FFPlayer) (map[*FFPiece][]FFBoardPos, bool) {
	// Represents all valid moves for each piece of the player
	validMoves := make(map[*FFPiece][]FFBoardPos)

	// Flag to indicate if the player can make any move
	canMove := false

	// If the player is on check, they can only move pieces that can get them out of check
	// In FlipFlop, this means moving a piece that is currently occupying the current player's goal square

	// Iterate over all pieces of the player
	for _, piece := range player.pieces {
		if piece.Captured {
			continue
		}

		moves := make([]FFBoardPos, 0)

		// Check all board positions for valid moves
		var directions []FFBoardPos
		if piece.Side == SIDE_ROOK {
			// Rook can move horizontally and vertically
			directions = []FFBoardPos{
				{Row: -1, Col: 0}, // Up
				{Row: 1, Col: 0},  // Down
				{Row: 0, Col: -1}, // Left
				{Row: 0, Col: 1},  // Right
			}
		} else {
			// Bishop can move diagonally
			directions = []FFBoardPos{
				{Row: -1, Col: -1}, // Up-Left
				{Row: -1, Col: 1},  // Up-Right
				{Row: 1, Col: -1},  // Down-Left
				{Row: 1, Col: 1},   // Down-Right
			}
		}

		for _, dir := range directions {
			// Move the piece in the current direction until we hit the board edge or another piece
			pos := piece.Pos
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
						moves = append(moves, FFBoardPos{Row: pos.Row, Col: pos.Col})
						canMove = true
					}

					// Can't move further in this direction
					break
				}

				// Valid move
				moves = append(moves, FFBoardPos{Row: pos.Row, Col: pos.Col})
				canMove = true
			}
		}

		if len(moves) > 0 {
			validMoves[piece] = moves
		}
	}

	return validMoves, canMove
}

func (g *FlipFlop) flipPieceSide(piece *FFPiece) {
	if piece.Side == SIDE_ROOK {
		piece.Side = SIDE_BISHOP
	} else {
		piece.Side = SIDE_ROOK
	}
}

func (g *FlipFlop) changeTurn() {
	if g.currentTurn == COLOR_WHITE {
		g.currentTurn = COLOR_BLACK
	} else {
		g.currentTurn = COLOR_WHITE
	}
}

func (g *FlipFlop) ApplyMove(move json.RawMessage) error {
	// Check if the game has already ended
	if g.gameEnded {
		return apperrors.ErrGameEnded
	}

	var moveData BaseMove
	if err := json.Unmarshal(move, &moveData); err != nil {
		return apperrors.ErrInvalidMessageFormat
	}

	// Get current player and opponent based on turn
	var player *FFPlayer
	var opponent *FFPlayer
	if g.currentTurn == COLOR_WHITE {
		player = g.player1
		opponent = g.player2
	} else {
		player = g.player2
		opponent = g.player1
	}

	// Parse and validate board positions
	oldPos, err := g.parsePosition(strings.ToUpper(moveData.From))
	if err != nil {
		return apperrors.ErrInvalidMessageFormat
	}

	newPos, err := g.parsePosition(strings.ToUpper(moveData.To))
	if err != nil {
		return apperrors.ErrInvalidMessageFormat
	}

	// Check if the piece being moved belongs to the player
	piece := g.board[oldPos.Row][oldPos.Col]
	if piece == nil || piece.Color != player.color {
		return apperrors.ErrIllegalMove
	}

	// Check if the move is valid using cached valid moves
	validPieceMoves, exists := player.validMoves[piece]
	if !exists {
		return apperrors.ErrIllegalMove
	}

	moveValid := false
	for _, pos := range validPieceMoves {
		if isPosEqual(pos, *newPos) {
			// Valid move found, break out of the loop
			moveValid = true
			break
		}
	}

	if !moveValid {
		return apperrors.ErrIllegalMove
	}

	// Check if the destination square is occupied by a piece
	occupyingPiece := g.board[newPos.Row][newPos.Col]
	if occupyingPiece != nil {
		// Allow the move to the goal square, and capture the piece
		occupyingPiece.Captured = true
	}

	if isPosEqual(*newPos, opponent.goal) {
		opponent.onCheck = true
	}

	// Move the piece
	g.board[newPos.Row][newPos.Col] = piece
	g.board[oldPos.Row][oldPos.Col] = nil

	// Because all moves must lead to the current player's goal square not being occupied by an opponent piece,
	// we can always update the onCheck status of the current player to false.
	player.onCheck = false

	// Update the piece's position
	piece.Pos = *newPos

	g.flipPieceSide(piece)
	g.changeTurn()

	// Take a snapshot of the new board state
	fen := encodeBoardState(g.board, g.currentTurn)
	g.boardHistory = append(g.boardHistory, fen)

	// Check for game end conditions
	// After the move, check if the current player has any pieces in their goal
	pieceInGoal := g.board[player.goal.Row][player.goal.Col]
	if pieceInGoal != nil && pieceInGoal.Color != player.color {
		g.gameEnded = true
		g.winner = opponent.color

		return nil
	}

	// Get valid moves for the opponent
	opponentValidMoves, canMove := g.getValidMoves(opponent)
	opponent.validMoves = opponentValidMoves
	if !canMove {
		// Opponent has no valid moves
		g.gameEnded = true
		g.winner = g.currentTurn

		return nil
	}

	// Check for threefold repetition
	g.positionCounts[fen]++
	if g.positionCounts[fen] == 3 {
		g.gameEnded = true

		// Draw
		return nil
	}

	return nil
}

func (g *FlipFlop) CurrentTurn() PlayerSide {
	return g.currentTurn
}

func (g *FlipFlop) GetBoardString() string {
	return g.boardHistory[len(g.boardHistory)-1]
}

func (g *FlipFlop) IsGameEnded() bool {
	return g.gameEnded
}

func (g *FlipFlop) GetWinner() PlayerSide {
	return g.winner
}

func NewFlipFlopGame(flipFlopType FlipFlopType) *FlipFlop {
	var player1Goal, player2Goal FFBoardPos
	if flipFlopType == FlipFlop3x3 {
		player1Goal = FFBoardPos{Row: 2, Col: 1} // Bottom middle
		player2Goal = FFBoardPos{Row: 0, Col: 1} // Top middle
	} else {
		player1Goal = FFBoardPos{Row: 4, Col: 2} // Bottom middle
		player2Goal = FFBoardPos{Row: 0, Col: 2} // Top middle
	}

	game := &FlipFlop{
		player1: &FFPlayer{
			goal:       player1Goal,
			color:      COLOR_WHITE,
			validMoves: make(map[*FFPiece][]FFBoardPos),
			onCheck:    false,
		},
		player2: &FFPlayer{
			goal:       player2Goal,
			color:      COLOR_BLACK,
			validMoves: make(map[*FFPiece][]FFBoardPos),
			onCheck:    false,
		},
		Type:           flipFlopType,
		currentTurn:    COLOR_WHITE,
		winner:         -1,
		positionCounts: make(map[string]int),
		boardHistory:   make([]string, 0),
	}

	game.createBoard()

	// Generate initial valid moves for white player
	validMoves, _ := game.getValidMoves(game.player1)
	game.player1.validMoves = validMoves

	// Take a snapshot of the initial board state
	initialState := encodeBoardState(game.board, game.currentTurn)
	game.boardHistory = append(game.boardHistory, initialState)
	game.positionCounts[initialState] = 1 // Initial position count is 1

	return game
}
