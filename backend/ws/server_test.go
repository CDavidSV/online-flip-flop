package ws

import (
	"io"
	"log/slog"
	"testing"
)

func TestGenerateRoomIDReturnsUniqueFourCharacterID(t *testing.T) {
	server := NewGameServer(slog.New(slog.NewTextHandler(io.Discard, nil)))
	id, err := server.generateRoomID()
	if err != nil || len(id) != 4 {
		t.Fatalf("generateRoomID = %q, %v; want a four-character ID", id, err)
	}
	server.rooms.Store(id, newTestRoom(t, "multiplayer"))
	secondID, err := server.generateRoomID()
	if err != nil || secondID == id {
		t.Fatalf("second room ID = %q, %v; must differ from %q", secondID, err, id)
	}
}

func TestGetGameRoom(t *testing.T) {
	server := NewGameServer(slog.New(slog.NewTextHandler(io.Discard, nil)))
	room := newTestRoom(t, "multiplayer")
	server.rooms.Store(room.ID, room)
	if server.GetGameRoom(room.ID) != room {
		t.Fatal("GetGameRoom did not return stored room")
	}
	if server.GetGameRoom("missing") != nil {
		t.Fatal("GetGameRoom should return nil for an unknown room")
	}
}

func TestMustLoadReturnsZeroValueForMissingKey(t *testing.T) {
	if got := mustLoad[string](emptySessionStorage{}, "client_id"); got != "" {
		t.Fatalf("missing string = %q, want empty string", got)
	}
}

type emptySessionStorage struct{}

func (emptySessionStorage) Len() int { return 0 }
func (emptySessionStorage) Load(string) (any, bool) { return nil, false }
func (emptySessionStorage) Delete(string) {}
func (emptySessionStorage) Store(string, any) {}
func (emptySessionStorage) Range(func(string, any) bool) {}