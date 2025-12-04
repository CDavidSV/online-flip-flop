package ws

import (
	"encoding/json"
	"log/slog"
	"sync"

	"github.com/CDavidSV/online-flip-flop/games"
	"github.com/CDavidSV/online-flip-flop/internal/apperrors"
	"github.com/CDavidSV/online-flip-flop/internal/types"
	"github.com/lxzan/gws"
)

type Status string

// Represents a player in the room.
type PlayerSlot struct {
	ID       string           `json:"id"`
	Username string           `json:"username"`
	Color    games.PlayerSide `json:"color"`
	IsAI     bool             `json:"is_ai"`
	IsActive bool             `json:"is_active"`
}

// Holds the client connection and whether they are a spectator or not.
type ClientConnection struct {
	ID          string
	Username    string
	conn        *gws.Conn
	isSpectator bool
}

type GameState struct {
	Board       string           `json:"board"`
	CurrentTurn games.PlayerSide `json:"current_turn"`
	Status      Status           `json:"status"`
	Winner      games.PlayerSide `json:"winner"`
	Players     []PlayerSlot     `json:"players"`
}

type GameRoom struct {
	ID       string
	Game     games.Game
	GameMode GameMode
	GameType games.GameType
	player1  *PlayerSlot
	player2  *PlayerSlot
	conns    map[string]*ClientConnection
	status   Status
	logger   *slog.Logger
	mu       sync.RWMutex
}

const (
	StatusWaiting Status = "waiting_for_players" // Initial state, waiting for players to join.
	StatusOngoing Status = "ongoing"             // Players have joined and the game has started.
	StatusClosed  Status = "closed"              // Game has ended or room is closed (no active players).
)

// Create and returns a new GameRoom instance.
func NewGameRoom(id string, game games.Game, gameMode GameMode, gameType games.GameType, logger *slog.Logger) *GameRoom {
	return &GameRoom{
		ID:       id,
		Game:     game,
		GameMode: gameMode,
		GameType: gameType,
		conns:    make(map[string]*ClientConnection),
		status:   StatusWaiting,
		logger:   logger,
	}
}

// Broadcasts a game update to all connections in the room, skipping the connection with skipID if provided.
// A lock is required before calling this method.
func (gr *GameRoom) broadcastGameUpdate(action MsgType, payload any, skipID *string) {
	msg := NewMessage(action, payload, "") // RequestID is empty since it's a broadcast

	// Use GWS broadcaster to only encode the message once
	b := gws.NewBroadcaster(gws.OpcodeText, msg)
	defer b.Close()

	for id, connData := range gr.conns {
		// Skip only the connections with the clientID that matches the provided skipID
		if skipID != nil && id == *skipID {
			continue
		}

		err := b.Broadcast(connData.conn)
		if err != nil {
			gr.logger.Error("Failed to broadcast message", "error", err)
		}
	}
}

// Called when the game ends to update room status and notify connected clients.
// Requires a Write lock before calling.
func (gr *GameRoom) endGame(reason string, winner games.PlayerSide) {
	gr.status = StatusClosed
	payload := types.JSONMap{"reason": reason}
	if winner != -1 {
		payload["winner"] = winner
	}
	gr.broadcastGameUpdate(MsgTypeGameEnd, payload, nil)
}

// Called when the game ends to update room status and notify connected clients.
// This is the public version that can be called from the server.
func (gr *GameRoom) EndGame(reason string, winner games.PlayerSide) {
	gr.mu.Lock()
	defer gr.mu.Unlock()
	gr.endGame(reason, winner)
}

// Constructs and returns the current game state.
// Requires a Read lock before calling.
func (gr *GameRoom) gameState() GameState {
	players := make([]PlayerSlot, 2)
	if gr.player1 != nil {
		players[0] = *gr.player1
	}
	if gr.player2 != nil {
		players[1] = *gr.player2
	}

	return GameState{
		Board:       gr.Game.GetBoardString(),
		CurrentTurn: gr.Game.CurrentTurn(),
		Players:     players,
		Status:      gr.status,
		Winner:      gr.Game.GetWinner(),
	}
}

// Retrieves a player from by their ID.
// Requires a Read lock before calling.
func (gr *GameRoom) getPlayer(id string) *PlayerSlot {
	if gr.player1 != nil && gr.player1.ID == id {
		return gr.player1
	}
	if gr.player2 != nil && gr.player2.ID == id {
		return gr.player2
	}
	return nil
}

// Checks if both player slots are inactive (either nil or not active).
// Requires a Read lock before calling.
func (gr *GameRoom) playersInactive() bool {
	return (gr.player1 == nil || !gr.player1.IsActive) && (gr.player2 == nil || !gr.player2.IsActive)
}

// Checks if both player slots are active.
// Requires a Read lock before calling.
func (gr *GameRoom) playersActive() bool {
	return !gr.playersInactive()
}

// Checks if the room and game status allow an action to proceed. Returns an error if not.
func (gr *GameRoom) validateActionStatus() error {
	switch {
	case gr.Game.IsGameEnded():
		return apperrors.ErrGameEnded
	case gr.status == StatusClosed:
		return apperrors.ErrRoomClosed
	case gr.status != StatusOngoing:
		return apperrors.ErrGameNotStarted
	}
	return nil
}

// Called when a client requests to join a room.
// Returns whether the client is a spectator.
func (gr *GameRoom) EnterRoom(id string, conn *gws.Conn, username string) (isSpectator bool, err error) {
	gr.mu.Lock()
	defer gr.mu.Unlock()

	if gr.Game.IsGameEnded() {
		return false, apperrors.ErrGameEnded
	}

	if gr.status == StatusClosed {
		return false, apperrors.ErrRoomClosed
	}

	clientConnection := &ClientConnection{
		ID:          id,
		conn:        conn,
		isSpectator: false,
		Username:    username,
	}
	gr.conns[id] = clientConnection

	player := gr.getPlayer(id)
	if player != nil {
		// Reconnecting player
		player.IsActive = true

		// Notify player rejoined
		gr.broadcastGameUpdate(MsgPlayerRejoined, types.JSONMap{
			"player_id": id,
		}, &id)

		return false, nil
	}

	var assignedSlot **PlayerSlot
	var color games.PlayerSide

	// Check for available player slots
	if gr.player1 == nil {
		assignedSlot = &gr.player1
		color = games.COLOR_WHITE
	} else if gr.player2 == nil {
		assignedSlot = &gr.player2
		color = games.COLOR_BLACK
	}

	if assignedSlot != nil {
		*assignedSlot = &PlayerSlot{
			ID:       id,
			Username: username,
			Color:    color,
			IsAI:     false,
			IsActive: true,
		}
		return false, nil
	}

	// Join as spectator
	clientConnection.isSpectator = true

	return true, nil
}

// Called when a client leaves the room.
// If all players leave, the room then is closed for cleanup.
func (gr *GameRoom) LeaveRoom(id string) {
	gr.mu.Lock()
	defer gr.mu.Unlock()

	delete(gr.conns, id)

	player := gr.getPlayer(id)
	if player != nil {
		player.IsActive = false

		gr.broadcastGameUpdate(MsgPlayerLeftRoom, types.JSONMap{
			"player_id": id,
		}, nil)

		if gr.playersInactive() {
			gr.status = StatusClosed

			if len(gr.conns) > 0 {
				// Notify spectators that the room is closed
				gr.broadcastGameUpdate(MsgTypeGameEnd, types.JSONMap{
					"reason": "players_left",
				}, nil)
			}
		}
	}

}

// Starts the game if both player slots are filled and active.
// Returns a boolean indicating if the game was started.
func (gr *GameRoom) StartGame() bool {
	gr.mu.Lock()
	defer gr.mu.Unlock()

	if gr.status == StatusOngoing || gr.status == StatusClosed {
		return false
	}

	if gr.playersActive() {
		gr.status = StatusOngoing
		gr.broadcastGameUpdate(MsgTypeGameStart, gr.gameState(), nil)
		return true
	}

	return false
}

// Handles a move made by a player.
// Registers and validates the move according to game rules and broadcasts the update.
// Returns the player's color to allow server-side processing.
func (gr *GameRoom) HandleMove(clientID, requestID string, movePayload json.RawMessage) (games.PlayerSide, error) {
	gr.mu.Lock()
	defer gr.mu.Unlock()

	if err := gr.validateActionStatus(); err != nil {
		return -1, err
	}

	// Verify the player exists and get their color
	player := gr.getPlayer(clientID)
	if player == nil {
		return -1, apperrors.ErrClientNotFound
	}

	// Check if it's the player's turn
	if player.Color != gr.Game.CurrentTurn() {
		return -1, apperrors.ErrNotYourTurn
	}

	err := gr.Game.ApplyMove(movePayload)
	if err != nil {
		return -1, err
	}

	if clientConn, ok := gr.conns[clientID]; ok {
		// Acknowledge the move to the player immediately
		ackMsg := NewMessage(MsgTypeAck, nil, requestID)
		clientConn.conn.WriteAsync(gws.OpcodeText, ackMsg, func(err error) {
			if err != nil {
				gr.logger.Error("Failed to send move acknowledgment", "error", err)
			}
		})
	}

	gr.broadcastGameUpdate(MsgTypeMove, types.JSONMap{
		"player_id": clientID,
		"color":     player.Color,
		"move":      movePayload,
		"board":     gr.Game.GetBoardString(),
	}, &clientID)

	if gr.Game.IsGameEnded() {
		if gr.Game.GetWinner() == -1 {
			gr.endGame("draw", -1)
		} else {
			gr.endGame("normal", gr.Game.GetWinner())
		}
	}

	return player.Color, nil
}

// Handles a forfeit request from a player, awarding victory to the opponent, and closing the room.
func (gr *GameRoom) HandleForfeit(clientID string) error {
	gr.mu.Lock()
	defer gr.mu.Unlock()

	if err := gr.validateActionStatus(); err != nil {
		return err
	}

	player := gr.getPlayer(clientID)
	if player == nil {
		return apperrors.ErrClientNotFound
	}

	// Determine opponent's color
	var opponentColor games.PlayerSide
	if player.Color == games.COLOR_WHITE {
		opponentColor = games.COLOR_BLACK
	} else {
		opponentColor = games.COLOR_WHITE
	}

	gr.endGame("forfeit", opponentColor)
	return nil
}

// Handles a chat message sent by a client and broadcasts it to other clients.
func (gr *GameRoom) HandleChatMessage(clientID, requestID, message string) error {
	gr.mu.RLock()
	defer gr.mu.RUnlock()

	if gr.status == StatusClosed {
		return apperrors.ErrRoomClosed
	}

	sender, ok := gr.conns[clientID]
	if !ok {
		return apperrors.ErrClientNotFound
	}

	// Ignore empty messages
	if message == "" {
		return nil
	}

	msg := NewMessage(MsgTypeChat, types.JSONMap{
		"client_id": clientID,
		"username":  sender.Username,
		"message":   message,
	}, "")

	ackMsg := NewMessage(MsgTypeAck, nil, requestID)
	sender.conn.WriteAsync(gws.OpcodeText, ackMsg, func(err error) {
		if err != nil {
			gr.logger.Error("Failed to send move acknowledgment", "error", err)
		}
	})

	b := gws.NewBroadcaster(gws.OpcodeText, msg)
	defer b.Close()

	// Broadcast message to spectators or players
	for _, clientConn := range gr.conns {
		if clientConn.ID == clientID {
			continue
		}

		if clientConn.isSpectator == sender.isSpectator {
			if err := b.Broadcast(clientConn.conn); err != nil {
				gr.logger.Error("Failed to broadcast chat message", "error", err)
			}
		}
	}

	return nil
}

// Get current game state.
func (gr *GameRoom) GetGameState() GameState {
	gr.mu.RLock()
	defer gr.mu.RUnlock()

	return gr.gameState()
}

// Returns a copy of all connections in the room.
func (gr *GameRoom) GetPlayerConnections() []*gws.Conn {
	gr.mu.RLock()
	defer gr.mu.RUnlock()

	conns := make([]*gws.Conn, 0, len(gr.conns))
	for _, connData := range gr.conns {
		conns = append(conns, connData.conn)
	}
	return conns
}

// Checks if the room is closed.
func (gr *GameRoom) IsClosed() bool {
	gr.mu.RLock()
	defer gr.mu.RUnlock()

	return gr.status == StatusClosed
}
