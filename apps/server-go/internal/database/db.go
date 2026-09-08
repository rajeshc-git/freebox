package database

import (
	"log"
	"strings"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func InitDB(databaseURL string) (*gorm.DB, error) {
	// Clean up database URL if it has "file:" prefix
	dbPath := databaseURL
	if strings.HasPrefix(dbPath, "file:") {
		dbPath = strings.TrimPrefix(dbPath, "file:")
	}

	db, err := gorm.Open(sqlite.Open(dbPath), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Warn),
	})
	if err != nil {
		return nil, err
	}

	// Auto-migrate tables
	if err := db.AutoMigrate(&User{}, &Folder{}, &File{}); err != nil {
		log.Printf("Warning: auto-migration error: %v", err)
	}

	return db, nil
}
