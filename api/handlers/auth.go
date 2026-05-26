package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"

	appmiddleware "farmacia/api/middleware"
)

type authHandler struct {
	db      *pgxpool.Pool
	secreto string
}

func AuthRouter(db *pgxpool.Pool, secreto string) http.Handler {
	h := &authHandler{db: db, secreto: secreto}
	r := chi.NewRouter()
	r.With(appmiddleware.LimitarLogin).Post("/login", h.login)
	r.Post("/logout", h.logout)
	r.With(appmiddleware.RequiereAuth(secreto)).Get("/me", h.me)
	return r
}

type loginInput struct {
	NombreUsuario string `json:"nombre_usuario"`
	Contrasena    string `json:"contrasena"`
}

func (h *authHandler) login(w http.ResponseWriter, r *http.Request) {
	var input loginInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		responderError(w, http.StatusBadRequest, "body inválido")
		return
	}

	var id, nombre, rol, hash string
	err := h.db.QueryRow(r.Context(), `
		SELECT id, nombre_completo, rol, hash_contrasena
		FROM usuario
		WHERE nombre_usuario = $1 AND esta_activo = TRUE`,
		input.NombreUsuario,
	).Scan(&id, &nombre, &rol, &hash)
	if err != nil {
		responderError(w, http.StatusUnauthorized, "credenciales inválidas")
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(input.Contrasena)); err != nil {
		responderError(w, http.StatusUnauthorized, "credenciales inválidas")
		return
	}

	claims := appmiddleware.ClaimsUsuario{
		ID:     id,
		Nombre: nombre,
		Rol:    rol,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(12 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenStr, err := token.SignedString([]byte(h.secreto))
	if err != nil {
		responderError(w, http.StatusInternalServerError, "error al generar token")
		return
	}

	responderJSON(w, http.StatusOK, map[string]any{
		"token":  tokenStr,
		"nombre": nombre,
		"rol":    rol,
	})
}

func (h *authHandler) logout(w http.ResponseWriter, r *http.Request) {
	responderJSON(w, http.StatusOK, map[string]string{"mensaje": "sesión cerrada"})
}

func (h *authHandler) me(w http.ResponseWriter, r *http.Request) {
	u := appmiddleware.UsuarioDesdeContexto(r.Context())
	if u == nil {
		responderError(w, http.StatusUnauthorized, "no autorizado")
		return
	}
	responderJSON(w, http.StatusOK, map[string]string{
		"id":     u.ID,
		"nombre": u.Nombre,
		"rol":    u.Rol,
	})
}
