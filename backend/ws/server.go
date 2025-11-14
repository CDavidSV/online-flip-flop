package ws

import (
	"encoding/json"
	"math/rand"
	"time"

	"github.com/CDavidSV/online-flip-flop/games"
	"github.com/CDavidSV/online-flip-flop/internal/apperrors"
	"github.com/CDavidSV/online-flip-flop/internal/types"
	"github.com/CDavidSV/online-flip-flop/internal/validator"
	"github.com/labstack/echo/v4"
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
	logger    echo.Logger
	validator *validator.CustomValidator
}

func mustLoad[T any](s gws.SessionStorage, key string) (v T) {
	if value, ok := s.Load(key); ok {
		return value.(T)
	}
	return
}

func (s *Server) generateRoomID() string {
	charset := "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	idLength := 4

	// Iterate until we find a unique ID
	for {
		var id string
		for range idLength {
			id += string(charset[rand.Intn(len(charset))])
		}
		if _, exists := s.rooms.Load(id); !exists {
			return id
		}
	}
}

func NewGameServer(logger echo.Logger) *Server {
	return &Server{
		rooms:     gws.NewConcurrentMap[string, *GameRoom](),
		logger:    logger,
		validator: validator.New(),
	}
}

func WSHandler(server *Server) echo.HandlerFunc {
	upgrader := gws.NewUpgrader(server, &gws.ServerOption{
		ParallelEnabled:   true,
		Recovery:          gws.Recovery,
		PermessageDeflate: gws.PermessageDeflate{Enabled: true},
	})

	return func(c echo.Context) error {
		roomID := c.QueryParam("room_id")
		if roomID == "" {
			return echo.NewHTTPError(400, "Bad Request")
		}

		username := c.QueryParam("username")
		if username == "" {
			username = "Guest"
		}

		gameRoom := server.GetGameRoom(roomID)
		if gameRoom == nil {
			return echo.NewHTTPError(404, "Not Found")
		}

		socket, err := upgrader.Upgrade(c.Response().Writer, c.Request())
		if err != nil {
			return err
		}

		// Set ping deadline
		_ = socket.SetDeadline(time.Now().Add(PingInterval + PingWait))

		// Assign player to game room
		playerSlot, err := gameRoom.AssignPlayer(socket, username)
		if err != nil {
			_ = socket.WriteClose(1000, apperrors.New(err).ToJSON())
			return nil
		}

		// Store room id
		socket.Session().Store("room_id", gameRoom.ID)
		socket.Session().Store("client_id", playerSlot.ID)

		// Send confirmation back to client
		message := types.JSONMap{
			"client_id":  playerSlot.ID,
			"game_state": gameRoom.GetGameState(),
			"color":      playerSlot.Color,
		}
		confirmMsg := NewMessage(MsgTypeJoinRoom, message)
		_ = socket.WriteMessage(gws.OpcodeText, confirmMsg)

		// Start connection read loop
		go func() {
			socket.ReadLoop()
		}()

		return nil
	}
}

func (s *Server) CreateGameRoom(gameType games.GameType, gameMode GameMode) *GameRoom {
	roomID := s.generateRoomID()
	game, _ := games.NewGame(gameType)

	room := NewGameRoom(roomID, game, gameMode, gameType)

	s.rooms.Store(roomID, room)
	return room
}

func (s *Server) GetGameRoom(roomID string) *GameRoom {
	room, exists := s.rooms.Load(roomID)
	if !exists {
		return nil
	}

	return room
}

// ------------------ WebSocket event handlers ------------------
func (s *Server) OnClose(socket *gws.Conn, err error) {
	roomID := mustLoad[string](socket.Session(), "room_id")
	clientID := mustLoad[string](socket.Session(), "client_id")

	gameRoom := s.GetGameRoom(roomID)
	if gameRoom != nil {
		gameRoom.RemovePlayer(clientID)
	}
}

func (s *Server) OnPing(socket *gws.Conn, payload []byte) {
	_ = socket.SetDeadline(time.Now().Add(PingInterval + PingWait))
	_ = socket.WriteString("pong")
}

func (s *Server) OnMessage(socket *gws.Conn, message *gws.Message) {
	clientID := mustLoad[string](socket.Session(), "client_id")
	roomID := mustLoad[string](socket.Session(), "room_id")

	if b := message.Bytes(); len(b) == 4 && string(b) == "ping" {
		s.OnPing(socket, nil)
		return
	}

	var msg IncomingMessage
	err := json.Unmarshal(message.Bytes(), &msg)
	if err != nil {
		_ = socket.WriteMessage(gws.OpcodeText, NewErrorMessage(apperrors.New(apperrors.ErrInvalidMessageFormat)))
		return
	}

	gameRoom := s.GetGameRoom(roomID)
	if gameRoom == nil {
		_ = socket.WriteMessage(gws.OpcodeText, NewErrorMessage(apperrors.New(apperrors.ErrRoomNotFound)))
		return
	}

	switch msg.Type {
	case MsgTypeMove:
		if err := gameRoom.HandleMove(clientID, msg.Payload); err != nil {
			_ = socket.WriteMessage(gws.OpcodeText, NewErrorMessage(apperrors.New(err)))
			return
		}
	case MsgTypeForfeit:
		if err := gameRoom.HandleForfeit(clientID); err != nil {
			_ = socket.WriteMessage(gws.OpcodeText, NewErrorMessage(apperrors.New(err)))
			return
		}
	case MsgTypeSendMessage:
		// TODO: Handle send message action
	default:
		_ = socket.WriteMessage(gws.OpcodeText, NewErrorMessage(apperrors.New(apperrors.ErrInvalidAction)))
	}
}
