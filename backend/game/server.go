package game

import (
	"encoding/json"
	"errors"
	"fmt"
	"math/rand"
	"time"

	"github.com/CDavidSV/online-flip-flop/internal/types"
	"github.com/CDavidSV/online-flip-flop/internal/validator"
	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
	"github.com/lxzan/gws"
)

const (
	PingInterval = 60 * time.Second // Interval for sending ping messages
	PingWait     = 10 * time.Second // Wait time for a client to send ping message
)

type GameRoom struct {
	Game     *Game
	clients  *gws.ConcurrentMap[string, *Client]
	password string
}

type Client struct {
	ID         string
	Username   string
	joinedGame *Game
	conn       *gws.Conn
}

type Server struct {
	clients   *gws.ConcurrentMap[string, *Client]
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

func (s *Server) generateGameID() string {
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

func (s *Server) joinGame(gameID string, client *Client, password string) (*Game, PieceColor, error) {
	gameRoom := s.GetGameRoom(gameID)
	if gameRoom == nil {
		return nil, 0, ErrRoomNotFound
	}

	if gameRoom.password != "" && gameRoom.password != password {
		return nil, 0, ErrInvalidPassword
	}

	color, err := gameRoom.Game.AddPlayer(client.ID)
	if err != nil {
		if errors.Is(err, ErrGameFull) {
			// Simply add the user to the room for state updates
			gameRoom.clients.Store(client.ID, client)
			return gameRoom.Game, 0, nil
		}

		return nil, color, err
	}

	gameRoom.clients.Store(client.ID, client)
	return gameRoom.Game, color, nil
}

func (s *Server) leaveGame(gameID, playerID string) error {
	gameRoom := s.GetGameRoom(gameID)
	if gameRoom == nil {
		return ErrRoomNotFound
	}

	gameRoom.Game.RemovePlayer(playerID)
	return nil
}

func (s *Server) gameUpdateLoop(game *Game) {
	for update := range game.updatesCh {
		// TODO: Broadcast update to all clients in the game
		switch update.(type) {
		case MoveEvent:
			fmt.Println("Move event")
		case GameEndEvent:
			fmt.Println("Game ended")
		}
	}
}

func NewGameServer(logger echo.Logger) *Server {
	return &Server{
		clients:   gws.NewConcurrentMap[string, *Client](),
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
		socket, err := upgrader.Upgrade(c.Response().Writer, c.Request())
		if err != nil {
			return err
		}

		// Start connection read loop
		go func() {
			socket.ReadLoop()
		}()

		return nil
	}
}

func (s *Server) CreateGameRoom(gameType GameType, gameMode GameMode, password string) *GameRoom {
	game := NewGame(s.generateGameID(), gameType, gameMode, password)

	room := &GameRoom{
		Game:     game,
		password: password,
		clients:  gws.NewConcurrentMap[string, *Client](),
	}

	go func() {
		s.gameUpdateLoop(game)

		// TODO: Handle end of game cleanup
	}()

	s.rooms.Store(game.ID, room)
	return room
}

func (s *Server) GetGameRoom(roomID string) *GameRoom {
	room, exists := s.rooms.Load(roomID)
	if !exists {
		return nil
	}

	return room
}

func (r *GameRoom) RequiresPassword() bool {
	return r.password != ""
}

func (r *GameRoom) ValidatePassword(password string) bool {
	return r.password == password
}

// ------------------ WebSocket event handlers ------------------
func (s *Server) OnOpen(socket *gws.Conn) {
	_ = socket.SetDeadline(time.Now().Add(PingInterval + PingWait))

	clientID := uuid.New().String()
	socket.Session().Store("client_id", clientID)
	s.clients.Store(clientID, &Client{
		ID:   clientID,
		conn: socket,
	})
}

func (s *Server) OnClose(socket *gws.Conn, err error) {
	clientID := mustLoad[string](socket.Session(), "client_id")
	client, ok := s.clients.Load(clientID)
	if !ok {
		return
	}

	if client.joinedGame != nil {
		_ = s.leaveGame(client.joinedGame.ID, client.ID)
	}

	s.clients.Delete(clientID)
}

func (s *Server) OnPing(socket *gws.Conn, payload []byte) {
	_ = socket.SetDeadline(time.Now().Add(PingInterval + PingWait))
	_ = socket.WriteString("pong")
}

func (s *Server) OnPong(socket *gws.Conn, payload []byte) {}

func (s *Server) OnMessage(socket *gws.Conn, message *gws.Message) {
	clientID := mustLoad[string](socket.Session(), "client_id")
	client, ok := s.clients.Load(clientID)
	if !ok {
		_ = socket.WriteClose(1000, []byte(ErrClientNotFound.Error()))
		return
	}

	if b := message.Bytes(); len(b) == 4 && string(b) == "ping" {
		s.OnPing(socket, nil)
		return
	}

	var msg IncomingMessage
	err := json.Unmarshal(message.Bytes(), &msg)
	if err != nil {
		_ = socket.WriteMessage(gws.OpcodeText, NewErrorMessage(ErrInvalidMessageFormat))
		return
	}

	switch {
	case msg.Action == ActionJoinRoom:
		if client.joinedGame != nil {
			_ = socket.WriteMessage(gws.OpcodeText, NewErrorMessage(ErrAlreadyInRoom))
			return
		}

		var joinData MessageJoinRoom
		err := json.Unmarshal(msg.Payload, &joinData)
		if err != nil {
			_ = socket.WriteMessage(gws.OpcodeText, NewErrorMessage(ErrInvalidMessagePayload))
			return
		}

		// Attempt to add player to the specified game room
		game, color, err := s.joinGame(joinData.RoomID, client, joinData.Password)
		if err != nil {
			_ = socket.WriteMessage(gws.OpcodeText, NewErrorMessage(err))
			return
		}

		client.joinedGame = game

		// Send confirmation back to client
		confirmMsg := NewMessage(ActionJoinRoom, StatusSuccess, types.JSONMap{
			"game_id": game.ID,
			"color":   color,
		})
		_ = socket.WriteMessage(gws.OpcodeText, confirmMsg)
		return
	case msg.Action == ActionMove && client.joinedGame != nil:
		//err := client.joinedGame.MakeMove(client.ID, 0, 0, 0, 0)

		// Handle move action
	case msg.Action == ActionForfeit && client.joinedGame != nil:
		// Handle forfeit action
	case msg.Action == ActionLeave && client.joinedGame != nil:
		// Handle leave action
	case msg.Action == ActionSendMessage && client.joinedGame != nil:
		// Handle send message action
	default:
		if client.joinedGame == nil {
			_ = socket.WriteMessage(gws.OpcodeText, NewErrorMessage(ErrNotInGame))
			return
		}

		_ = socket.WriteMessage(gws.OpcodeText, NewErrorMessage(ErrInvalidAction))
	}
}
