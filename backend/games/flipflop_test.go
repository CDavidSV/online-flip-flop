package games

import (
	"encoding/json"
	"reflect"
	"testing"

	"github.com/CDavidSV/online-flip-flop/internal/apperrors"
)

func TestNewFlipFlopGameInitializesBoard(t *testing.T) {
	for _, gameType := range []FlipFlopType{FlipFlop3x3, FlipFlop5x5} {
		t.Run(string(rune('0'+gameType)), func(t *testing.T) {
			game := NewFlipFlopGame(gameType)
			size := int(gameType)

			if game.BoardSize() != size || len(game.Board) != size {
				t.Fatalf("board size = %d/%d, want %d", game.BoardSize(), len(game.Board), size)
			}
			for _, row := range game.Board {
				if len(row) != size {
					t.Fatalf("row length = %d, want %d", len(row), size)
				}
			}
			if game.CurrentTurn() != COLOR_WHITE || game.IsGameEnded() || game.GetWinner() != PlayerSide(-1) {
				t.Fatalf("initial state = turn %d, ended %v, winner %d", game.CurrentTurn(), game.IsGameEnded(), game.GetWinner())
			}
			if len(game.Player1.Pieces) != size || len(game.Player2.Pieces) != size {
				t.Fatalf("piece counts = %d/%d, want %d/%d", len(game.Player1.Pieces), len(game.Player2.Pieces), size, size)
			}

			for col := 0; col < size; col++ {
				black := game.Board[0][col]
				white := game.Board[size-1][col]
				if black == nil || black.Color != COLOR_BLACK || black.Side != SIDE_ROOK || black.Pos != (FFBoardPos{Row: 0, Col: col}) {
					t.Fatalf("black piece at column %d = %#v", col, black)
				}
				if white == nil || white.Color != COLOR_WHITE || white.Side != SIDE_ROOK || white.Pos != (FFBoardPos{Row: size - 1, Col: col}) {
					t.Fatalf("white piece at column %d = %#v", col, white)
				}
			}

			if len(game.GetMoveHistory()) != 0 {
				t.Fatal("new game should have no move history")
			}
			if game.GetBoardString() != encodeBoardState(game.Board, COLOR_WHITE) {
				t.Fatalf("initial board string = %q", game.GetBoardString())
			}
		})
	}
}

func TestNewGameRejectsUnknownType(t *testing.T) {
	if game, err := NewGame(GameType("unknown")); err == nil || game != nil {
		t.Fatalf("NewGame returned game=%v, err=%v for unknown type", game, err)
	}
}

func TestGetValidMovesSlidesAndStopsAtPieces(t *testing.T) {
	game := NewFlipFlopGame(FlipFlop3x3)
	moves, canMove := game.GetValidMoves(game.Player1)
	if !canMove {
		t.Fatal("white should have legal opening moves")
	}

	want := []ValidMove{
		{From: FFBoardPos{Row: 2, Col: 0}, To: FFBoardPos{Row: 1, Col: 0}},
		{From: FFBoardPos{Row: 2, Col: 1}, To: FFBoardPos{Row: 1, Col: 1}},
		{From: FFBoardPos{Row: 2, Col: 1}, To: FFBoardPos{Row: 0, Col: 1}},
		{From: FFBoardPos{Row: 2, Col: 2}, To: FFBoardPos{Row: 1, Col: 2}},
	}
	if !reflect.DeepEqual(moves, want) {
		t.Fatalf("opening moves = %#v, want %#v", moves, want)
	}

	game.Board[1][0] = game.Player1.Pieces[0]
	game.Player1.Pieces[0].Pos = FFBoardPos{Row: 1, Col: 0}
	game.Player1.Pieces[0].Side = SIDE_BISHOP
	game.Board[2][0] = nil
	game.Board[0][1] = game.Player1.Pieces[1]
	game.Player1.Pieces[1].Pos = FFBoardPos{Row: 0, Col: 1}
	moves, canMove = game.GetValidMoves(game.Player1)
	if !canMove {
		t.Fatal("a bishop with an open diagonal should be able to move")
	}
	for _, move := range moves {
		if move.From == (FFBoardPos{Row: 1, Col: 0}) && move.To == (FFBoardPos{Row: 0, Col: 1}) {
			t.Fatal("bishop should not move onto a square occupied by its own piece")
		}
	}
}

func TestApplyMoveFlipsPieceAndUpdatesState(t *testing.T) {
	game := NewFlipFlopGame(FlipFlop3x3)
	initialBoard := game.GetBoardString()
	initialMoves := append([]ValidMove(nil), game.Player1.ValidMoves...)

	if err := game.ApplyMove(json.RawMessage(`{"from":"a1","to":"a2"}`)); err != nil {
		t.Fatalf("ApplyMove returned error: %v", err)
	}

	piece := game.Board[1][0]
	if piece == nil || piece.Pos != (FFBoardPos{Row: 1, Col: 0}) || piece.Side != SIDE_BISHOP {
		t.Fatalf("moved piece = %#v, want bishop at A2", piece)
	}
	if game.Board[2][0] != nil || game.CurrentTurn() != COLOR_BLACK || game.IsGameEnded() {
		t.Fatalf("state after move has unexpected board/turn/end status")
	}
	if game.GetBoardString() == initialBoard || len(game.GetMoveHistory()) != 1 {
		t.Fatalf("board/history after move = %q/%d", game.GetBoardString(), len(game.GetMoveHistory()))
	}
	history := game.GetMoveHistory()[0]
	if history.MoveNumber != 1 || history.Player != COLOR_WHITE || history.Notation != "A1-A2" {
		t.Fatalf("move history entry = %#v", history)
	}
	if len(game.Player2.ValidMoves) == 0 {
		t.Fatal("black valid moves should be recalculated after white moves")
	}

	game.UndoLastMove()
	if game.GetBoardString() != initialBoard || game.CurrentTurn() != COLOR_WHITE || game.IsGameEnded() {
		t.Fatal("undo did not restore the initial state")
	}
	if !reflect.DeepEqual(game.Player1.ValidMoves, initialMoves) || len(game.GetMoveHistory()) != 0 {
		t.Fatal("undo did not restore valid moves and move history")
	}
}

func TestApplyMoveRejectsInvalidInputWithoutMutation(t *testing.T) {
	game := NewFlipFlopGame(FlipFlop3x3)
	beforeBoard := game.GetBoardString()
	beforeTurn := game.CurrentTurn()
	beforeHistory := len(game.GetMoveHistory())

	for _, test := range []struct {
		name string
		move json.RawMessage
		want error
	}{
		{name: "malformed json", move: json.RawMessage(`{"from":`), want: apperrors.ErrInvalidMessageFormat},
		{name: "invalid position", move: json.RawMessage(`{"from":"A0","to":"A2"}`), want: apperrors.ErrInvalidMessageFormat},
		{name: "empty square", move: json.RawMessage(`{"from":"A2","to":"A3"}`), want: apperrors.ErrIllegalMove},
		{name: "blocked move", move: json.RawMessage(`{"from":"A1","to":"B1"}`), want: apperrors.ErrIllegalMove},
	} {
		t.Run(test.name, func(t *testing.T) {
			if err := game.ApplyMove(test.move); err != test.want {
				t.Fatalf("ApplyMove error = %v, want %v", err, test.want)
			}
			if game.GetBoardString() != beforeBoard || game.CurrentTurn() != beforeTurn || len(game.GetMoveHistory()) != beforeHistory {
				t.Fatal("rejected move mutated game state")
			}
		})
	}
}

func TestCaptureOnGoalAndUndoRestoresPiece(t *testing.T) {
	game := NewFlipFlopGame(FlipFlop3x3)
	white := game.Player1.Pieces[0]
	black := game.Player2.Pieces[0]
	game.Player1.Pieces = []*FFPiece{white}
	game.Player2.Pieces = []*FFPiece{black}
	game.Board = make([][]*FFPiece, 3)
	for row := range game.Board {
		game.Board[row] = make([]*FFPiece, 3)
	}
	white.Pos = FFBoardPos{Row: 1, Col: 0}
	white.Side = SIDE_BISHOP
	black.Pos = FFBoardPos{Row: 0, Col: 1}
	game.Board[1][0] = white
	game.Board[0][1] = black
	game.currentTurn = COLOR_WHITE
	game.Player1.ValidMoves = []ValidMove{{From: white.Pos, To: black.Pos}}
	game.Player2.ValidMoves = nil

	if err := game.ApplyMove(json.RawMessage(`{"from":"A2","to":"B3"}`)); err != nil {
		t.Fatalf("capture returned error: %v", err)
	}
	if game.Board[0][1] != white || game.Board[1][0] != nil || !black.Captured {
		t.Fatal("capture did not update board and captured state")
	}

	game.UndoLastMove()
	if game.Board[1][0] != white || game.Board[0][1] != black || black.Captured || white.Side != SIDE_BISHOP {
		t.Fatal("undo did not restore captured position")
	}
}

func TestNoMovesEndsGameForOpponent(t *testing.T) {
	game := NewFlipFlopGame(FlipFlop3x3)
	white := game.Player1.Pieces[0]
	game.Player1.Pieces = []*FFPiece{white}
	game.Player2.Pieces = nil
	game.Board = make([][]*FFPiece, 3)
	for row := range game.Board {
		game.Board[row] = make([]*FFPiece, 3)
	}
	white.Pos = FFBoardPos{Row: 2, Col: 0}
	game.Board[2][0] = white
	game.currentTurn = COLOR_WHITE
	game.Player1.ValidMoves = []ValidMove{{From: white.Pos, To: FFBoardPos{Row: 1, Col: 0}}}

	if err := game.ApplyMove(json.RawMessage(`{"from":"A1","to":"A2"}`)); err != nil {
		t.Fatalf("winning move returned error: %v", err)
	}
	if !game.IsGameEnded() || game.GetWinner() != COLOR_WHITE {
		t.Fatalf("terminal state = ended %v, winner %d; want white win", game.IsGameEnded(), game.GetWinner())
	}
	if err := game.ApplyMove(json.RawMessage(`{"from":"A2","to":"A3"}`)); err != apperrors.ErrGameEnded {
		t.Fatalf("move after game end error = %v, want %v", err, apperrors.ErrGameEnded)
	}
}

func TestThreefoldRepetitionEndsAsDraw(t *testing.T) {
	game := NewFlipFlopGame(FlipFlop3x3)
	white := game.Board[2][0]
	game.Board[2][0] = nil
	game.Board[1][0] = white
	white.Pos = FFBoardPos{Row: 1, Col: 0}
	white.Side = SIDE_BISHOP
	fenAfterMove := encodeBoardState(game.Board, COLOR_BLACK)
	game.Board[1][0] = nil
	game.Board[2][0] = white
	white.Pos = FFBoardPos{Row: 2, Col: 0}
	white.Side = SIDE_ROOK
	game.positionCounts[fenAfterMove] = 2

	if err := game.ApplyMove(json.RawMessage(`{"from":"A1","to":"A2"}`)); err != nil {
		t.Fatalf("repetition move returned error: %v", err)
	}
	if !game.IsGameEnded() || game.GetWinner() != PlayerSide(-1) {
		t.Fatalf("draw state = ended %v, winner %d; want ended draw", game.IsGameEnded(), game.GetWinner())
	}
}

func TestUndoWithoutHistoryIsNoOp(t *testing.T) {
	game := NewFlipFlopGame(FlipFlop5x5)
	before := game.GetBoardString()
	game.UndoLastMove()
	if game.GetBoardString() != before || game.CurrentTurn() != COLOR_WHITE {
		t.Fatal("UndoLastMove changed a new game")
	}
}
