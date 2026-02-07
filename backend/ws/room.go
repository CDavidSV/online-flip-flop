package ws

import (
	"context"
	"encoding/json"
	"log/slog"
	"sync"
	"time"

	"github.com/CDavidSV/online-flip-flop/ai"
	"github.com/CDavidSV/online-flip-flop/config"
	"github.com/CDavidSV/online-flip-flop/games"
	"github.com/CDavidSV/online-flip-flop/internal/apperrors"
	"github.com/CDavidSV/online-flip-flop/internal/types"
	"github.com/google/uuid"
	"github.com/lxzan/gws"
)

type Status string

// Represents a player in the room.
type PlayerSlot struct {
	ID           string           `json:"id"`
	Username     string           `json:"username"`
	Color        games.PlayerSide `json:"color"`
	IsAI         bool             `json:"is_ai"`
	IsActive     bool             `json:"is_active"`
	wantsRematch bool             `json:"-"`
}

// Holds the client connection and whether they are a spectator or not.
type ClientConnection struct {
	ID          string
	Username    string
	conn        *gws.Conn
	isSpectator bool
}

type GameState struct {
	Board       string                   `json:"board"`
	CurrentTurn games.PlayerSide         `json:"current_turn"`
	Status      Status                   `json:"status"`
	Winner      games.PlayerSide         `json:"winner"`
	Players     []PlayerSlot             `json:"players"`
	MoveHistory []games.MoveHistoryEntry `json:"move_history"`
}

type SavedMessage struct {
	ClientID string `json:"client_id"`
	Username string `json:"username"`
	Message  string `json:"message"`
}

type GameRoom struct {
	ID                string
	Game              games.Game
	GameMode          GameMode
	GameType          games.GameType
	ai                ai.AI
	aiThinking        bool
	aiCancelFunc      context.CancelFunc
	player1           *PlayerSlot
	player2           *PlayerSlot
	conns             map[string]*ClientConnection
	status            Status
	logger            *slog.Logger
	mu                sync.RWMutex
	playerMessages    []SavedMessage
	spectatorMessages []SavedMessage
}

const (
	StatusWaiting Status = "waiting_for_players" // Initial state, waiting for players to join.
	StatusOngoing Status = "ongoing"             // Players have joined and the game has started.
	StatusEnded   Status = "ended"               // Game has ended but room is still open.
	StatusClosed  Status = "closed"              // Game has ended or room is closed (no active players).
)

type RoomConfig struct {
	ID           string
	GameMode     GameMode
	AIDifficulty ai.AIDifficulty
	GameType     games.GameType
	Logger       *slog.Logger
}

type InitialPlayer struct {
	ClientID string
	Username string
	Conn     *gws.Conn
}

// Create and returns a new GameRoom instance with the first player already set up.
func NewGameRoom(config RoomConfig, player InitialPlayer) (*GameRoom, error) {
	game, err := games.NewGame(config.GameType)
	if err != nil {
		return nil, err
	}

	room := &GameRoom{
		ID:                config.ID,
		Game:              game,
		GameMode:          config.GameMode,
		GameType:          config.GameType,
		conns:             make(map[string]*ClientConnection),
		status:            StatusWaiting,
		logger:            config.Logger,
		playerMessages:    []SavedMessage{},
		spectatorMessages: []SavedMessage{},
	}

	// Set up first player
	room.player1 = &PlayerSlot{
		ID:           player.ClientID,
		Username:     player.Username,
		Color:        games.COLOR_WHITE,
		IsAI:         false,
		IsActive:     true,
		wantsRematch: false,
	}

	room.conns[player.ClientID] = &ClientConnection{
		ID:          player.ClientID,
		Username:    player.Username,
		conn:        player.Conn,
		isSpectator: false,
	}

	// Set up AI player for singleplayer mode
	if config.GameMode == "singleplayer" {
		// Initialize AI for this game type
		gameAI, err := ai.NewAI(game, config.GameType, config.AIDifficulty)
		if err != nil {
			config.Logger.Error("Failed to initialize AI", "game_type", config.GameType, "error", err)
			return nil, err
		} else {
			room.ai = gameAI
		}

		// AI player will always be player 2 with black pieces
		room.player2 = &PlayerSlot{
			ID:           uuid.New().String(),
			Username:     gameAI.Name(),
			Color:        games.COLOR_BLACK,
			IsAI:         true,
			IsActive:     true,
			wantsRematch: false,
		}
	}

	return room, nil
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
	gr.status = StatusEnded
	payload := types.JSONMap{"reason": reason}
	if winner != -1 {
		payload["winner"] = winner
	}
	gr.broadcastGameUpdate(MsgTypeGameEnd, payload, nil)

	// If the game mode is single player and the ai is thinking, cancel the computation
	if gr.GameMode == "singleplayer" && gr.aiThinking {
		gr.cancelAIComputation()
	}

	// If the game mode is singleplayer, the ai will request for a rematch
	if gr.GameMode == "singleplayer" {
		// Request rematch by the ai (player2) after a short delay
		go func() {
			time.Sleep(2 * time.Second)
			gr.RequestRematch(gr.player2.ID)
		}()
	}
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
		MoveHistory: gr.Game.GetMoveHistory(),
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

	if gr.status == StatusClosed {
		return false, apperrors.ErrRoomClosed
	}

	player := gr.getPlayer(id)
	if player != nil {
		if player.IsActive {
			// Player is already active in the room
			return false, apperrors.ErrAlreadyInGame
		}

		// Reconnecting player
		player.IsActive = true

		clientConnection := &ClientConnection{
			ID:          id,
			conn:        conn,
			isSpectator: false,
			Username:    player.Username,
		}
		gr.conns[id] = clientConnection

		// Notify player rejoined
		gr.broadcastGameUpdate(MsgPlayerRejoined, types.JSONMap{
			"player_id":  id,
			"game_state": gr.gameState(),
		}, &id)

		return false, nil
	}

	if gr.GameMode == "singleplayer" {
		return false, apperrors.ErrRoomFull
	}

	// For a new player username is required
	if username == "" {
		return false, apperrors.ErrUsernameRequired
	}

	clientConnection := &ClientConnection{
		ID:          id,
		conn:        conn,
		isSpectator: false,
		Username:    username,
	}
	gr.conns[id] = clientConnection

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
			ID:           id,
			Username:     username,
			Color:        color,
			IsAI:         false,
			IsActive:     true,
			wantsRematch: false,
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
		player.wantsRematch = false

		gr.broadcastGameUpdate(MsgTypeRematchCancelled, types.JSONMap{
			"player_id": id,
		}, &id)
		gr.broadcastGameUpdate(MsgPlayerLeftRoom, types.JSONMap{
			"player_id": id,
		}, nil)

		// If the game mode is singleplayer, close the room and cancel any ongoing AI computation
		if gr.GameMode == "singleplayer" {
			gr.status = StatusClosed

			if gr.aiThinking {
				gr.cancelAIComputation()
			}
			return
		}

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

	if gr.status == StatusOngoing || gr.status == StatusClosed || gr.status == StatusEnded {
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
		return player.Color, nil
	}

	// Trigger AI move if in singleplayer mode
	if gr.GameMode == "singleplayer" {
		go gr.handleAIMove()
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

// Handles the AI move in singleplayer mode.
func (gr *GameRoom) handleAIMove() {
	// Move delay to make the move feel like the AI is thinking
	time.Sleep(time.Second * time.Duration(config.AIMoveDelay))

	gr.mu.Lock()
	defer gr.mu.Unlock()

	if gr.ai == nil {
		gr.logger.Error("AI not initialized for this game")
		return
	}

	if err := gr.validateActionStatus(); err != nil {
		return
	}

	aiPlayer := gr.player2

	if aiPlayer.Color != gr.Game.CurrentTurn() {
		return
	}

	// Create context
	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(config.AIThinkTimeout)*time.Second)
	gr.aiThinking = true
	gr.aiCancelFunc = cancel

	go func() {
		defer func() {
			cancel()
			gr.mu.Lock()
			gr.aiThinking = false
			gr.aiCancelFunc = nil
			gr.mu.Unlock()
		}()

		bestMove, err := gr.ai.GetBestMove(ctx, aiPlayer.Color)
		if err != nil {
			gr.logger.Error("AI failed to find a move", "error", err)
			return
		}

		// If bestMove is nil, it means the AI could not find a valid move so it will forfeit
		if bestMove == nil {
			gr.endGame("forfeit", gr.player1.Color)
			return
		}

		gr.mu.Lock()
		defer gr.mu.Unlock()

		if gr.status != StatusOngoing {
			return
		}
		err = gr.Game.ApplyMove(bestMove)
		if err != nil {
			gr.logger.Error("AI move application failed", "error", err)
			return
		}

		gr.broadcastGameUpdate(MsgTypeMove, types.JSONMap{
			"player_id": aiPlayer.ID,
			"color":     aiPlayer.Color,
			"move":      bestMove,
			"board":     gr.Game.GetBoardString(),
		}, nil)

		if gr.Game.IsGameEnded() {
			if gr.Game.GetWinner() == -1 {
				gr.endGame("draw", -1)
			} else {
				gr.endGame("normal", gr.Game.GetWinner())
			}
		}
	}()
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

			// Same message to history
			msg := SavedMessage{
				ClientID: clientID,
				Username: sender.Username,
				Message:  message,
			}
			if !sender.isSpectator {
				gr.playerMessages = append(gr.playerMessages, msg)
			} else {
				gr.spectatorMessages = append(gr.spectatorMessages, msg)
			}
		}
	}

	return nil
}

func (gr *GameRoom) RequestRematch(clientID string) error {
	gr.mu.Lock()
	defer gr.mu.Unlock()

	if gr.status != StatusEnded {
		return apperrors.ErrGameNotEnded
	}

	player := gr.getPlayer(clientID)
	if player == nil {
		return apperrors.ErrUnauthorizedAction
	}

	player.wantsRematch = true

	// If both players want a rematch, reset the game
	if gr.player1.wantsRematch && gr.player2.wantsRematch {
		newGame, err := games.NewGame(gr.GameType)
		if err != nil {
			return err
		}
		gr.Game = newGame

		if gr.ai != nil {
			gr.ai.SetGame(newGame)
		}

		gr.status = StatusOngoing
		gr.player1.wantsRematch = false
		gr.player2.wantsRematch = false
		gr.broadcastGameUpdate(MsgTypeGameStart, gr.gameState(), nil)
	} else {
		// Notify that a rematch has been requested
		gr.broadcastGameUpdate(MsgTypeRematchRequested, types.JSONMap{
			"player_id": clientID,
		}, &clientID)
	}

	return nil
}

func (gr *GameRoom) CancelRematchRequest(clientID string) error {
	gr.mu.Lock()
	defer gr.mu.Unlock()

	player := gr.getPlayer(clientID)
	if player == nil {
		return apperrors.ErrUnauthorizedAction
	}
	player.wantsRematch = false

	gr.broadcastGameUpdate(MsgTypeRematchCancelled, types.JSONMap{
		"player_id": clientID,
	}, &clientID)
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

func (gr *GameRoom) GetMessages(spectator bool) []SavedMessage {
	gr.mu.RLock()
	defer gr.mu.RUnlock()

	var messages []SavedMessage
	if spectator {
		messages = gr.spectatorMessages
	} else {
		messages = gr.playerMessages
	}

	// Return the last 100 elements of the array
	if len(messages) > 100 {
		return messages[len(messages)-100:]
	}

	return messages
}

func (gr *GameRoom) cancelAIComputation() {
	if gr.aiCancelFunc != nil {
		gr.aiCancelFunc()
	}
}
