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
	host := flag.String("host", "localhost:8000", "Host address for the server")
	prod := flag.Bool("prod", false, "Run in production mode")
	flag.Parse()

	Host = *host

	if *prod {
		AllowedOrigins = allowedProdOrigins
	} else {
		AllowedOrigins = allowedDevOrigins
	}
}

var (
	Banner = `    _________             ________
   / ____/ (_)___        / ____/ /___  ____
  / /_  / / / __ \______/ /_  / / __ \/ __ \
 / __/ / / / /_/ /_____/ __/ / / /_/ / /_/ /
/_/   /_/_/ .___/     /_/   /_/\____/ .___/
         /_/                       /_/      `

	Version = "1.0.2"
	Host    = ":8000"

	AllowedOrigins []string
	APILogLevel    = log.INFO
	CorsConfig     = cors.Options{
		AllowedOrigins:   AllowedOrigins,
		AllowedMethods:   []string{"GET", "HEAD", "OPTIONS"},
		AllowedHeaders:   []string{"User-Agent", "Content-Type", "Accept", "Accept-Encoding", "Cache-Control"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: false,
		MaxAge:           300,
	}

	AIMoveDelay    = 1  // Delay in seconds before AI makes a move
	AIThinkTimeout = 30 // Time in seconds for AI to think before timing out
)
