package services

import (
	"fmt"
	"math/rand"
	"sync"
)

var ErrRoomNotFound = fmt.Errorf("room_not_found")

type GameManager struct {
	rooms map[string]*Game
	mu    sync.RWMutex
}

func NewGameManager() *GameManager {
	return &GameManager{
		rooms: make(map[string]*Game),
	}
}

func (gm *GameManager) CreateGameRoom(gameType GameType, gameMode GameMode, password string) *Game {
	game := NewGame(gm.generateGameID(), gameType, gameMode, password)

	gm.mu.Lock()
	defer gm.mu.Unlock()

	gm.rooms[game.ID] = game
	return game
}

func (gm *GameManager) GetGame(roomID string) (*Game, error) {
	gm.mu.RLock()
	defer gm.mu.RUnlock()

	game, exists := gm.rooms[roomID]
	if !exists {
		return nil, ErrRoomNotFound
	}

	return game, nil
}

func (gm *GameManager) generateGameID() string {
	charset := "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	idLength := 4

	// Iterate until we find a unique ID
	for {
		var id string
		for range idLength {
			id += string(charset[rand.Intn(len(charset))])
		}
		if _, exists := gm.rooms[id]; !exists {
			return id
		}
	}
}
