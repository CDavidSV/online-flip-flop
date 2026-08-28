package config

import (
	"flag"

	"github.com/go-chi/cors"
	"github.com/labstack/gommon/log"
)

var allowedDevOrigins = []string{
	"*",
}

var allowedProdOrigins = []string{
	"https://flipflop.cdavidsv.dev",
}

func init() {
	AllowedOrigins = allowedDevOrigins
}

var hostFlag = flag.String("host", "localhost:8000", "Host address for the server")
var prodFlag = flag.Bool("prod", false, "Run in production mode")

// ParseFlags applies command-line configuration for the server executable.
func ParseFlags() {
	flag.Parse()

	Host = *hostFlag
	if *prodFlag {
		AllowedOrigins = allowedProdOrigins
	} else {
		AllowedOrigins = allowedDevOrigins
	}
	CorsConfig.AllowedOrigins = AllowedOrigins
}

var (
	Banner = `    _________             ________
   / ____/ (_)___        / ____/ /___  ____
  / /_  / / / __ \______/ /_  / / __ \/ __ \
 / __/ / / / /_/ /_____/ __/ / / /_/ / /_/ /
/_/   /_/_/ .___/     /_/   /_/\____/ .___/
         /_/                       /_/      `

	Version = "1.1.0"
	Host    = ":8000"

	AllowedOrigins []string
	APILogLevel    = log.INFO
	CorsConfig     = cors.Options{
		AllowedOrigins:   allowedDevOrigins,
		AllowedMethods:   []string{"GET", "HEAD", "OPTIONS"},
		AllowedHeaders:   []string{"User-Agent", "Content-Type", "Accept", "Accept-Encoding", "Cache-Control"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: false,
		MaxAge:           300,
	}

	AIMoveDelay         = 1      // Delay in seconds before AI makes a move
	AIThinkTimeout      = 30     // Time in seconds for AI to think before timing out
	RoomInactiveTimeout = 5 * 60 // Time in seconds before an inactive room is closed
)
