package handlers

import (
	"net/http"

	"github.com/CDavidSV/online-flip-flop/config"
	"github.com/CDavidSV/online-flip-flop/game"
	"github.com/CDavidSV/online-flip-flop/internal/types"
	"github.com/labstack/echo/v4"
)

type Handler struct {
	gameServer *game.Server
}

func NewHandler(gameServer *game.Server) *Handler {
	return &Handler{gameServer: gameServer}
}

func (h *Handler) Health(c echo.Context) error {
	return c.JSON(http.StatusOK, types.JSONMap{"status": "ok", "version": config.Version})
}
