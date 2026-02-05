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

type GameMode string

const (
	GameModeSingleplayer GameMode = "singleplayer"
	GameModeMultiplayer  GameMode = "multiplayer"
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
func (s *Server) writeError(socket *gws.Conn, err error, requestID string, details ...any) {
	socket.WriteAsync(gws.OpcodeText, NewErrorMessage(apperrors.New(err, details...), requestID), func(err error) {
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
	for range maxAttempts {
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

		// Store client_id from query params in the session
		clientID := req.URL.Query().Get("client_id")
		if clientID != "" {
			// Validate that it's a valid UUID
			if _, err := uuid.Parse(clientID); err == nil {
				socket.Session().Store("client_id", clientID)
			}
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
	s.logger.Debug("Deleted game room", "room_id", room.ID)
}

func (s *Server) handleCreateRoom(socket *gws.Conn, msg IncomingMessage) {
	var payload CreateRoom
	if err := json.Unmarshal(msg.Payload, &payload); err != nil {
		s.writeError(socket, apperrors.ErrInvalidMessageFormat, msg.RequestID)
		return
	}

	// Validate payload
	if ok, errors := s.validator.Validate(&payload); !ok {
		s.writeError(socket, apperrors.ErrValidationFailed, msg.RequestID, errors)
		return
	}

	clientID, _, hasRoom := s.getClientContext(socket)
	if hasRoom {
		s.writeError(socket, apperrors.ErrAlreadyInGame, msg.RequestID)
		return
	}

	roomID, err := s.generateRoomID()
	if err != nil {
		s.writeError(socket, err, msg.RequestID)
		return
	}

	game, _ := games.NewGame(payload.GameType)
	room := NewGameRoom(roomID, game, payload.GameMode, payload.GameType, s.logger)

	isSpectator, _ := room.EnterRoom(clientID, socket, payload.Username)
	socket.Session().Store("room", room)

	s.rooms.Store(roomID, room)
	s.logger.Debug("Created new game room", "room_id", roomID, "game_mode", payload.GameMode, "game_type", payload.GameType)
	socket.WriteMessage(gws.OpcodeText, NewMessage(MsgTypeRoomCreated, types.JSONMap{
		"room_id":      roomID,
		"is_spectator": isSpectator,
	}, msg.RequestID))
}

func (s *Server) handleJoinRoom(socket *gws.Conn, msg IncomingMessage) {
	clientID, _, hasRoom := s.getClientContext(socket)
	if hasRoom {
		s.writeError(socket, apperrors.ErrAlreadyInGame, msg.RequestID)
		return
	}

	var payload JoinRoom
	if err := json.Unmarshal(msg.Payload, &payload); err != nil {
		s.writeError(socket, apperrors.ErrInvalidMessageFormat, msg.RequestID)
		return
	}

	// Validate payload
	if ok, errors := s.validator.Validate(&payload); !ok {
		s.writeError(socket, apperrors.ErrValidationFailed, msg.RequestID, errors)
		return
	}

	room := s.GetGameRoom(payload.RoomID)
	if room == nil {
		s.writeError(socket, apperrors.ErrRoomNotFound, msg.RequestID)
		return
	}

	isSpectator, err := room.EnterRoom(clientID, socket, payload.Username)
	if err != nil {
		s.writeError(socket, err, msg.RequestID)
		return
	}
	socket.Session().Store("room", room)

	s.logger.Debug("Client joined game room", "room_id", room.ID, "client_id", clientID, "is_spectator", isSpectator)

	socket.WriteAsync(gws.OpcodeText, NewMessage(MsgTypeJoinedRoom, types.JSONMap{
		"is_spectator": isSpectator,
		"game_mode":    room.GameMode,
		"game_type":    room.GameType,
		"game_state":   room.GetGameState(),
		"move_history": room.Game.GetMoveHistory(),
		"messages":     room.GetMessages(isSpectator),
	}, msg.RequestID), func(err error) {
		if err != nil {
			s.logger.Error("Failed to send join room confirmation", "error", err)
		}
	})

	if !isSpectator {
		room.StartGame()
	}
}

func (s *Server) handleLeaveRoom(socket *gws.Conn, msg IncomingMessage) {
	clientID, room, hasRoom := s.getClientContext(socket)
	if !hasRoom {
		s.writeError(socket, apperrors.ErrNotInGame, msg.RequestID)
		return
	}

	socket.Session().Delete("room")
	room.LeaveRoom(clientID)
	if room.IsClosed() {
		s.DeleteGameRoom(room)
	}

	s.logger.Debug("Client left game room", "room_id", room.ID, "client_id", clientID)

	err := socket.WriteMessage(gws.OpcodeText, NewMessage(MsgTypeLeftRoom, nil, msg.RequestID))
	if err != nil {
		s.logger.Error("Failed to send left room confirmation", "error", err)
	}
}

func (s *Server) handleMove(socket *gws.Conn, msg IncomingMessage) {
	clientID, room, hasRoom := s.getClientContext(socket)
	if !hasRoom {
		s.writeError(socket, apperrors.ErrNotInGame, msg.RequestID)
		return
	}

	if _, err := room.HandleMove(clientID, msg.RequestID, msg.Payload); err != nil {
		s.writeError(socket, err, msg.RequestID)
	}

	if room.IsClosed() {
		s.DeleteGameRoom(room)
	}
}

func (s *Server) handleForfeit(socket *gws.Conn, msg IncomingMessage) {
	clientID, room, hasRoom := s.getClientContext(socket)
	if !hasRoom {
		s.writeError(socket, apperrors.ErrNotInGame, msg.RequestID)
		return
	}

	if err := room.HandleForfeit(clientID); err != nil {
		s.writeError(socket, err, msg.RequestID)
		return
	}

	socket.WriteAsync(gws.OpcodeText, NewMessage(MsgTypeAck, nil, msg.RequestID), func(err error) {
		if err != nil {
			s.logger.Error("Failed to send forfeit acknowledgment", "error", err)
		}
	})

	if room.IsClosed() {
		s.DeleteGameRoom(room)
	}
}

func (s *Server) handleGameState(socket *gws.Conn, msg IncomingMessage) {
	_, room, hasRoom := s.getClientContext(socket)
	if !hasRoom {
		s.writeError(socket, apperrors.ErrNotInGame, msg.RequestID)
		return
	}

	state := room.GetGameState()
	socket.WriteMessage(gws.OpcodeText, NewMessage(MsgTypeGameState, state, msg.RequestID))
}

func (s *Server) handleSendMessage(socket *gws.Conn, msg IncomingMessage) {
	var payload ChatMessage
	if err := json.Unmarshal(msg.Payload, &payload); err != nil {
		s.writeError(socket, apperrors.ErrInvalidMessageFormat, msg.RequestID)
		return
	}

	// Validate payload
	if ok, errors := s.validator.Validate(&payload); !ok {
		s.writeError(socket, apperrors.ErrValidationFailed, msg.RequestID, errors)
		return
	}

	clientID, room, hasRoom := s.getClientContext(socket)
	if !hasRoom {
		s.writeError(socket, apperrors.ErrNotInGame, msg.RequestID)
		return
	}

	if err := room.HandleChatMessage(clientID, msg.RequestID, payload.Content); err != nil {
		s.writeError(socket, err, msg.RequestID)
	}
}

func (s *Server) handleRequestRematch(socket *gws.Conn, msg IncomingMessage) {
	clientID, room, hasRoom := s.getClientContext(socket)
	if !hasRoom {
		s.writeError(socket, apperrors.ErrNotInGame, msg.RequestID)
		return
	}

	if err := room.RequestRematch(clientID); err != nil {
		s.writeError(socket, err, msg.RequestID)
		return
	}

	if err := socket.WriteMessage(gws.OpcodeText, NewMessage(MsgTypeAck, nil, msg.RequestID)); err != nil {
		s.logger.Error("Failed to send acknowledgment", "error", err)
	}
}

func (s *Server) handleCancelRematch(socket *gws.Conn, msg IncomingMessage) {
	clientID, room, hasRoom := s.getClientContext(socket)
	if !hasRoom {
		s.writeError(socket, apperrors.ErrNotInGame, msg.RequestID)
		return
	}

	if err := room.CancelRematchRequest(clientID); err != nil {
		s.writeError(socket, err, msg.RequestID)
		return
	}

	if err := socket.WriteMessage(gws.OpcodeText, NewMessage(MsgTypeAck, nil, msg.RequestID)); err != nil {
		s.logger.Error("Failed to send acknowledgment", "error", err)
	}
}

// ------------------ WebSocket event handlers ------------------
func (s *Server) OnOpen(socket *gws.Conn) {
	// Get client id from session if provided during upgrade
	clientID := mustLoad[string](socket.Session(), "client_id")
	if clientID == "" {
		clientID = uuid.New().String()
		socket.Session().Store("client_id", clientID)
	}

	// Set ping deadline
	if err := socket.SetDeadline(time.Now().Add(PingInterval + PingWait)); err != nil {
		s.logger.Error("failed to set deadline", "error", err, "client_id", clientID)
	}
	socket.WriteMessage(gws.OpcodeText, NewMessage(MsgTypeConnected, types.JSONMap{
		"client_id": clientID,
	}, ""))
	s.logger.Info("New client connected", "client_id", clientID)
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

	if err != nil {
		s.logger.Info("Client disconnected due to unexpected error", "client_id", clientID, "error", err)
	} else {
		s.logger.Info("Client disconnected", "client_id", clientID)
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
		s.writeError(socket, apperrors.ErrInvalidMessageFormat, "")
		return
	}

	// Validate incoming message
	if ok, errors := s.validator.Validate(&msg); !ok {
		s.writeError(socket, apperrors.ErrValidationFailed, "", errors)
		return
	}

	switch msg.Type {
	case MsgTypeCreateRoom:
		s.handleCreateRoom(socket, msg)
	case MsgTypeJoinRoom:
		s.handleJoinRoom(socket, msg)
	case MsgTypeLeaveRoom:
		s.handleLeaveRoom(socket, msg)
	case MsgTypeMove:
		s.handleMove(socket, msg)
	case MsgTypeForfeit:
		s.handleForfeit(socket, msg)
	case MsgTypeGameState:
		s.handleGameState(socket, msg)
	case MsgTypeSendMessage:
		s.handleSendMessage(socket, msg)
	case MsgTypeRematch:
		s.handleRequestRematch(socket, msg)
	case MsgTypeCancelRematch:
		s.handleCancelRematch(socket, msg)
	default:
		s.writeError(socket, apperrors.ErrInvalidMsgType, msg.RequestID)
	}
}
