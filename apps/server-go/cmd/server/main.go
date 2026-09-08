package main

import (
	"fmt"
	"log"

	"freebox-server-go/internal/auth"
	"freebox-server-go/internal/config"
	"freebox-server-go/internal/database"
	"freebox-server-go/internal/drive"
	"freebox-server-go/internal/middleware"
	"freebox-server-go/internal/redis"
	"freebox-server-go/internal/telegram"

	"github.com/gin-gonic/gin"
)

func main() {
	cfg := config.Load()

	// Initialize pure Go SQLite DB
	db, err := database.InitDB(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}

	// Initialize Redis
	redisClient := redis.New(cfg.RedisHost, cfg.RedisPort)

	// Initialize Telegram ClientPool
	tgPool := telegram.NewClientPool(cfg.TelegramAPIID, cfg.TelegramAPIHash, redisClient)

	// Initialize Handlers
	authHandler := auth.NewHandler(db, redisClient, tgPool, cfg.JWTSecret)
	driveHandler := drive.NewHandler(db, tgPool)
	telegramHandler := telegram.NewHandler(db, tgPool)

	// Setup Gin Engine
	gin.SetMode(gin.ReleaseMode)
	r := gin.New()
	r.Use(gin.Recovery())
	r.Use(gin.Logger())
	r.Use(middleware.CORSMiddleware())

	// API Routes
	api := r.Group("/api")
	{
		// Auth Routes
		authGroup := api.Group("/auth")
		{
			authGroup.POST("/send-code", authHandler.SendCode)
			authGroup.POST("/verify-code", authHandler.VerifyCode)
			authGroup.GET("/me", middleware.AuthMiddleware(cfg.JWTSecret), authHandler.GetMe)
		}

		// Drive Routes
		driveGroup := api.Group("/drive")
		{
			// Folders
			driveGroup.GET("/folders", driveHandler.GetFolders)
			driveGroup.POST("/folders", middleware.OptionalAuthMiddleware(cfg.JWTSecret), driveHandler.CreateFolder)
			driveGroup.PATCH("/folders/:id", middleware.OptionalAuthMiddleware(cfg.JWTSecret), driveHandler.RenameFolder)
			driveGroup.DELETE("/folders/:id", middleware.OptionalAuthMiddleware(cfg.JWTSecret), driveHandler.DeleteFolder)

			// Files
			driveGroup.GET("/files", driveHandler.GetFiles)
			driveGroup.GET("/storage/metrics", driveHandler.GetStorageMetrics)
			driveGroup.GET("/storage-metrics", driveHandler.GetStorageMetrics)

			// Upload
			driveGroup.POST("/files/upload", middleware.AuthMiddleware(cfg.JWTSecret), driveHandler.UploadFile)

			// Stream & Download
			driveGroup.GET("/files/:id/stream", middleware.OptionalAuthMiddleware(cfg.JWTSecret), driveHandler.StreamFile)
			driveGroup.GET("/files/:id/download", middleware.OptionalAuthMiddleware(cfg.JWTSecret), driveHandler.DownloadFile)
			driveGroup.GET("/files/batch/download", middleware.OptionalAuthMiddleware(cfg.JWTSecret), driveHandler.DownloadBatch)

			// Public share
			driveGroup.GET("/public/share/:spoolHash", driveHandler.GetPublicShareInfo)
			driveGroup.GET("/public/stream/:spoolHash", driveHandler.StreamPublicFile)
			driveGroup.GET("/public/download/:spoolHash", driveHandler.DownloadPublicFile)

			// File Management
			driveGroup.PATCH("/files/:id/move", middleware.OptionalAuthMiddleware(cfg.JWTSecret), driveHandler.MoveFile)
			driveGroup.PATCH("/files/batch/move", middleware.OptionalAuthMiddleware(cfg.JWTSecret), driveHandler.MoveFiles)
			driveGroup.PATCH("/files/:id/star", middleware.OptionalAuthMiddleware(cfg.JWTSecret), driveHandler.ToggleStar)

			// Trash
			driveGroup.DELETE("/trash/empty", middleware.OptionalAuthMiddleware(cfg.JWTSecret), driveHandler.EmptyTrash)
			driveGroup.POST("/trash/restore-batch", middleware.OptionalAuthMiddleware(cfg.JWTSecret), driveHandler.RestoreBatch)
			driveGroup.DELETE("/trash/delete-batch", middleware.OptionalAuthMiddleware(cfg.JWTSecret), driveHandler.DeleteBatchPermanent)
			driveGroup.DELETE("/files/:id", middleware.OptionalAuthMiddleware(cfg.JWTSecret), driveHandler.DeleteFile)
			driveGroup.POST("/files/:id/restore", middleware.OptionalAuthMiddleware(cfg.JWTSecret), driveHandler.RestoreFile)
		}

		// Telegram Routes
		tgGroup := api.Group("/telegram")
		{
			tgGroup.GET("/saved-messages", telegramHandler.GetSavedMessages)
			tgGroup.GET("/archived-chats", middleware.AuthMiddleware(cfg.JWTSecret), telegramHandler.GetArchivedChats)
			tgGroup.GET("/chats/:chatId/media", middleware.AuthMiddleware(cfg.JWTSecret), telegramHandler.GetChatMedia)
			tgGroup.GET("/chats/:chatId/media/:messageId/stream", middleware.OptionalAuthMiddleware(cfg.JWTSecret), telegramHandler.StreamChatMedia)
			tgGroup.GET("/chats/:chatId/stats", middleware.AuthMiddleware(cfg.JWTSecret), telegramHandler.GetChatStats)
		}
	}

	addr := fmt.Sprintf(":%s", cfg.Port)
	log.Printf("⚡ FreeBox Go Backend listening on %s (RAM footprint: ~25MB)", addr)
	if err := r.Run(addr); err != nil {
		log.Fatalf("Server run error: %v", err)
	}
}
