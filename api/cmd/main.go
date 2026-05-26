package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/joho/godotenv"

	"farmacia/api/handlers"
	appmiddleware "farmacia/api/middleware"
	"farmacia/api/repository"
)

func main() {
	_ = godotenv.Load("../.env.dev")
	_ = godotenv.Load("../.env")

	dbURL := mustEnv("DATABASE_URL")
	jwtSecreto := mustEnv("JWT_SECRET")
	port := mustEnv("PORT")

	db, err := repository.Connect(dbURL, os.Getenv("APP_TZ"))
	if err != nil {
		log.Fatalf("BD: %v", err)
	}
	defer db.Close()
	log.Println("Conectado a PostgreSQL")

	r := chi.NewRouter()

	r.Use(func(next http.Handler) http.Handler {
		logged := chimiddleware.Logger(next)
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.URL.Path == "/health" {
				next.ServeHTTP(w, r)
				return
			}
			logged.ServeHTTP(w, r)
		})
	})
	r.Use(chimiddleware.Recoverer)
	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
			next.ServeHTTP(w, r)
		})
	})

	if allowedOrigins := os.Getenv("ALLOWED_ORIGIN"); allowedOrigins != "" {
		origins := strings.Split(allowedOrigins, ",")
		for i, o := range origins {
			origins[i] = strings.TrimSpace(o)
		}
		r.Use(cors.Handler(cors.Options{
			AllowedOrigins: origins,
			AllowedMethods: []string{"GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"},
			AllowedHeaders: []string{"Accept", "Authorization", "Content-Type"},
		}))
	}

	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("ok"))
	})

	r.Route("/api", func(r chi.Router) {
		// Públicas
		r.Mount("/auth", handlers.AuthRouter(db, jwtSecreto))
		r.Mount("/configuracion", handlers.ConfiguracionRouter(db))

		// Protegidas — solo roles admin y farmacia
		r.Group(func(r chi.Router) {
			r.Use(appmiddleware.RequiereAuth(jwtSecreto))
			r.Use(appmiddleware.RequiereAccesoFarmacia())

			r.Mount("/pacientes", handlers.PacientesRouter(db))
			r.Mount("/medicamentos", handlers.MedicamentosRouter(db))
			r.Mount("/facturas", handlers.FacturasRouter(db))
			r.Mount("/dashboard", handlers.DashboardRouter(db))
		})
	})

	srv := &http.Server{
		Addr:         ":" + port,
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 60 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	go func() {
		log.Printf("Servidor farmacia escuchando en :%s", port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("error al iniciar servidor: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Apagando servidor...")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("error al apagar servidor: %v", err)
	}
	log.Println("Servidor detenido.")
}

func mustEnv(key string) string {
	v := os.Getenv(key)
	if v == "" {
		log.Fatalf("Variable de entorno requerida no definida: %s", key)
	}
	return v
}
