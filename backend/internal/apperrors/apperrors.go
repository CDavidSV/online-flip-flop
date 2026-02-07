package apperrors

import (
	"encoding/json"
	"errors"
)

// Represents an app error that can be serialized to JSON and sent to clients.
type AppError struct {
	Code    string `json:"code"`
	Details any    `json:"details,omitempty"`
}

func (e *AppError) ToJSON() []byte {
	data, _ := json.Marshal(e)
	return data
}

var (
	ErrValidationFailed     = errors.New("validation_failed")
	ErrAlreadyInGame        = errors.New("already_in_game")
	ErrUsernameRequired     = errors.New("username_required")
	ErrInvalidMessageFormat = errors.New("invalid_message_format")
	ErrRoomNotFound         = errors.New("room_not_found")
	ErrRoomClosed           = errors.New("room_closed")
	ErrClientNotFound       = errors.New("client_not_found")
	ErrInvalidMsgType       = errors.New("invalid_msg_type")
	ErrNotInGame            = errors.New("must_join_game_first")
	ErrGameNotStarted       = errors.New("game_not_started")
	ErrNotYourTurn          = errors.New("not_your_turn")
	ErrIllegalMove          = errors.New("illegal_move")
	ErrGameEnded            = errors.New("game_ended")
	ErrGameNotEnded         = errors.New("game_not_ended")
	ErrPlayerNotActive      = errors.New("player_not_active")
	ErrIDGenerationFailed   = errors.New("id_generation_failed")
	ErrUnauthorizedAction   = errors.New("unauthorized_action")
	ErrInvalidGameMode      = errors.New("invalid_game_mode")
	ErrInvalidAIDifficulty  = errors.New("invalid_ai_difficulty")
	ErrRoomFull             = errors.New("room_full")
)

// Returns an AppError instance with the given error code and optional details.
func New(err error, details ...any) *AppError {
	var det any
	if len(details) > 0 {
		det = details[0]
	}
	return &AppError{
		Code:    err.Error(),
		Details: det,
	}
}
