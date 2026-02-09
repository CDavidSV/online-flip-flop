package games

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/CDavidSV/online-flip-flop/config"
	"github.com/CDavidSV/online-flip-flop/internal/apperrors"
	"github.com/labstack/gommon/log"
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

type ValidMove struct {
	From FFBoardPos
	To   FFBoardPos
}

type FFPiece struct {
	Color    PlayerSide
	Side     PieceSide
	Pos      FFBoardPos
	Captured bool
}

type FFPlayer struct {
	Color      PlayerSide
	Goal       FFBoardPos
	Pieces     []*FFPiece
	ValidMoves []ValidMove
}

type FlipFlopMove struct {
	From string
	To   string
}

type MoveRecord struct {
	from              FFBoardPos
	to                FFBoardPos
	movedPiece        *FFPiece
	capturedPiece     *FFPiece
	currentTurn       PlayerSide
	gameEnded         bool
	winner            PlayerSide
	player1ValidMoves []ValidMove
	player2ValidMoves []ValidMove
}

// FIXME: Player and Board should not be public (since it can be modified externally by mistake) but since they are used in AI, they have to be public for now.
// Find a way to avoid this in the future.
type FlipFlop struct {
	Player1        *FFPlayer
	Player2        *FFPlayer
	Type           FlipFlopType
	gameEnded      bool
	currentTurn    PlayerSide
	Board          [][]*FFPiece
	winner         PlayerSide
	positionCounts map[string]int
	boardHistory   []string
	moveRecords    []MoveRecord
}

// Retuns a string of the name of the piece.
func (p *FFPiece) String() string {
	if p.Side == SIDE_ROOK {
		return "rook"
	}
	return "bishop"
}

func (p *FFBoardPos) String(boardSize int) string {
	return fmt.Sprintf("%c%d", rune('A'+p.Col), boardSize-p.Row)
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

	g.Board = make([][]*FFPiece, rows)
	for r := range g.Board {
		g.Board[r] = make([]*FFPiece, cols)
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

		g.Player1.Pieces = append(g.Player1.Pieces, whitePiece)
		g.Player2.Pieces = append(g.Player2.Pieces, blackPiece)
		g.Board[0][c] = blackPiece
		g.Board[rows-1][c] = whitePiece
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

// Returns a slice of all valid moves.
// Returns a boolean indicating if the player has any moves available.
func (g *FlipFlop) GetValidMoves(player *FFPlayer) ([]ValidMove, bool) {
	// Represents all valid moves for the player
	validMoves := make([]ValidMove, 0)

	// Flag to indicate if the player can make any move
	canMove := false

	// If the player is on check, they can only move pieces that can get them out of check
	// In FlipFlop, this means moving a piece that is currently occupying the current player's goal square

	// Iterate over all pieces of the player
	for _, piece := range player.Pieces {
		if piece.Captured {
			continue
		}

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
				if pos.Row < 0 || pos.Row >= len(g.Board) || pos.Col < 0 || pos.Col >= len(g.Board[0]) {
					break
				}

				occupyingPiece := g.Board[pos.Row][pos.Col]
				if occupyingPiece != nil {
					// If there is a piece in the current position, check if it's a goal square and if it belongs to the opponent
					if g.isGoalSquare(pos) && occupyingPiece.Color != piece.Color {
						validMoves = append(validMoves, ValidMove{
							From: piece.Pos,
							To:   FFBoardPos{Row: pos.Row, Col: pos.Col},
						})
						canMove = true
					}

					// Can't move further in this direction
					break
				}

				// Valid move
				validMoves = append(validMoves, ValidMove{
					From: piece.Pos,
					To:   FFBoardPos{Row: pos.Row, Col: pos.Col},
				})
				canMove = true
			}
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
		player = g.Player1
		opponent = g.Player2
	} else {
		player = g.Player2
		opponent = g.Player1
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
	piece := g.Board[oldPos.Row][oldPos.Col]
	if piece == nil || piece.Color != player.Color {
		return apperrors.ErrIllegalMove
	}

	// Check if the move is valid using cached valid moves
	moveValid := false
	for _, validMove := range player.ValidMoves {
		if isPosEqual(validMove.From, *oldPos) && isPosEqual(validMove.To, *newPos) {
			// Valid move found, break out of the loop
			moveValid = true
			break
		}
	}

	if !moveValid {
		return apperrors.ErrIllegalMove
	}

	record := MoveRecord{
		from:              *oldPos,
		to:                *newPos,
		movedPiece:        piece,
		currentTurn:       g.currentTurn,
		gameEnded:         g.gameEnded,
		winner:            g.winner,
		player1ValidMoves: g.Player1.ValidMoves,
		player2ValidMoves: g.Player2.ValidMoves,
	}

	// Check if the destination square is occupied by a piece
	occupyingPiece := g.Board[newPos.Row][newPos.Col]
	if occupyingPiece != nil {
		// Allow the move to the goal square, and capture the piece
		occupyingPiece.Captured = true
		record.capturedPiece = occupyingPiece
	}

	g.moveRecords = append(g.moveRecords, record)

	// Move the piece
	g.Board[newPos.Row][newPos.Col] = piece
	g.Board[oldPos.Row][oldPos.Col] = nil

	// Update the piece's position
	piece.Pos = *newPos

	g.flipPieceSide(piece)
	g.changeTurn()

	// Take a snapshot of the new board state
	fen := encodeBoardState(g.Board, g.currentTurn)
	g.boardHistory = append(g.boardHistory, fen)

	g.printGameState(fen)

	// Check for game end conditions
	// After the move, check if the current player has any pieces in their goal
	pieceInGoal := g.Board[player.Goal.Row][player.Goal.Col]
	if pieceInGoal != nil && pieceInGoal.Color != player.Color {
		g.gameEnded = true
		g.winner = opponent.Color

		return nil
	}

	// Get valid moves for the opponent
	opponentValidMoves, canMove := g.GetValidMoves(opponent)
	opponent.ValidMoves = opponentValidMoves
	if !canMove {
		// Opponent has no valid moves
		g.gameEnded = true
		g.winner = player.Color

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

func (g *FlipFlop) UndoLastMove() {
	if len(g.moveRecords) == 0 {
		return
	}

	// Get the last move from the array and restore the game state
	lastMove := g.moveRecords[len(g.moveRecords)-1]
	g.moveRecords = g.moveRecords[:len(g.moveRecords)-1]

	// Restore moved piece to its original position
	g.Board[lastMove.from.Row][lastMove.from.Col] = lastMove.movedPiece
	g.Board[lastMove.to.Row][lastMove.to.Col] = lastMove.capturedPiece

	// Restore the position and piece side to its original state
	lastMove.movedPiece.Pos = lastMove.from
	g.flipPieceSide(lastMove.movedPiece)

	// If any piece was captured, restore it to the board
	if lastMove.capturedPiece != nil {
		lastMove.capturedPiece.Captured = false
	}

	g.currentTurn = lastMove.currentTurn
	g.gameEnded = lastMove.gameEnded
	g.winner = lastMove.winner

	// Remove the last board state from history
	if len(g.boardHistory) > 0 {
		lastBoardState := g.boardHistory[len(g.boardHistory)-1]
		g.boardHistory = g.boardHistory[:len(g.boardHistory)-1]

		// Decrement position count for the undone position
		if count, exists := g.positionCounts[lastBoardState]; exists {
			if count > 1 {
				g.positionCounts[lastBoardState]--
			} else {
				delete(g.positionCounts, lastBoardState)
			}
		}
	}

	// Restore valid moves from the saved state instead of recalculating
	g.Player1.ValidMoves = lastMove.player1ValidMoves
	g.Player2.ValidMoves = lastMove.player2ValidMoves
}

func (g *FlipFlop) printGameState(fenStr string) {
	if config.APILogLevel > log.DEBUG {
		return
	}

	boardSize := int(g.Type)

	turn := fenStr[len(fenStr)-1]
	fmt.Printf("Current Turn: %s\n", map[byte]string{'1': "White", '2': "Black"}[turn])
	rows := strings.Split(fenStr[:len(fenStr)-1], "/")

	for row, data := range rows {
		fmt.Printf("%d| %s\n", boardSize-row, strings.Join(strings.Split(data, ""), " "))
	}

	fmt.Println(" +" + strings.Repeat("-", boardSize*2+1))
	fmt.Print("  ")
	for i := range boardSize {
		fmt.Printf(" %c", 'A'+i)
	}
	fmt.Println("")
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

func (g *FlipFlop) BoardSize() int {
	return int(g.Type)
}

func (g *FlipFlop) GetMoveHistory() []MoveHistoryEntry {
	history := make([]MoveHistoryEntry, 0, len(g.moveRecords))
	for i, record := range g.moveRecords {
		notation := fmt.Sprintf("%c%d-%c%d", rune('A'+record.from.Col), int(g.Type)-record.from.Row, rune('A'+record.to.Col), int(g.Type)-record.to.Row)
		moveEntry := MoveHistoryEntry{
			MoveNumber: i + 1,
			Player:     record.movedPiece.Color,
			Notation:   notation,
			Data:       nil,
		}
		history = append(history, moveEntry)
	}

	return history
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
		Player1: &FFPlayer{
			Goal:       player1Goal,
			Color:      COLOR_WHITE,
			ValidMoves: make([]ValidMove, 0),
		},
		Player2: &FFPlayer{
			Goal:       player2Goal,
			Color:      COLOR_BLACK,
			ValidMoves: make([]ValidMove, 0),
		},
		Type:           flipFlopType,
		currentTurn:    COLOR_WHITE,
		winner:         -1,
		positionCounts: make(map[string]int),
		boardHistory:   make([]string, 0),
		moveRecords:    make([]MoveRecord, 0),
	}

	game.createBoard()

	// Generate initial valid moves for white player
	validMoves, _ := game.GetValidMoves(game.Player1)
	game.Player1.ValidMoves = validMoves

	// Take a snapshot of the initial board state
	initialState := encodeBoardState(game.Board, game.currentTurn)
	game.boardHistory = append(game.boardHistory, initialState)
	game.positionCounts[initialState] = 1 // Initial position count is 1

	game.printGameState(initialState)

	return game
}
