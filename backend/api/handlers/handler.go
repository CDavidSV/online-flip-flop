package handlers

import (
	"net/http"
	"time"

	"github.com/CDavidSV/online-flip-flop/config"
	"github.com/CDavidSV/online-flip-flop/internal/types"
	"github.com/CDavidSV/online-flip-flop/ws"
	"github.com/labstack/echo/v4"
)

type Handler struct {
	gameServer *ws.Server
	startedAt  time.Time
}

func NewHandler(gameServer *ws.Server) *Handler {
	return &Handler{gameServer: gameServer, startedAt: time.Now()}
}

func (h *Handler) Health(c echo.Context) error {
	return c.JSON(http.StatusOK, types.JSONMap{
		"status":  "ok",
		"version": config.Version,
		"uptime":  time.Since(h.startedAt).String(),
	})
}
