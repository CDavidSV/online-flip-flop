package ws

import (
	"encoding/json"

	"github.com/CDavidSV/online-flip-flop/games"
	"github.com/CDavidSV/online-flip-flop/internal/apperrors"
)

type MsgType string

const (
	MsgTypeCreateRoom  MsgType = "create"  // Create a new game room
	MsgTypeRoomCreated MsgType = "created" // Response after creating a room
	MsgTypeJoinRoom    MsgType = "join"    // Join an existing game room
	MsgTypeJoinedRoom  MsgType = "joined"  // Response after joining a room
	MsgTypeLeaveRoom   MsgType = "leave"   // Leave the current game room
	MsgTypeLeftRoom    MsgType = "left"    // Response after leaving a room
	MsgTypeMove        MsgType = "move"    // Make a move in the game
	MsgTypeGameStart   MsgType = "start"   // Notification that the game has started
	MsgTypeGameEnd     MsgType = "end"     // Notification that the game has ended
	MsgTypeForfeit     MsgType = "forfeit" // Forfeit the game
	MsgTypeSendMessage MsgType = "message" // Send a message
	MsgTypeChat        MsgType = "chat"    // New chat message
	MsgTypeError       MsgType = "error"   // Error message
)

// Incomming message from a websocket connection.
type IncomingMessage struct {
	Type    MsgType         `json:"type" validate:"required"` // The type or action of the message
	Payload json.RawMessage `json:"payload,omitempty"`        // Any additional data required for the type of message.
}

type OutgoingMessage struct {
	Type    MsgType `json:"type"`
	Payload any     `json:"payload,omitempty"`
}

type CreateRoom struct {
	GameType games.GameType `json:"game_type" validate:"required,oneof=0 1"`
	GameMode GameMode       `json:"game_mode" validate:"required,oneof=0 1"`
	Username string         `json:"username" validate:"required,min=2,max=20"`
}

type JoinRoom struct {
	RoomID   string `json:"room_id" validate:"required,min=4,max=4"`
	Username string `json:"username" validate:"required,min=2,max=20"`
}

type ChatMessage struct {
	Content string `json:"content" validate:"required,min=1,max=1000"`
}

// Constructs a new error message in JSON format to be sent through websocket.
func NewErrorMessage(appErr *apperrors.AppError) []byte {
	errMsg := OutgoingMessage{
		Type:    MsgTypeError,
		Payload: appErr,
	}

	errMsgJSON, _ := json.Marshal(errMsg)
	return errMsgJSON
}

// Constructs a new message in JSON format to be sent through websocket.
func NewMessage(action MsgType, payload any) []byte {
	msg := OutgoingMessage{
		Type:    action,
		Payload: payload,
	}

	msgJSON, _ := json.Marshal(msg)
	return msgJSON
}
