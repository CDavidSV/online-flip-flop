package config

import "github.com/labstack/echo/v4/middleware"

var (
	Banner = `    _________             ________
   / ____/ (_)___        / ____/ /___  ____
  / /_  / / / __ \______/ /_  / / __ \/ __ \
 / __/ / / / /_/ /_____/ __/ / / /_/ / /_/ /
/_/   /_/_/ .___/     /_/   /_/\____/ .___/
         /_/                       /_/      `

	Version = "0.1.0"
	Host    = ":8000"

	CorsConfig = middleware.CORSConfig{
		AllowOrigins:  []string{"*"},
		AllowMethods:  []string{"GET", "POST", "DELETE", "HEAD", "OPTION", "PUT"},
		AllowHeaders:  []string{"User-Agent", "Content-Type", "Accept", "Accept-Encoding", "Accept-Language", "Cache-Control", "Connection", "DNT", "Host", "Origin", "Pragma", "Referer", "Cookie"},
		ExposeHeaders: []string{"Link"},
	}
)
