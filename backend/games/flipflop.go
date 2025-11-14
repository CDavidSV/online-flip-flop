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

type BoardPos struct {
	Row int
	Col int
}

type Piece struct {
	Color    PlayerSide
	Side     PieceSide
	Pos      BoardPos
	Captured bool
}

type Player struct {
	color      PlayerSide
	goal       BoardPos
	pieces     []*Piece
	validMoves map[*Piece][]BoardPos
}

type FlipFlop struct {
	player1        *Player
	player2        *Player
	Type           FlipFlopType
	gameEnded      bool
	currentTurn    PlayerSide
	board          [][]*Piece
	winner         PlayerSide
	positionCounts map[string]int
	boardHistory   []string
}

type FlipFlopMove struct {
	From string
	To   string
}

func encodeBoardState(board [][]*Piece, currentTurn PlayerSide) string {
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

func (p *Piece) String() string {
	if p.Side == SIDE_ROOK {
		return "rook"
	}
	return "bishop"
}

func (g *FlipFlop) createBoard() {
	rows := int(g.Type)
	cols := rows

	board := make([][]*Piece, rows)
	for i := range board {
		board[i] = make([]*Piece, cols)

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

	g.board = board
}

func (g *FlipFlop) isGoalSquare(pos BoardPos) bool {
	if g.Type == FlipFlop3x3 {
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

func (g *FlipFlop) parsePosition(pos string) (*BoardPos, error) {
	if len(pos) != 2 {
		return nil, apperrors.ErrIllegalMove
	}

	col := int(pos[0] - 'A') // A=0, B=1, C=2
	row := int(pos[1] - '1') // 1=0, 2=1, 3=2

	boardSize := int(g.Type) // 3 or 5

	if col < 0 || col >= boardSize || row < 0 || row >= boardSize {
		return nil, apperrors.ErrIllegalMove
	}

	return &BoardPos{Row: row, Col: col}, nil
}

func (g *FlipFlop) getValidMoves(player *Player) (map[*Piece][]BoardPos, bool) {
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

func NewFlipFlopGame(flipFlopType FlipFlopType) *FlipFlop {
	var player1Goal, player2Goal BoardPos
	if flipFlopType == FlipFlop3x3 {
		player1Goal = BoardPos{Row: 0, Col: 1} // Top middle
		player2Goal = BoardPos{Row: 2, Col: 1} // Bottom middle
	} else {
		player1Goal = BoardPos{Row: 0, Col: 2} // Top middle
		player2Goal = BoardPos{Row: 4, Col: 2} // Bottom middle
	}

	game := &FlipFlop{
		player1: &Player{
			goal:       player1Goal,
			color:      COLOR_WHITE,
			validMoves: make(map[*Piece][]BoardPos),
		},
		player2: &Player{
			goal:       player2Goal,
			color:      COLOR_BLACK,
			validMoves: make(map[*Piece][]BoardPos),
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
	game.boardHistory = append(game.boardHistory, encodeBoardState(game.board, game.currentTurn))

	return game
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
	var player *Player
	var opponent *Player
	if g.currentTurn == COLOR_WHITE {
		player = g.player1
		opponent = g.player2
	} else {
		player = g.player2
		opponent = g.player1
	}

	// Change fromPos and toPos to uppercase
	fromPos := strings.ToUpper(moveData.From)
	toPos := strings.ToUpper(moveData.To)

	// Parse and validate board positions
	oldPos, err := g.parsePosition(fromPos)
	if err != nil {
		return apperrors.ErrInvalidMessageFormat
	}

	newPos, err := g.parsePosition(toPos)
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
		if pos.Row == newPos.Row && pos.Col == newPos.Col {
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
		// If there is a piece in the current position, check if it's a goal square
		if g.isGoalSquare(*newPos) {
			// Allow the move to the goal square
			occupyingPiece.Captured = true
		} else {
			return apperrors.ErrIllegalMove
		}
	}

	// Move the piece
	g.board[newPos.Row][newPos.Col] = piece
	g.board[oldPos.Row][oldPos.Col] = nil

	// Update the piece's position
	piece.Pos = *newPos

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
	// After the move, check if the current player has any pieces in their goal
	pieceInGoal := g.board[player.goal.Row][player.goal.Col]
	if pieceInGoal != nil && pieceInGoal.Color != player.color {
		g.gameEnded = true
		g.winner = g.currentTurn

		return nil
	}

	// Check for threefold repetition
	if g.positionCounts[fen] >= 3 {
		g.gameEnded = true

		// Draw
		return nil
	}

	// Switch turns
	if g.currentTurn == COLOR_WHITE {
		g.currentTurn = COLOR_BLACK
	} else {
		g.currentTurn = COLOR_WHITE
	}

	// Get valid moves for the opponent
	opponentValidMoves, canMove := g.getValidMoves(opponent)
	opponent.validMoves = opponentValidMoves

	if !canMove {
		// Opponent has no valid moves
		g.winner = g.currentTurn

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
