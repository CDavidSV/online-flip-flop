package main

import (
	"fmt"

	"github.com/CDavidSV/online-flip-flop/api/handlers"
	"github.com/CDavidSV/online-flip-flop/api/middlewares"
	"github.com/CDavidSV/online-flip-flop/config"
	"github.com/CDavidSV/online-flip-flop/internal/validator"
	"github.com/CDavidSV/online-flip-flop/ws"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	"github.com/labstack/gommon/log"
)

func loadRoutes(e *echo.Echo, gs *ws.Server) {
	h := handlers.NewHandler(gs)

	e.GET("/health", h.Health)

	gameGroup := e.Group("/game")
	gameGroup.POST("/room/create", h.PostCreateGame)
	gameGroup.GET("/room/:id", h.GetGameRoom)
	gameGroup.Any("/ws", ws.WSHandler(gs))
}

func main() {
	e := echo.New()
	e.HideBanner = true

	if l, ok := e.Logger.(*log.Logger); ok {
		l.SetHeader("${time_rfc3339} ${level}")
		l.SetLevel(config.APILogLevel)
	}

	e.Validator = validator.New()

	fmt.Println(config.Banner)
	fmt.Println("Version:", config.Version)

	// Middleware
	e.Use(middleware.Recover())
	e.Use(middlewares.Logger)
	e.Use(middleware.CORSWithConfig(config.CorsConfig))

	gameServer := ws.NewGameServer(e.Logger)
	loadRoutes(e, gameServer)

	// Start Server
	e.Logger.Fatal(e.Start(config.Host))
}
