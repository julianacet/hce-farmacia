package middleware

import (
	"net"
	"net/http"
	"sync"
	"time"
)

const (
	loginMaxAttempts = 10
	loginWindow      = time.Minute
)

type loginLimiter struct {
	mu      sync.Mutex
	buckets map[string]*loginBucket
}

type loginBucket struct {
	count   int
	resetAt time.Time
}

var loginRL = &loginLimiter{buckets: make(map[string]*loginBucket)}

func init() {
	go func() {
		ticker := time.NewTicker(5 * time.Minute)
		defer ticker.Stop()
		for range ticker.C {
			now := time.Now()
			loginRL.mu.Lock()
			for ip, b := range loginRL.buckets {
				if now.After(b.resetAt) {
					delete(loginRL.buckets, ip)
				}
			}
			loginRL.mu.Unlock()
		}
	}()
}

func LimitarLogin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ip := r.RemoteAddr
		if host, _, err := net.SplitHostPort(ip); err == nil {
			ip = host
		}

		loginRL.mu.Lock()
		b, ok := loginRL.buckets[ip]
		if !ok || time.Now().After(b.resetAt) {
			b = &loginBucket{resetAt: time.Now().Add(loginWindow)}
			loginRL.buckets[ip] = b
		}
		b.count++
		over := b.count > loginMaxAttempts
		loginRL.mu.Unlock()

		if over {
			http.Error(w, `{"error":"demasiados intentos, espere un momento"}`, http.StatusTooManyRequests)
			return
		}
		next.ServeHTTP(w, r)
	})
}
