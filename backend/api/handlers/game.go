package handlers

import (
	"net/http"

	"github.com/CDavidSV/online-flip-flop/games"
	"github.com/CDavidSV/online-flip-flop/internal/apperrors"
	"github.com/CDavidSV/online-flip-flop/internal/types"
	"github.com/CDavidSV/online-flip-flop/ws"
	"github.com/labstack/echo/v4"
)

type CreateGameDTO struct {
	GameMode ws.GameMode    `json:"game_mode" validate:"required,oneof=1 2"`
	GameType games.GameType `json:"game_type" validate:"required,oneof=1 2 3"`
}

func (h *Handler) PostCreateGame(c echo.Context) error {
	var createGameReq CreateGameDTO
	if err := c.Bind(&createGameReq); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, apperrors.New(apperrors.ErrInvalidRequestPayload))
	}
	if err := c.Validate(&createGameReq); err != nil {
		return err
	}

	gameRoom := h.gameServer.CreateGameRoom(
		createGameReq.GameType,
		createGameReq.GameMode,
	)

	return c.JSON(http.StatusOK, types.JSONMap{
		"game_room_id": gameRoom.ID,
	})
}

func (h *Handler) GetGameRoom(c echo.Context) error {
	gameRoomID := c.Param("id")
	if gameRoomID == "" {
		return echo.NewHTTPError(http.StatusBadRequest, apperrors.New(apperrors.ErrInvalidRequestPayload))
	}

	gameRoom := h.gameServer.GetGameRoom(gameRoomID)
	if gameRoom == nil {
		return echo.NewHTTPError(http.StatusNotFound, apperrors.New(apperrors.ErrRoomNotFound))
	}

	return c.JSON(http.StatusOK, types.JSONMap{
		"game_room_id": gameRoom.ID,
		"game_type":    gameRoom.GameType,
		"game_mode":    gameRoom.GameMode,
	})
}
