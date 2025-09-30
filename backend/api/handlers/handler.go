package handlers

import (
	"net/http"

	"github.com/CDavidSV/online-flip-flop/api/services"
	"github.com/CDavidSV/online-flip-flop/config"
	"github.com/CDavidSV/online-flip-flop/internal/types"
	"github.com/labstack/echo/v4"
)

type Handler struct {
	gameManager *services.GameManager
}

func NewHandler(gm *services.GameManager) *Handler {
	return &Handler{
		gameManager: gm,
	}
}

func (h *Handler) Health(c echo.Context) error {
	return c.JSON(http.StatusOK, types.JSONMap{"status": "ok", "version": config.Version})
}
