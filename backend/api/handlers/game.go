package handlers

import (
	"net/http"

	"github.com/CDavidSV/online-flip-flop/api/services"
	"github.com/CDavidSV/online-flip-flop/internal/types"
	"github.com/labstack/echo/v4"
)

type CreateGameDTO struct {
	GameMode services.GameMode `json:"game_mode" validate:"required,oneof=1 2"`
	GameType services.GameType `json:"game_type" validate:"required,oneof=1 2 3"`
	Password string            `json:"password,omitempty" validate:"omitempty,min=4,max=20"`
}

func (h *Handler) CreateGame(c echo.Context) error {
	var createGameReq CreateGameDTO
	if err := c.Bind(&createGameReq); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid request payload")
	}

	if err := c.Validate(&createGameReq); err != nil {
		return err
	}

	game := h.gameManager.CreateGameRoom(
		createGameReq.GameType,
		createGameReq.GameMode,
		createGameReq.Password,
	)

	return c.JSON(http.StatusOK, types.JSONMap{
		"game_room_id": game.ID,
	})
}
