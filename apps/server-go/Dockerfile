FROM golang:1.23-alpine AS builder

WORKDIR /app

RUN apk add --no-cache git ca-certificates

COPY apps/server-go/ ./
RUN go mod tidy
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /freebox-server ./cmd/server

FROM alpine:3.21 AS runner

RUN apk add --no-cache ca-certificates tzdata

WORKDIR /app
RUN mkdir -p /app/data

COPY --from=builder /freebox-server /app/freebox-server

EXPOSE 5005

CMD ["/app/freebox-server"]

