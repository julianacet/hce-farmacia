FROM golang:1.25-alpine AS builder

WORKDIR /app

COPY . .
RUN go mod tidy && \
    CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o farm-api ./cmd/main.go

FROM alpine:3.20

RUN apk add --no-cache ca-certificates tzdata cups-client

WORKDIR /app
COPY --from=builder /app/farm-api .

EXPOSE 8010

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:8010/health || exit 1

CMD ["./farm-api"]
