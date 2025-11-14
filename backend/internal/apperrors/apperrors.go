package apperrors

import (
	"encoding/json"
	"errors"
)

type AppError struct {
	Code    string `json:"code"`
	Details any    `json:"details,omitempty"`
}

func (e *AppError) ToJSON() []byte {
	data, _ := json.Marshal(e)
	return data
}

var (
	ErrValidationFailed      = errors.New("validation_failed")
	ErrInvalidRequestPayload = errors.New("invalid_request_payload")

	ErrInvalidMessageFormat     = errors.New("invalid_message_format")
	ErrInvalidMessagePayload    = errors.New("invalid_message_payload")
	ErrRoomNotFound             = errors.New("room_not_found")
	ErrAlreadyInRoom            = errors.New("already_in_room")
	ErrClientNotFound           = errors.New("client_not_found")
	ErrInvalidAction            = errors.New("invalid_action")
	ErrGameEndedDueToInactivity = errors.New("game_ended_due_to_inactivity")
	ErrNotInGame                = errors.New("must_join_game_first")
	ErrGameFull                 = errors.New("game_full")
	ErrGameNotStarted           = errors.New("game_not_started")
	ErrNotYourTurn              = errors.New("not_your_turn")
	ErrIllegalMove              = errors.New("illegal_move")
	ErrGameEnded                = errors.New("game_ended")
	ErrPlayerNotActive          = errors.New("player_not_active")
)

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
