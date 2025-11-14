package ws

import (
	"encoding/json"

	"github.com/CDavidSV/online-flip-flop/internal/apperrors"
)

type MsgType string

const (
	MsgTypeJoinRoom    MsgType = "join"
	MsgTypeMove        MsgType = "move"
	MsgTypeGameStart   MsgType = "game_start"
	MsgTypeGameEnd     MsgType = "game_end"
	MsgTypeChat        MsgType = "chat"
	MsgTypeSendMessage MsgType = "send_message"
	MsgTypeForfeit     MsgType = "forfeit"
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
