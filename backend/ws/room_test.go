package ws

import (
	"encoding/json"
	"io"
	"log/slog"
	"testing"
	"time"

	"github.com/CDavidSV/online-flip-flop/ai"
	"github.com/CDavidSV/online-flip-flop/games"
	"github.com/CDavidSV/online-flip-flop/internal/apperrors"
)

func newTestRoom(t *testing.T, mode GameMode) *GameRoom {
	t.Helper()
	room, err := NewGameRoom(RoomConfig{
		ID: "Ab12", GameMode: mode, AIDifficulty: ai.AIDifficulty("easy"),
		GameType: games.TYPE_FLIPFLOP3x3,
		Logger:   slog.New(slog.NewTextHandler(io.Discard, nil)),
	}, InitialPlayer{ClientID: "player-1", Username: "Alice"})
	if err != nil {
		t.Fatalf("NewGameRoom returned error: %v", err)
	}
	return room
}

func TestNewGameRoomInitializesPlayers(t *testing.T) {
	multiplayer := newTestRoom(t, "multiplayer")
	if multiplayer.status != StatusWaiting || multiplayer.player1 == nil || multiplayer.player2 != nil {
		t.Fatalf("multiplayer room has unexpected initial state: %#v", multiplayer)
	}
	if multiplayer.player1.Color != games.COLOR_WHITE || !multiplayer.player1.IsActive {
		t.Fatalf("first player = %#v, want active white player", multiplayer.player1)
	}

	singleplayer := newTestRoom(t, "singleplayer")
	if singleplayer.status != StatusWaitingStart || singleplayer.ai == nil {
		t.Fatal("singleplayer room should wait to start with an initialized AI")
	}
	if singleplayer.player2 == nil || !singleplayer.player2.IsAI || singleplayer.player2.Color != games.COLOR_BLACK {
		t.Fatalf("AI player = %#v, want active black AI player", singleplayer.player2)
	}
}

func TestNewGameRoomRejectsInvalidGameType(t *testing.T) {
	_, err := NewGameRoom(RoomConfig{GameType: games.GameType("invalid")}, InitialPlayer{})
	if err == nil {
		t.Fatal("NewGameRoom should reject an invalid game type")
	}
}

func TestEnterRoomAssignsSecondPlayerAndSpectator(t *testing.T) {
	room := newTestRoom(t, "multiplayer")

	isSpectator, err := room.EnterRoom("player-2", nil, "Bob")
	if err != nil || isSpectator || room.player2 == nil {
		t.Fatalf("second player join = (%v, %v), player = %#v", isSpectator, err, room.player2)
	}
	if room.player2.Color != games.COLOR_BLACK || room.status != StatusWaitingStart {
		t.Fatalf("second player/state = %#v/%q, want black/waiting", room.player2, room.status)
	}

	room.conns = map[string]*ClientConnection{}
	isSpectator, err = room.EnterRoom("spectator", nil, "Sam")
	if err != nil || !isSpectator || !room.conns["spectator"].isSpectator {
		t.Fatalf("spectator join = (%v, %v), connection = %#v", isSpectator, err, room.conns["spectator"])
	}
	if count := room.GetSpectatorCount(); count != 1 {
		t.Fatalf("spectator count = %d, want 1", count)
	}
}

func TestEnterRoomValidation(t *testing.T) {
	room := newTestRoom(t, "multiplayer")
	if _, err := room.EnterRoom("player-2", nil, ""); err != apperrors.ErrUsernameRequired {
		t.Fatalf("missing username error = %v, want %v", err, apperrors.ErrUsernameRequired)
	}
	singleplayer := newTestRoom(t, "singleplayer")
	if _, err := singleplayer.EnterRoom("player-2", nil, "Bob"); err != apperrors.ErrRoomFull {
		t.Fatalf("singleplayer join error = %v, want %v", err, apperrors.ErrRoomFull)
	}
}

func TestValidateActionStatus(t *testing.T) {
	room := newTestRoom(t, "multiplayer")
	for _, test := range []struct {
		status Status
		ended  bool
		want   error
	}{
		{status: StatusOngoing},
		{status: StatusWaiting, want: apperrors.ErrGameNotStarted},
		{status: StatusClosed, want: apperrors.ErrRoomClosed},
		{status: StatusOngoing, ended: true, want: apperrors.ErrGameEnded},
	} {
		room.status = test.status
		room.Game = &endedGame{ended: test.ended}
		if err := room.validateActionStatus(); err != test.want {
			t.Fatalf("status %q ended=%v: error = %v, want %v", test.status, test.ended, err, test.want)
		}
	}
}

func TestGetMessagesReturnsLast100(t *testing.T) {
	room := newTestRoom(t, "multiplayer")
	for i := range 105 {
		room.messages = append(room.messages, SavedMessage{Message: string(rune(i))})
	}
	messages := room.GetMessages()
	if len(messages) != 100 || messages[0].Message != string(rune(5)) {
		t.Fatalf("messages = len %d, first %q; want len 100, fifth message", len(messages), messages[0].Message)
	}
}

func TestCloseRoomIfTimedOutForInactiveRoom(t *testing.T) {
	room := newTestRoom(t, "multiplayer")
	room.lastInactiveTime = time.Now().Add(-time.Hour)
	room.player1.IsActive = false
	room.conns = map[string]*ClientConnection{}
	room.CloseRoomIfTimedOut()
	if !room.IsClosed() {
		t.Fatal("inactive room should be closed")
	}
}

func TestCloseRoomIfTimedOutForLongGame(t *testing.T) {
	room := newTestRoom(t, "multiplayer")
	gameStartTime := time.Now().Add(-3 * time.Hour)
	room.gameStartTime = &gameStartTime
	room.conns = map[string]*ClientConnection{}
	room.CloseRoomIfTimedOut()
	if !room.IsClosed() {
		t.Fatal("long-running game should be closed")
	}
}

type endedGame struct{ ended bool }

func (g *endedGame) ApplyMove(json.RawMessage) error          { return nil }
func (g *endedGame) CurrentTurn() games.PlayerSide            { return games.COLOR_WHITE }
func (g *endedGame) GetBoardString() string                   { return "" }
func (g *endedGame) IsGameEnded() bool                        { return g.ended }
func (g *endedGame) GetWinner() games.PlayerSide              { return -1 }
func (g *endedGame) UndoLastMove()                            {}
func (g *endedGame) GetMoveHistory() []games.MoveHistoryEntry { return nil }
