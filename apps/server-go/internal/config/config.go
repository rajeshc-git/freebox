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
	jwtSecret := getEnv("JWT_SECRET", "dock_jwt_secret_super_secure_key_2026")

	apiIDStr := getEnv("TELEGRAM_API_ID", "6")
	apiID, err := strconv.Atoi(apiIDStr)
	if err != nil {
		apiID = 6
	}

	apiHash := getEnv("TELEGRAM_API_HASH", "eb06d4abfb49dc3eeb1aeb98ae0f581e")

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
