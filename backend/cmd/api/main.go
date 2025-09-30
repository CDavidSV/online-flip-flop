package main

import (
	"fmt"

	"github.com/CDavidSV/online-flip-flop/api/handlers"
	"github.com/CDavidSV/online-flip-flop/api/middlewares"
	"github.com/CDavidSV/online-flip-flop/api/services"
	"github.com/CDavidSV/online-flip-flop/config"
	"github.com/CDavidSV/online-flip-flop/internal/validator"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
)

func loadRoutes(e *echo.Echo, gm *services.GameManager) {
	h := handlers.NewHandler(gm)

	e.GET("/health", h.Health)

	gameGroup := e.Group("/game")
	gameGroup.POST("/create", h.CreateGame)
}

func main() {
	e := echo.New()
	e.HideBanner = true

	e.Validator = validator.New()

	fmt.Println(config.Banner)
	fmt.Println("Version:", config.Version)

	// Middleware
	e.Use(middleware.Recover())
	e.Use(middlewares.Logger)
	e.Use(middleware.CORSWithConfig(config.CorsConfig))

	gameManager := services.NewGameManager()

	loadRoutes(e, gameManager)

	// Start Server
	e.Logger.Fatal(e.Start(config.Host))
}
