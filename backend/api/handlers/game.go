package handlers

import (
	"net/http"

	"github.com/CDavidSV/online-flip-flop/game"
	"github.com/CDavidSV/online-flip-flop/internal/types"
	"github.com/labstack/echo/v4"
)

type CreateGameDTO struct {
	GameMode game.GameMode `json:"game_mode" validate:"required,oneof=1 2"`
	GameType game.GameType `json:"game_type" validate:"required,oneof=1 2 3"`
	Password string        `json:"password,omitempty" validate:"omitempty,min=4,max=20"`
}

func (h *Handler) CreateGame(c echo.Context) error {
	var createGameReq CreateGameDTO
	if err := c.Bind(&createGameReq); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid request payload")
	}

	if err := c.Validate(&createGameReq); err != nil {
		return err
	}

	gameRoom := h.gameServer.CreateGameRoom(
		createGameReq.GameType,
		createGameReq.GameMode,
		createGameReq.Password,
	)

	return c.JSON(http.StatusOK, types.JSONMap{
		"game_room_id": gameRoom.Game.ID,
	})
}

func (h *Handler) GetGame(c echo.Context) error {
	gameID := c.Param("id")
	gameRoom := h.gameServer.GetGameRoom(gameID)
	if gameRoom == nil {
		return echo.NewHTTPError(http.StatusNotFound, "Game room not found")
	}

	return c.JSON(http.StatusOK, types.JSONMap{
		"game_room_id":      gameRoom.Game.ID,
		"game_type":         gameRoom.Game.GameType,
		"game_mode":         gameRoom.Game.GameMode,
		"requires_password": gameRoom.RequiresPassword(),
	})
}
