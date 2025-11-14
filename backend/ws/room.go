package ws

import (
	"encoding/json"
	"sync"

	"github.com/CDavidSV/online-flip-flop/games"
	"github.com/CDavidSV/online-flip-flop/internal/apperrors"
	"github.com/CDavidSV/online-flip-flop/internal/types"
	"github.com/google/uuid"
	"github.com/lxzan/gws"
)

const (
	maxPlayersPerRoom = 2

	gameStatusWaiting = "waiting_for_players"
	gameStatusOngoing = "ongoing"
	gameStatusEnded   = "ended"
)

type PlayerSlot struct {
	ID       string           `json:"id"`
	Username string           `json:"username"`
	Color    games.PlayerSide `json:"color"`
	IsAI     bool             `json:"is_ai"`
	conn     *gws.Conn        `json:"-"`
}

type GameState struct {
	Board       string           `json:"board"`
	CurrentTurn games.PlayerSide `json:"current_turn"`
	Status      string           `json:"status"`
	Winner      games.PlayerSide `json:"winner"`
	Players     []PlayerSlot     `json:"players"`
}

type GameRoom struct {
	ID       string
	Game     games.Game
	GameMode GameMode
	GameType games.GameType
	players  map[string]PlayerSlot
	mu       sync.RWMutex
}

func NewGameRoom(id string, game games.Game, gameMode GameMode, gameType games.GameType) *GameRoom {
	return &GameRoom{
		ID:       id,
		Game:     game,
		GameMode: gameMode,
		GameType: gameType,
		players:  make(map[string]PlayerSlot),
	}
}

func (gr *GameRoom) nextAvailableColor() games.PlayerSide {
	if len(gr.players) >= maxPlayersPerRoom {
		return -1
	}

	for _, playerSlot := range gr.players {
		if playerSlot.Color == games.COLOR_WHITE {
			return games.COLOR_BLACK
		}
	}
	return games.COLOR_WHITE
}

func (gr *GameRoom) broadcastGameUpdate(action MsgType, payload any, skipID *string) {
	msg := NewMessage(action, payload)

	for _, player := range gr.players {
		if player.IsAI || (skipID != nil && player.ID == *skipID) {
			continue
		}
		_ = player.conn.WriteMessage(gws.OpcodeText, msg)
	}
}

func (gr *GameRoom) getPlayer(id string) (PlayerSlot, bool) {
	player, exists := gr.players[id]
	return player, exists
}

func (gr *GameRoom) isRoomFull() bool {
	return len(gr.players) >= maxPlayersPerRoom
}

func (gr *GameRoom) disconnectAllPlayers() {
	for _, p := range gr.players {
		_ = p.conn.WriteClose(1000, nil)
	}
}

func (gr *GameRoom) determineGameStatus() string {
	if gr.Game.IsGameEnded() {
		return gameStatusEnded
	}
	if len(gr.players) < maxPlayersPerRoom {
		return gameStatusWaiting
	}
	return gameStatusOngoing
}

func (gr *GameRoom) gameState() GameState {
	players := make([]PlayerSlot, 0, len(gr.players))
	for _, slot := range gr.players {
		players = append(players, slot)
	}

	return GameState{
		Board:       gr.Game.GetBoardString(),
		CurrentTurn: gr.Game.CurrentTurn(),
		Players:     players,
		Status:      gr.determineGameStatus(),
	}
}

func (gr *GameRoom) AssignPlayer(conn *gws.Conn, username string) (PlayerSlot, error) {
	gr.mu.Lock()
	defer gr.mu.Unlock()

	// Check if game has ended
	if gr.Game.IsGameEnded() {
		return PlayerSlot{}, apperrors.ErrGameEnded
	}

	// Check if room is full
	if gr.isRoomFull() {
		return PlayerSlot{}, apperrors.ErrGameFull
	}

	// Determine color based on which slot is available
	color := gr.nextAvailableColor()

	// Create player slot
	playerSlot := PlayerSlot{
		ID:       uuid.New().String(),
		Username: username,
		Color:    color,
		conn:     conn,
	}
	gr.players[playerSlot.ID] = playerSlot

	// If the room is now full, start the game
	if gr.isRoomFull() {
		state := gr.gameState()
		gr.broadcastGameUpdate(MsgTypeGameStart, state, nil)
	}

	return playerSlot, nil
}

func (gr *GameRoom) RemovePlayer(id string) {
	gr.mu.Lock()
	defer gr.mu.Unlock()

	delete(gr.players, id)
}

// HandleMove processes a player's move, validates it, and broadcasts the result
func (gr *GameRoom) HandleMove(clientID string, movePayload json.RawMessage) error {
	gr.mu.Lock()
	defer gr.mu.Unlock()

	// Verify the player exists and get their color
	player, exists := gr.getPlayer(clientID)
	if !exists {
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

	move := types.JSONMap{
		"player_id": clientID,
		"color":     player.Color,
		"move":      movePayload,
		"board":     gr.Game.GetBoardString(),
	}

	gameEnded := gr.Game.IsGameEnded()
	var endPayload types.JSONMap
	if gameEnded {
		if gr.Game.GetWinner() == -1 {
			endPayload = types.JSONMap{"reason": "draw"}
		} else {
			endPayload = types.JSONMap{
				"reason": "normal",
				"winner": gr.Game.GetWinner(),
			}
		}
	}

	gr.broadcastGameUpdate(MsgTypeMove, move, &clientID)

	if gameEnded {
		gr.broadcastGameUpdate(MsgTypeGameEnd, endPayload, nil)
	}

	// Disconnect players if game ended
	if gameEnded {
		gr.disconnectAllPlayers()
	}

	return nil
}

func (gr *GameRoom) HandleForfeit(clientID string) error {
	gr.mu.Lock()
	defer gr.mu.Unlock()

	player, ok := gr.players[clientID]
	if !ok {
		return apperrors.ErrClientNotFound
	}

	gr.broadcastGameUpdate(MsgTypeGameEnd, types.JSONMap{
		"reason": "opponent_forfeit",
	}, &player.ID)

	gr.disconnectAllPlayers()
	return nil
}

func (gr *GameRoom) GetGameState() GameState {
	gr.mu.RLock()
	defer gr.mu.RUnlock()

	return gr.gameState()
}
