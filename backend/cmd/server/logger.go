package main

import (
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/charmbracelet/lipgloss"
	"github.com/go-chi/chi/v5/middleware"
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

func Logger(next http.Handler) http.Handler {
	return http.HandlerFunc(func(res http.ResponseWriter, req *http.Request) {
		ww := middleware.NewWrapResponseWriter(res, req.ProtoMajor)

		ip := req.RemoteAddr
		if ip == "" {
			ip = req.Header.Get("X-Forwarded-For")
		}
		path := req.URL.Path
		method := styleMethod(req.Method)
		now := time.Now()

		next.ServeHTTP(ww, req)

		took := time.Since(now).String()
		status := styleStatusCode(ww.Status())

		fmt.Printf("%s |%s| %13s | %15s |%s %s\n", now.Format("2006/01/02 - 15:04:05"), status, took, ip, method, path)
	})
}
