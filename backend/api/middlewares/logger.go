package middlewares

import (
	"fmt"
	"strconv"
	"time"

	"github.com/charmbracelet/lipgloss"
	"github.com/labstack/echo/v4"
)

var methodColors map[string]string = map[string]string{
	"GET":     "#388de3ff",
	"POST":    "#1bb16dff",
	"PUT":     "#dc851aff",
	"PATCH":   "#00bb92ff",
	"DELETE":  "#F93E3E",
	"HEAD":    "#9012FE",
	"OPTIONS": "#0D5AA7",
}

func styleStatusCode(code int) string {
	style := lipgloss.NewStyle().Bold(true)
	codeStr := strconv.Itoa(code)

	if code >= 100 && code <= 199 {
		return style.Background(lipgloss.Color("#0D5AA7")).Render("", codeStr, "")
	}

	if code >= 200 && code <= 299 {
		return style.Background(lipgloss.Color("#31a872ff")).Render("", codeStr, "")
	}

	if code >= 300 && code <= 399 {
		return style.Background(lipgloss.Color("#ff8c00ff")).Render("", codeStr, "")
	}

	if code >= 400 && code <= 599 {
		return style.Background(lipgloss.Color("#F93E3E")).Render("", codeStr, "")
	}

	return style.Render("", codeStr, "")
}

func styleMethod(method string) string {
	color, ok := methodColors[method]
	if !ok {
		return method
	}

	style := lipgloss.NewStyle().Background(lipgloss.Color(color)).Bold(true)
	return style.Render(fmt.Sprintf(" %-8s ", method))
}

func Logger(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		ip := c.RealIP()
		path := c.Path()
		method := styleMethod(c.Request().Method)
		now := time.Now()

		if err := next(c); err != nil {
			c.Error(err)
		}

		res := c.Response()
		took := time.Since(now).String()
		status := styleStatusCode(res.Status)

		fmt.Printf("%s |%s| %13s | %15s |%s %s\n", now.Format("2006/01/02 - 15:04:05"), status, took, ip, method, path)
		return nil
	}
}
