package main

import (
	"flag"
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
	host := flag.String("host", "localhost:8000", "Host address for the server")
	flag.Parse()

	r := chi.NewRouter()
	logger := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	}))

	fmt.Println(config.Banner)
	fmt.Println("Version:", config.Version)
	fmt.Println("Server listening on", *host)

	// Middleware
	r.Use(Logger)
	r.Use(middleware.Recoverer)
	r.Use(cors.Handler(config.CorsConfig))

	// Register WebSocket handler
	gameServer := ws.NewGameServer(logger)
	r.Get("/ws", ws.WSHandler(gameServer))

	// Start Server
	slog.Info("Running in development mode")
	log.Fatal(http.ListenAndServe(*host, r))
}
