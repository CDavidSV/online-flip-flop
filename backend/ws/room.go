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

type PlayerSlot struct {
	ID       string           `json:"id"`
	Username string           `json:"username"`
	Color    games.PlayerSide `json:"color"`
	IsAI     bool             `json:"is_ai"`
	IsActive bool             `json:"is_active"`
	conn     *gws.Conn        `json:"-"`
}

type ConnectionInfo struct {
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
	conns    map[string]ConnectionInfo
	status   Status
	logger   *slog.Logger
	mu       sync.RWMutex
}

const (
	MaxPlayersPerRoom int = 2

	StatusWaiting Status = "waiting_for_players"
	StatusOngoing Status = "ongoing"
	StatusClosed  Status = "closed"
)

func NewGameRoom(id string, game games.Game, gameMode GameMode, gameType games.GameType, logger *slog.Logger) *GameRoom {
	return &GameRoom{
		ID:       id,
		Game:     game,
		GameMode: gameMode,
		GameType: gameType,
		conns:    make(map[string]ConnectionInfo),
		status:   StatusWaiting,
		logger:   logger,
	}
}

func (gr *GameRoom) broadcastGameUpdate(action MsgType, payload any, skipID *string) {
	msg := NewMessage(action, payload)

	b := gws.NewBroadcaster(gws.OpcodeText, msg)
	defer b.Close()

	for id, connData := range gr.conns {
		if connData.isSpectator || (skipID != nil && id == *skipID) {
			continue
		}

		err := b.Broadcast(connData.conn)
		if err != nil {
			gr.logger.Error("Failed to broadcast message", "error", err)
		}
	}
}

func (gr *GameRoom) endGame(reason string, winner games.PlayerSide) {
	gr.status = StatusClosed
	payload := types.JSONMap{"reason": reason}
	if winner != -1 {
		payload["winner"] = winner
	}
	gr.broadcastGameUpdate(MsgTypeGameEnd, payload, nil)
}

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
	}
}

func (gr *GameRoom) getPlayer(id string) *PlayerSlot {
	if gr.player1 != nil && gr.player1.ID == id {
		return gr.player1
	}
	if gr.player2 != nil && gr.player2.ID == id {
		return gr.player2
	}
	return nil
}

func (gr *GameRoom) playersInactive() bool {
	return (gr.player1 == nil || !gr.player1.IsActive) && (gr.player2 == nil || !gr.player2.IsActive)
}

func (gr *GameRoom) playersActive() bool {
	return !gr.playersInactive()
}

func (gr *GameRoom) EnterRoom(id string, conn *gws.Conn, username string) (isSpectator bool, err error) {
	gr.mu.Lock()
	defer gr.mu.Unlock()

	if gr.Game.IsGameEnded() {
		return false, apperrors.ErrGameEnded
	}

	if gr.status == StatusClosed {
		return false, apperrors.ErrRoomClosed
	}

	connInfo := ConnectionInfo{
		conn:        conn,
		isSpectator: false,
	}

	player := gr.getPlayer(id)
	if player != nil {
		// Reconnecting player
		player.conn = conn
		player.IsActive = true
		gr.conns[id] = connInfo
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
			conn:     conn,
		}
		gr.conns[id] = connInfo
		return false, nil
	}

	// Join as spectator
	connInfo.isSpectator = true
	gr.conns[id] = connInfo

	return true, nil
}

func (gr *GameRoom) LeaveRoom(id string) {
	gr.mu.Lock()
	defer gr.mu.Unlock()

	player := gr.getPlayer(id)
	if player != nil {
		player.IsActive = false
		player.conn = nil
	}

	delete(gr.conns, id)

	// If no players remain, close the room
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

func (gr *GameRoom) StartGame() {
	gr.mu.Lock()
	defer gr.mu.Unlock()

	if gr.status == StatusOngoing || gr.status == StatusClosed {
		return
	}

	if gr.playersActive() {
		gr.status = StatusOngoing
		gr.broadcastGameUpdate(MsgTypeGameStart, gr.gameState(), nil)
	}
}

func (gr *GameRoom) HandleMove(clientID string, movePayload json.RawMessage) error {
	gr.mu.Lock()
	defer gr.mu.Unlock()

	// Verify the player exists and get their color
	player := gr.getPlayer(clientID)
	if player == nil {
		return apperrors.ErrClientNotFound
	}

	// Check if it's the player's turn
	if player.Color != gr.Game.CurrentTurn() {
		return apperrors.ErrNotYourTurn
	}

	err := gr.Game.ApplyMove(movePayload)
	if err != nil {
		return err
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

	return nil
}

func (gr *GameRoom) HandleForfeit(clientID string) error {
	gr.mu.Lock()
	defer gr.mu.Unlock()

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

func (gr *GameRoom) GetGameState() GameState {
	gr.mu.RLock()
	defer gr.mu.RUnlock()

	return gr.gameState()
}

func (gr *GameRoom) GetPlayerConnections() []*gws.Conn {
	gr.mu.RLock()
	defer gr.mu.RUnlock()

	conns := make([]*gws.Conn, 0, len(gr.conns))
	for _, connData := range gr.conns {
		conns = append(conns, connData.conn)
	}
	return conns
}

func (gr *GameRoom) IsClosed() bool {
	gr.mu.RLock()
	defer gr.mu.RUnlock()

	return gr.status == StatusClosed
}
