package config

import (
	"os"
	"strconv"
)

type Config struct {
	Port            string
	DatabaseURL     string
	RedisHost       string
	RedisPort       string
	JWTSecret       string
	TelegramAPIID   int
	TelegramAPIHash string
}

func Load() *Config {
	port := getEnv("PORT", "5005")
	dbURL := getEnv("DATABASE_URL", "file:./dev.db")
	redisHost := getEnv("REDIS_HOST", "redis")
	redisPort := getEnv("REDIS_PORT", "6379")
	jwtSecret := getEnv("JWT_SECRET", "")

	apiIDStr := getEnv("TELEGRAM_API_ID", "0")
	apiID, err := strconv.Atoi(apiIDStr)
	if err != nil {
		apiID = 0
	}

	apiHash := getEnv("TELEGRAM_API_HASH", "")

	return &Config{
		Port:            port,
		DatabaseURL:     dbURL,
		RedisHost:       redisHost,
		RedisPort:       redisPort,
		JWTSecret:       jwtSecret,
		TelegramAPIID:   apiID,
		TelegramAPIHash: apiHash,
	}
}

func getEnv(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
}
