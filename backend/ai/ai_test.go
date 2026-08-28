package ai

import (
	"context"
	"encoding/json"
	"reflect"
	"testing"

	"github.com/CDavidSV/online-flip-flop/games"
	"github.com/CDavidSV/online-flip-flop/internal/apperrors"
)

func TestNewAIValidatesDifficultyAndGameType(t *testing.T) {
	game := games.NewFlipFlopGame(games.FlipFlop3x3)

	for _, difficulty := range []AIDifficulty{"easy", "medium", "hard"} {
		got, err := NewAI(game, games.TYPE_FLIPFLOP3x3, difficulty)
		if err != nil || got == nil {
			t.Fatalf("NewAI(%q) = %v, %v; want an AI", difficulty, got, err)
		}
	}

	if got, err := NewAI(game, games.TYPE_FLIPFLOP3x3, AIDifficulty("expert")); err != apperrors.ErrInvalidAIDifficulty || got != nil {
		t.Fatalf("invalid difficulty = %v, %v; want nil, %v", got, err, apperrors.ErrInvalidAIDifficulty)
	}
	if got, err := NewAI(game, games.GameType("unknown"), "easy"); err == nil || got != nil {
		t.Fatalf("unsupported game type = %v, %v; want nil and an error", got, err)
	}
	if got, err := NewAI(&stubGame{}, games.TYPE_FLIPFLOP3x3, "easy"); err == nil || got != nil {
		t.Fatalf("incompatible game = %v, %v; want nil and an error", got, err)
	}
}

func TestFlipFlopAISetGameAndGetGame(t *testing.T) {
	first := games.NewFlipFlopGame(games.FlipFlop3x3)
	second := games.NewFlipFlopGame(games.FlipFlop5x5)
	ai := NewFlipFlopAI(first, "easy")

	if ai.GetGame() != first {
		t.Fatal("GetGame did not return the configured game")
	}
	ai.SetGame(second)
	if ai.GetGame() != second {
		t.Fatal("SetGame did not replace the configured game")
	}
}

func TestSerializeMove(t *testing.T) {
	move := serializeMove(games.FFBoardPos{Row: 2, Col: 0}, games.FFBoardPos{Row: 1, Col: 2}, 3)
	var got games.BaseMove
	if err := json.Unmarshal(move, &got); err != nil {
		t.Fatalf("serializeMove returned invalid JSON: %v", err)
	}
	if got != (games.BaseMove{From: "A1", To: "C2"}) {
		t.Fatalf("serialized move = %#v, want A1-C2", got)
	}
}

func TestCountingHelpers(t *testing.T) {
	captured := &games.FFPiece{Captured: true}
	active := &games.FFPiece{}
	player := &games.FFPlayer{Pieces: []*games.FFPiece{active, captured, active}}
	if got := countNonCapturedPieces(player); got != 2 {
		t.Fatalf("countNonCapturedPieces = %d, want 2", got)
	}

	moves := []games.ValidMove{
		{To: games.FFBoardPos{Row: 0, Col: 1}},
		{To: games.FFBoardPos{Row: 1, Col: 1}},
		{To: games.FFBoardPos{Row: 0, Col: 1}},
	}
	opponent := &games.FFPlayer{Goal: games.FFBoardPos{Row: 0, Col: 1}}
	if got := countWinningMoves(moves, opponent); got != 2 {
		t.Fatalf("countWinningMoves = %d, want 2", got)
	}
}

func TestFlipFlopAIGetBestMoveReturnsLegalMoveAndPreservesState(t *testing.T) {
	game := games.NewFlipFlopGame(games.FlipFlop3x3)
	ai := NewFlipFlopAI(game, "easy")
	before := gameSnapshot(game)

	move, err := ai.GetBestMove(context.Background(), games.COLOR_WHITE)
	if err != nil {
		t.Fatalf("GetBestMove returned error: %v", err)
	}
	if len(move) == 0 {
		t.Fatal("GetBestMove returned an empty move")
	}

	var decoded games.BaseMove
	if err := json.Unmarshal(move, &decoded); err != nil {
		t.Fatalf("best move is invalid JSON: %v", err)
	}
	if err := game.ApplyMove(move); err != nil {
		t.Fatalf("best move is not legal: %v", err)
	}
	game.UndoLastMove()
	if after := gameSnapshot(game); !reflect.DeepEqual(after, before) {
		t.Fatalf("game changed after search and apply/undo:\nbefore=%#v\nafter=%#v", before, after)
	}
}

func TestFlipFlopAIGetBestMoveRejectsWrongTurn(t *testing.T) {
	game := games.NewFlipFlopGame(games.FlipFlop3x3)
	ai := NewFlipFlopAI(game, "easy")

	move, err := ai.GetBestMove(context.Background(), games.COLOR_BLACK)
	if err != apperrors.ErrNotYourTurn || move != nil {
		t.Fatalf("wrong-turn result = %s, %v; want nil, %v", move, err, apperrors.ErrNotYourTurn)
	}
}

func TestFlipFlopAIGetBestMoveReturnsNilWhenNoMovesExist(t *testing.T) {
	game := games.NewFlipFlopGame(games.FlipFlop3x3)
	for _, piece := range game.Player1.Pieces {
		piece.Captured = true
	}
	game.Player1.ValidMoves = nil
	ai := NewFlipFlopAI(game, "easy")

	move, err := ai.GetBestMove(context.Background(), games.COLOR_WHITE)
	if err != nil || move != nil {
		t.Fatalf("no-move result = %s, %v; want nil, nil", move, err)
	}
}

func TestFlipFlopAICancelledContextReturnsFallbackMove(t *testing.T) {
	game := games.NewFlipFlopGame(games.FlipFlop3x3)
	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	move, err := NewFlipFlopAI(game, "hard").GetBestMove(ctx, games.COLOR_WHITE)
	if err != nil || len(move) == 0 {
		t.Fatalf("cancelled search = %s, %v; want a fallback move", move, err)
	}
	if err := game.ApplyMove(move); err != nil {
		t.Fatalf("cancelled search returned illegal move: %v", err)
	}
}

func TestFilterSafeMovesPreservesGameState(t *testing.T) {
	game := games.NewFlipFlopGame(games.FlipFlop3x3)
	ai := NewFlipFlopAI(game, "easy")
	ai.aiPlayer = game.Player1
	ai.opponentPlayer = game.Player2
	ai.ctx = context.Background()
	before := gameSnapshot(game)

	moves := ai.filterSafeMoves(game.Player1.ValidMoves, game.Player1)
	if len(moves) == 0 {
		t.Fatal("filterSafeMoves removed all legal opening moves")
	}
	if after := gameSnapshot(game); !reflect.DeepEqual(after, before) {
		t.Fatalf("filterSafeMoves changed game state:\nbefore=%#v\nafter=%#v", before, after)
	}
}

func TestInCheck(t *testing.T) {
	game := games.NewFlipFlopGame(games.FlipFlop3x3)
	ai := NewFlipFlopAI(game, "easy")
	ai.aiPlayer = game.Player1
	ai.opponentPlayer = game.Player2
	ai.ctx = context.Background()

	if ai.inCheck(game.Player1) {
		t.Fatal("white should not be in check at the start")
	}
	game.Board[game.Player1.Goal.Row][game.Player1.Goal.Col] = game.Player2.Pieces[1]
	if !ai.inCheck(game.Player1) {
		t.Fatal("white should be in check when black occupies its goal")
	}
}

type snapshot struct {
	board       string
	turn        games.PlayerSide
	ended       bool
	winner      games.PlayerSide
	history     []games.MoveHistoryEntry
	whiteMoves  []games.ValidMove
	blackMoves  []games.ValidMove
	pieceStates []pieceSnapshot
}

type pieceSnapshot struct {
	color    games.PlayerSide
	side     games.PieceSide
	position games.FFBoardPos
	captured bool
}

func gameSnapshot(game *games.FlipFlop) snapshot {
	pieces := make([]pieceSnapshot, 0, len(game.Player1.Pieces)+len(game.Player2.Pieces))
	for _, player := range []*games.FFPlayer{game.Player1, game.Player2} {
		for _, piece := range player.Pieces {
			pieces = append(pieces, pieceSnapshot{
				color: piece.Color, side: piece.Side, position: piece.Pos, captured: piece.Captured,
			})
		}
	}
	return snapshot{
		board: game.GetBoardString(), turn: game.CurrentTurn(), ended: game.IsGameEnded(), winner: game.GetWinner(),
		history:    append([]games.MoveHistoryEntry(nil), game.GetMoveHistory()...),
		whiteMoves: append([]games.ValidMove(nil), game.Player1.ValidMoves...),
		blackMoves: append([]games.ValidMove(nil), game.Player2.ValidMoves...), pieceStates: pieces,
	}
}

type stubGame struct{}

func (s *stubGame) ApplyMove(json.RawMessage) error          { return nil }
func (s *stubGame) CurrentTurn() games.PlayerSide            { return games.COLOR_WHITE }
func (s *stubGame) GetBoardString() string                   { return "" }
func (s *stubGame) IsGameEnded() bool                        { return false }
func (s *stubGame) GetWinner() games.PlayerSide              { return games.PlayerSide(-1) }
func (s *stubGame) UndoLastMove()                            {}
func (s *stubGame) GetMoveHistory() []games.MoveHistoryEntry { return nil }
