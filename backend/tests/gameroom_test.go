// package tests

// import (
// 	"encoding/json"
// 	"log/slog"
// 	"net/http"
// 	"net/http/httptest"
// 	"os"
// 	"strings"
// 	"testing"
// 	"time"

// 	"github.com/CDavidSV/online-flip-flop/games"
// 	"github.com/CDavidSV/online-flip-flop/ws"
// 	"github.com/lxzan/gws"
// 	"github.com/stretchr/testify/assert"
// 	"github.com/stretchr/testify/mock"
// )

// type MockGame struct {
// 	mock.Mock
// }

// func (m *MockGame) ApplyMove(movePayload json.RawMessage) error {
// 	args := m.Called(movePayload)
// 	return args.Error(0)
// }

// func (m *MockGame) GetBoardString() string {
// 	args := m.Called()
// 	return args.String(0)
// }

// func (m *MockGame) CurrentTurn() games.PlayerSide {
// 	args := m.Called()
// 	return args.Get(0).(games.PlayerSide)
// }

// func (m *MockGame) IsGameEnded() bool {
// 	args := m.Called()
// 	return args.Bool(0)
// }

// func (m *MockGame) GetWinner() games.PlayerSide {
// 	args := m.Called()
// 	return args.Get(0).(games.PlayerSide)
// }

// // Helper function to create a test WebSocket server
// func createTestServer(t *testing.T) *httptest.Server {
// 	upgrader := gws.NewUpgrader(&gws.BuiltinEventHandler{}, &gws.ServerOption{
// 		ParallelEnabled:   true,
// 		Recovery:          gws.Recovery,
// 		PermessageDeflate: gws.PermessageDeflate{Enabled: true},
// 	})

// 	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
// 		conn, err := upgrader.Upgrade(w, r)
// 		if err != nil {
// 			t.Logf("Upgrade error: %v", err)
// 			return
// 		}
// 		go func() {
// 			conn.ReadLoop()
// 		}()
// 	}))

// 	return server
// }

// // Helper function to create a test WebSocket client
// func createTestClient(t *testing.T, serverURL string, handler gws.Event) *gws.Conn {
// 	wsURL := strings.Replace(serverURL, "http://", "ws://", 1)

// 	client, _, err := gws.NewClient(handler, &gws.ClientOption{
// 		Addr: wsURL,
// 	})
// 	assert.NoError(t, err)

// 	go func() {
// 		client.ReadLoop()
// 	}()

// 	return client
// }

// // Helper function to create a test logger
// func newTestLogger() *slog.Logger {
// 	return slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{
// 		Level: slog.LevelError,
// 	}))
// }

// func TestGameRoom_EnterRoom_FirstPlayer(t *testing.T) {
// 	server := createTestServer(t)
// 	defer server.Close()

// 	conn := createTestClient(t, server.URL, &gws.BuiltinEventHandler{})
// 	defer conn.WriteClose(1000, nil)
// 	time.Sleep(100 * time.Millisecond)

// 	mockGame := new(MockGame)
// 	mockGame.On("IsGameEnded").Return(false)
// 	mockGame.On("GetBoardString").Return("board")
// 	mockGame.On("CurrentTurn").Return(games.PlayerSide(games.COLOR_WHITE))

// 	gr := ws.NewGameRoom("room123", mockGame, ws.GameModeMultiplayer, games.TYPE_FLIPFLOP5x5, newTestLogger())

// 	isSpectator, err := gr.EnterRoom("player1", conn, "Alice")

// 	assert.NoError(t, err)
// 	assert.False(t, isSpectator)

// 	// Verify through public API
// 	state := gr.GetGameState()
// 	assert.Equal(t, "player1", state.Players[0].ID)
// 	assert.Equal(t, "Alice", state.Players[0].Username)
// 	assert.True(t, state.Players[0].IsActive)
// 	assert.Equal(t, games.COLOR_WHITE, state.Players[0].Color)

// 	conns := gr.GetPlayerConnections()
// 	assert.Len(t, conns, 1)
// 	assert.Contains(t, conns, conn)
// }

// func TestGameRoom_EnterRoom_TwoPlayers(t *testing.T) {
// 	server := createTestServer(t)
// 	defer server.Close()

// 	conn1 := createTestClient(t, server.URL, &gws.BuiltinEventHandler{})
// 	defer conn1.WriteClose(1000, nil)
// 	conn2 := createTestClient(t, server.URL, &gws.BuiltinEventHandler{})
// 	defer conn2.WriteClose(1000, nil)
// 	time.Sleep(100 * time.Millisecond)

// 	mockGame := new(MockGame)
// 	mockGame.On("IsGameEnded").Return(false)
// 	mockGame.On("GetBoardString").Return("board")
// 	mockGame.On("CurrentTurn").Return(games.PlayerSide(games.COLOR_WHITE))

// 	gr := ws.NewGameRoom("room123", mockGame, ws.GameModeMultiplayer, games.TYPE_FLIPFLOP5x5, newTestLogger())

// 	isSpectator1, err1 := gr.EnterRoom("player1", conn1, "Alice")
// 	isSpectator2, err2 := gr.EnterRoom("player2", conn2, "Bob")

// 	assert.NoError(t, err1)
// 	assert.NoError(t, err2)
// 	assert.False(t, isSpectator1)
// 	assert.False(t, isSpectator2)

// 	// Verify through public API
// 	state := gr.GetGameState()
// 	assert.Equal(t, "player1", state.Players[0].ID)
// 	assert.Equal(t, "player2", state.Players[1].ID)
// 	assert.Equal(t, "Alice", state.Players[0].Username)
// 	assert.Equal(t, "Bob", state.Players[1].Username)

// 	conns := gr.GetPlayerConnections()
// 	assert.Len(t, conns, 2)
// 	assert.Contains(t, conns, conn1)
// 	assert.Contains(t, conns, conn2)
// }

// func TestGameRoom_EnterRoom_ThirdPlayerBecomesSpectator(t *testing.T) {
// 	server := createTestServer(t)
// 	defer server.Close()

// 	conn1 := createTestClient(t, server.URL, &gws.BuiltinEventHandler{})
// 	defer conn1.WriteClose(1000, nil)
// 	conn2 := createTestClient(t, server.URL, &gws.BuiltinEventHandler{})
// 	defer conn2.WriteClose(1000, nil)
// 	conn3 := createTestClient(t, server.URL, &gws.BuiltinEventHandler{})
// 	defer conn3.WriteClose(1000, nil)
// 	time.Sleep(100 * time.Millisecond)

// 	mockGame := new(MockGame)
// 	mockGame.On("IsGameEnded").Return(false)
// 	mockGame.On("GetBoardString").Return("board")
// 	mockGame.On("CurrentTurn").Return(games.PlayerSide(games.COLOR_WHITE))

// 	gr := ws.NewGameRoom("room123", mockGame, ws.GameModeMultiplayer, games.TYPE_FLIPFLOP5x5, newTestLogger())

// 	gr.EnterRoom("player1", conn1, "Alice")
// 	gr.EnterRoom("player2", conn2, "Bob")
// 	isSpectator, err := gr.EnterRoom("spectator1", conn3, "Charlie")

// 	assert.NoError(t, err)
// 	assert.True(t, isSpectator)

// 	// Verify all connections are tracked
// 	conns := gr.GetPlayerConnections()
// 	assert.Len(t, conns, 3)
// 	assert.Contains(t, conns, conn1)
// 	assert.Contains(t, conns, conn2)
// 	assert.Contains(t, conns, conn3)

// 	// Verify game state only shows players, not spectators
// 	state := gr.GetGameState()
// 	assert.Len(t, state.Players, 2)
// 	assert.Equal(t, "player1", state.Players[0].ID)
// 	assert.Equal(t, "player2", state.Players[1].ID)
// }
