package config

import (
	"github.com/go-chi/cors"
	"github.com/labstack/gommon/log"
)

var (
	Banner = `    _________             ________
   / ____/ (_)___        / ____/ /___  ____
  / /_  / / / __ \______/ /_  / / __ \/ __ \
 / __/ / / / /_/ /_____/ __/ / / /_/ / /_/ /
/_/   /_/_/ .___/     /_/   /_/\____/ .___/
         /_/                       /_/      `

	Version = "0.7.1"
	Host    = ":8000"

	APILogLevel = log.INFO
	WSLogLevel  = "info"
	CorsConfig  = cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "HEAD", "OPTIONS"},
		AllowedHeaders:   []string{"User-Agent", "Content-Type", "Accept", "Accept-Encoding", "Cache-Control"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: false,
		MaxAge:           300,
	}
)
