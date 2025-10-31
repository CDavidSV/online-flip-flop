package game

import (
	"encoding/json"
	"errors"
)

type Action string
type Status string
type MessageType string

const (
	ActionJoinRoom    Action = "join"
	ActionMove        Action = "move"
	ActionChat        Action = "chat"
	ActionSendMessage Action = "send_message"
	ActionForfeit     Action = "forfeit"
	ActionLeave       Action = "leave"
	ActionError       Action = "error"

	StatusSuccess Status = "success"
	StatusError   Status = "error"

	MessageTypeRequest  MessageType = "request"
	MessageTypeResponse MessageType = "response"
)

var (
	ErrInvalidMessageFormat  = errors.New("invalid_message_format")
	ErrInvalidMessagePayload = errors.New("invalid_message_payload")
	ErrRoomNotFound          = errors.New("room_not_found")
	ErrInvalidPassword       = errors.New("invalid_password")
	ErrAlreadyInRoom         = errors.New("already_in_room")
	ErrClientNotFound        = errors.New("client_not_found")
	ErrInvalidAction         = errors.New("invalid_action")
)

type IncomingMessage struct {
	Type    MessageType     `json:"type"`
	Action  Action          `json:"action"`
	Status  Status          `json:"status,omitempty"`
	Payload json.RawMessage `json:"payload,omitempty"`
}

type OutgoingMessage struct {
	Action  Action `json:"action"`
	Status  Status `json:"status,omitempty"`
	Payload any    `json:"payload,omitempty"`
}

type ErrorPayload struct {
	Code string `json:"code"`
}

type MessageJoinRoom struct {
	RoomID   string `json:"room_id"`
	Username string `json:"username"`
	Password string `json:"password,omitempty"`
}

func NewErrorMessage(err error) []byte {
	errMsg := OutgoingMessage{
		Action: ActionError,
		Payload: ErrorPayload{
			Code: err.Error(),
		},
	}

	errMsgJSON, _ := json.Marshal(errMsg)
	return errMsgJSON
}

func NewMessage(action Action, status Status, payload any) []byte {
	msg := OutgoingMessage{
		Action:  action,
		Status:  status,
		Payload: payload,
	}

	msgJSON, _ := json.Marshal(msg)
	return msgJSON
}
