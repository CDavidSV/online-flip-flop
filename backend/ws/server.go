package ws

import (
	"encoding/json"
	"log/slog"
	"math/rand"
	"net/http"
	"strings"
	"time"

	"github.com/CDavidSV/online-flip-flop/games"
	"github.com/CDavidSV/online-flip-flop/internal/apperrors"
	"github.com/CDavidSV/online-flip-flop/internal/types"
	"github.com/CDavidSV/online-flip-flop/internal/validator"
	"github.com/google/uuid"
	"github.com/lxzan/gws"
)

type GameMode int

const (
	GameModeSingleplayer GameMode = iota
	GameModeMultiplayer
)

const (
	PingInterval = 60 * time.Second // Interval for sending ping messages
	PingWait     = 10 * time.Second // Wait time for a client to send ping message
)

type Server struct {
	gws.BuiltinEventHandler
	rooms     *gws.ConcurrentMap[string, *GameRoom]
	logger    *slog.Logger
	validator *validator.CustomValidator
}

// Loads a value from the session storage of a connection.
// Requires a type parameter and the key value.
func mustLoad[T any](s gws.SessionStorage, key string) (v T) {
	if value, ok := s.Load(key); ok {
		return value.(T)
	}
	return
}

// Builds and sends an error message to a websocket connection.
func (s *Server) writeError(socket *gws.Conn, err error, details ...any) {
	socket.WriteAsync(gws.OpcodeText, NewErrorMessage(apperrors.New(err, details...)), func(err error) {
		if err != nil {
			s.logger.Error("Failed to send error message", "error", err)
		}
	})
}

// Loads the clientID and GameRoom from the connection's session storage.
// Returns a boolean value indicating if the client is currently in a room.
func (s *Server) getClientContext(socket *gws.Conn) (clientID string, room *GameRoom, hasRoom bool) {
	clientID = mustLoad[string](socket.Session(), "client_id")
	room = mustLoad[*GameRoom](socket.Session(), "room")
	hasRoom = room != nil
	return
}

// Generate a 4 character room ID.
func (s *Server) generateRoomID() (string, error) {
	charset := "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	idLength := 4
	maxAttempts := 1000

	// Iterate until we find a unique ID
	id := ""
	for attempt := 0; attempt < maxAttempts; attempt++ {
		var builder strings.Builder
		for range idLength {
			builder.WriteByte(charset[rand.Intn(len(charset))])
		}
		id = builder.String()
		if _, exists := s.rooms.Load(id); !exists {
			return id, nil
		}
	}

	return id, apperrors.ErrIDGenerationFailed
}

// Returns a new websocket server instance.
func NewGameServer(logger *slog.Logger) *Server {
	return &Server{
		rooms:     gws.NewConcurrentMap[string, *GameRoom](),
		logger:    logger,
		validator: validator.New(),
	}
}

// Websocket handler.
func WSHandler(server *Server) http.HandlerFunc {
	upgrader := gws.NewUpgrader(server, &gws.ServerOption{
		ParallelEnabled:   true,
		Recovery:          gws.Recovery,
		PermessageDeflate: gws.PermessageDeflate{Enabled: true},
	})

	return func(res http.ResponseWriter, req *http.Request) {
		socket, err := upgrader.Upgrade(res, req)
		if err != nil {
			return
		}

		go func() {
			socket.ReadLoop()
		}()
	}
}

// Retrieves a game room by its ID.
func (s *Server) GetGameRoom(roomID string) *GameRoom {
	room, exists := s.rooms.Load(roomID)
	if !exists {
		return nil
	}

	return room
}

// Deletes a game room from the server and clears the room reference from all connected clients.
func (s *Server) DeleteGameRoom(room *GameRoom) {
	s.rooms.Delete(room.ID)
	for _, conn := range room.GetPlayerConnections() {
		conn.Session().Delete("room")
	}
}

// ------------------ WebSocket event handlers ------------------
func (s *Server) OnOpen(socket *gws.Conn) {
	clientID := uuid.New().String()
	socket.Session().Store("client_id", clientID)

	// Set ping deadline
	if err := socket.SetDeadline(time.Now().Add(PingInterval + PingWait)); err != nil {
		s.logger.Error("failed to set deadline", "error", err, "client_id", clientID)
	}
}

func (s *Server) OnClose(socket *gws.Conn, err error) {
	clientID := mustLoad[string](socket.Session(), "client_id")
	room := mustLoad[*GameRoom](socket.Session(), "room")

	if room != nil {
		room.LeaveRoom(clientID)
		if room.IsClosed() {
			s.DeleteGameRoom(room)
		}
	}
}

func (s *Server) OnPing(socket *gws.Conn, payload []byte) {
	if err := socket.SetDeadline(time.Now().Add(PingInterval + PingWait)); err != nil {
		s.logger.Error("failed to set deadline on ping", "error", err)
	}
	if err := socket.WriteString("pong"); err != nil {
		s.logger.Error("failed to write pong", "error", err)
	}
}

func (s *Server) OnMessage(socket *gws.Conn, message *gws.Message) {
	// Handle ping messages
	if b := message.Bytes(); len(b) == 4 && string(b) == "ping" {
		s.OnPing(socket, nil)
		return
	}

	var msg IncomingMessage
	if err := json.Unmarshal(message.Bytes(), &msg); err != nil {
		s.writeError(socket, apperrors.ErrInvalidMessageFormat)
		return
	}

	// Validate incoming message
	if ok, errors := s.validator.Validate(&msg); !ok {
		s.writeError(socket, apperrors.ErrValidationFailed, errors)
		return
	}

	switch msg.Type {
	case MsgTypeCreateRoom:
		var payload CreateRoom
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			s.writeError(socket, apperrors.ErrInvalidMessageFormat)
			return
		}

		// Validate payload
		if ok, errors := s.validator.Validate(&payload); !ok {
			s.writeError(socket, apperrors.ErrValidationFailed, errors)
			return
		}

		clientID, _, hasRoom := s.getClientContext(socket)
		if hasRoom {
			s.writeError(socket, apperrors.ErrAlreadyInGame)
			return
		}

		roomID, err := s.generateRoomID()
		if err != nil {
			s.writeError(socket, err)
			return
		}

		game, _ := games.NewGame(payload.GameType)
		room := NewGameRoom(roomID, game, payload.GameMode, payload.GameType, s.logger)

		isSpectator, _ := room.EnterRoom(clientID, socket, payload.Username)
		socket.Session().Store("room", room)

		s.rooms.Store(roomID, room)

		socket.WriteMessage(gws.OpcodeText, NewMessage(MsgTypeRoomCreated, types.JSONMap{
			"room_id":      roomID,
			"is_spectator": isSpectator,
		}))
	case MsgTypeJoinRoom:
		clientID, _, hasRoom := s.getClientContext(socket)
		if hasRoom {
			s.writeError(socket, apperrors.ErrAlreadyInGame)
			return
		}

		var payload JoinRoom
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			s.writeError(socket, apperrors.ErrInvalidMessageFormat)
			return
		}

		// Validate payload
		if ok, errors := s.validator.Validate(&payload); !ok {
			s.writeError(socket, apperrors.ErrValidationFailed, errors)
			return
		}

		room := s.GetGameRoom(payload.RoomID)
		if room == nil {
			s.writeError(socket, apperrors.ErrRoomNotFound)
			return
		}

		isSpectator, err := room.EnterRoom(clientID, socket, payload.Username)
		if err != nil {
			s.writeError(socket, err)
			return
		}
		socket.Session().Store("room", room)

		socket.WriteAsync(gws.OpcodeText, NewMessage(MsgTypeJoinRoom, types.JSONMap{
			"is_spectator": isSpectator,
		}), func(err error) {
			if err != nil {
				s.logger.Error("Failed to send join room confirmation", "error", err)
			}
		})

		if !isSpectator {
			room.StartGame()
		}
	case MsgTypeLeaveRoom:
		clientID, room, hasRoom := s.getClientContext(socket)
		if !hasRoom {
			s.writeError(socket, apperrors.ErrNotInGame)
			return
		}

		socket.Session().Delete("room")
		room.LeaveRoom(clientID)
		if room.IsClosed() {
			s.DeleteGameRoom(room)
		}

		err := socket.WriteMessage(gws.OpcodeText, NewMessage(MsgTypeLeftRoom, nil))
		if err != nil {
			s.logger.Error("Failed to send left room confirmation", "error", err)
		}
	case MsgTypeMove:
		clientID, room, hasRoom := s.getClientContext(socket)
		if !hasRoom {
			s.writeError(socket, apperrors.ErrNotInGame)
			return
		}

		if err := room.HandleMove(clientID, msg.Payload); err != nil {
			s.writeError(socket, err)
		}

		if room.IsClosed() {
			s.DeleteGameRoom(room)
		}
	case MsgTypeForfeit:
		clientID, room, hasRoom := s.getClientContext(socket)
		if !hasRoom {
			s.writeError(socket, apperrors.ErrNotInGame)
			return
		}

		if err := room.HandleForfeit(clientID); err != nil {
			s.writeError(socket, err)
		}
		s.DeleteGameRoom(room)
	case MsgTypeSendMessage:
		var payload ChatMessage
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			s.writeError(socket, apperrors.ErrInvalidMessageFormat)
			return
		}

		// Validate payload
		if ok, errors := s.validator.Validate(&payload); !ok {
			s.writeError(socket, apperrors.ErrValidationFailed, errors)
			return
		}

		clientID, room, hasRoom := s.getClientContext(socket)
		if !hasRoom {
			s.writeError(socket, apperrors.ErrNotInGame)
			return
		}

		if err := room.HandleChatMessage(clientID, payload.Content); err != nil {
			s.writeError(socket, err)
		}
	default:
		s.writeError(socket, apperrors.ErrInvalidMsgType)
	}
}
