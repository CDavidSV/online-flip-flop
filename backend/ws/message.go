package ws

import (
	"encoding/json"

	"github.com/CDavidSV/online-flip-flop/games"
	"github.com/CDavidSV/online-flip-flop/internal/apperrors"
)

type MsgType string

const (
	MsgTypeCreateRoom  MsgType = "create"
	MsgTypeRoomCreated MsgType = "created"
	MsgTypeJoinRoom    MsgType = "join"
	MsgTypeJoinedRoom  MsgType = "joined"
	MsgTypeLeaveRoom   MsgType = "leave"
	MsgTypeLeftRoom    MsgType = "left"
	MsgTypeMove        MsgType = "move"
	MsgTypeGameStart   MsgType = "start"
	MsgTypeGameEnd     MsgType = "end"
	MsgTypeForfeit     MsgType = "forfeit"
	MsgTypeSendMessage MsgType = "message"
	MsgTypeChat        MsgType = "chat"
	MsgTypeError       MsgType = "error"
)

type IncomingMessage struct {
	Type    MsgType         `json:"action"`
	Payload json.RawMessage `json:"payload,omitempty"`
}

type OutgoingMessage struct {
	Type    MsgType `json:"action"`
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

func NewErrorMessage(appErr *apperrors.AppError) []byte {
	errMsg := OutgoingMessage{
		Type:    MsgTypeError,
		Payload: appErr,
	}

	errMsgJSON, _ := json.Marshal(errMsg)
	return errMsgJSON
}

func NewMessage(action MsgType, payload any) []byte {
	msg := OutgoingMessage{
		Type:    action,
		Payload: payload,
	}

	msgJSON, _ := json.Marshal(msg)
	return msgJSON
}
