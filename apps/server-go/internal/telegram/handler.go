package telegram

import (
	"net/http"
	"strconv"

	"freebox-server-go/internal/database"
	"freebox-server-go/internal/middleware"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type Handler struct {
	db     *gorm.DB
	tgPool *ClientPool
}

func NewHandler(db *gorm.DB, tgPool *ClientPool) *Handler {
	return &Handler{
		db:     db,
		tgPool: tgPool,
	}
}

func (h *Handler) GetSavedMessages(c *gin.Context) {
	userID := middleware.GetUserID(c)
	var files []database.File
	h.db.Where("isTrashed = ? AND userId = ?", false, userID).Order("createdAt DESC").Find(&files)

	messages := make([]gin.H, len(files))
	for i, f := range files {
		var thumbURL *string
		if f.TelegramMsgID > 0 {
			url := "/api/drive/files/" + f.ID + "/stream"
			thumbURL = &url
		}

		messages[i] = gin.H{
			"id":           f.TelegramMsgID,
			"fileId":       f.ID,
			"fileName":     f.Name,
			"spoolHash":    f.SpoolHash,
			"size":         f.Size,
			"type":         f.Type,
			"mimeType":     f.MimeType,
			"time":         f.CreatedAt.Format("03:04 PM"),
			"date":         f.CreatedAt.Format("January 2"),
			"status":       f.TelegramStatus,
			"thumbnailUrl": thumbURL,
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"chatTitle":     "Saved Messages",
		"totalMessages": len(files),
		"messages":      messages,
	})
}

func (h *Handler) GetArchivedChats(c *gin.Context) {
	phone := middleware.GetUserPhone(c)
	chats, err := h.tgPool.GetArchivedChats(c.Request.Context(), phone)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, chats)
}

func (h *Handler) GetChatMedia(c *gin.Context) {
	phone := middleware.GetUserPhone(c)
	chatID := c.Param("chatId")
	category := c.Query("category")
	limitStr := c.DefaultQuery("limit", "60")
	offsetIDStr := c.Query("offsetId")

	limit, _ := strconv.Atoi(limitStr)
	offsetID, _ := strconv.Atoi(offsetIDStr)

	media, hasMore, nextOffset, err := h.tgPool.GetChatMedia(c.Request.Context(), phone, chatID, category, limit, offsetID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"media":        media,
		"count":        len(media),
		"hasMore":      hasMore,
		"nextOffsetId": nextOffset,
	})
}

func (h *Handler) StreamChatMedia(c *gin.Context) {
	phone := middleware.GetUserPhone(c)
	chatID := c.Param("chatId")
	messageIDStr := c.Param("messageId")

	msgID, err := strconv.Atoi(messageIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid messageId"})
		return
	}

	h.tgPool.StreamChatMedia(c.Request.Context(), phone, chatID, msgID, c.Writer, c.Request)
}

func (h *Handler) GetChatStats(c *gin.Context) {
	phone := middleware.GetUserPhone(c)
	chatID := c.Param("chatId")

	stats, err := h.tgPool.GetChatStats(c.Request.Context(), phone, chatID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, stats)
}
