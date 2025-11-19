package main

import (
	"fmt"
	"log"
	"log/slog"
	"net/http"
	"os"

	"github.com/CDavidSV/online-flip-flop/config"
	"github.com/CDavidSV/online-flip-flop/ws"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
)

func main() {
	r := chi.NewRouter()
	logger := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	}))

	fmt.Println(config.Banner)
	fmt.Println("Version:", config.Version)

	// Middleware
	r.Use(Logger)
	r.Use(middleware.Recoverer)
	r.Use(cors.Handler(config.CorsConfig))

	// Register WebSocket handler
	gameServer := ws.NewGameServer(logger)
	r.Get("/ws", ws.WSHandler(gameServer))

	// Start Server
	log.Fatal(http.ListenAndServe(":8000", r))
}
