package drive

import (
	"archive/zip"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"freebox-server-go/internal/database"
	"freebox-server-go/internal/middleware"
	"freebox-server-go/internal/telegram"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Handler struct {
	db     *gorm.DB
	tgPool *telegram.ClientPool
}

func NewHandler(db *gorm.DB, tgPool *telegram.ClientPool) *Handler {
	return &Handler{
		db:     db,
		tgPool: tgPool,
	}
}

// Folders
func (h *Handler) GetFolders(c *gin.Context) {
	parentID := c.Query("parentId")
	userID := middleware.GetUserID(c)
	var folders []database.Folder

	query := h.db.Where("userId = ?", userID).Order("createdAt DESC")
	if parentID != "" && parentID != "all" {
		if parentID == "root" || parentID == "null" {
			query = query.Where("parentId IS NULL")
		} else {
			query = query.Where("parentId = ?", parentID)
		}
	}

	if err := query.Find(&folders).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Database query error"})
		return
	}

	// Attach counts for frontend
	for i := range folders {
		var fileCount, childCount int64
		h.db.Model(&database.File{}).Where("folderId = ? AND isTrashed = ? AND userId = ?", folders[i].ID, false, userID).Count(&fileCount)
		h.db.Model(&database.Folder{}).Where("parentId = ? AND userId = ?", folders[i].ID, userID).Count(&childCount)
		folders[i].Count = &database.FolderCount{
			Files:    fileCount,
			Children: childCount,
		}
	}

	c.JSON(http.StatusOK, folders)
}

func (h *Handler) CreateFolder(c *gin.Context) {
	var body struct {
		Name     string  `json:"name" binding:"required"`
		ParentID *string `json:"parentId"`
		Color    string  `json:"color"`
	}

	if err := c.ShouldBindJSON(&body); err != nil || strings.TrimSpace(body.Name) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Folder name is required"})
		return
	}

	color := body.Color
	if color == "" {
		color = "#3b82f6"
	}

	var parentID *string
	if body.ParentID != nil && *body.ParentID != "root" && *body.ParentID != "null" && *body.ParentID != "" {
		parentID = body.ParentID
	}

	userID := middleware.GetUserID(c)
	folder := database.Folder{
		ID:        uuid.New().String(),
		Name:      strings.TrimSpace(body.Name),
		Color:     color,
		ParentID:  parentID,
		UserID:    &userID,
		CreatedAt: database.FlexibleTime(time.Now()),
		UpdatedAt: database.FlexibleTime(time.Now()),
	}

	if err := h.db.Create(&folder).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to create folder"})
		return
	}

	c.JSON(http.StatusOK, folder)
}

func (h *Handler) RenameFolder(c *gin.Context) {
	id := c.Param("id")
	userID := middleware.GetUserID(c)
	var body struct {
		Name string `json:"name" binding:"required"`
	}

	if err := c.ShouldBindJSON(&body); err != nil || strings.TrimSpace(body.Name) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Folder name is required"})
		return
	}

	var folder database.Folder
	if err := h.db.Where("id = ? AND userId = ?", id, userID).First(&folder).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"message": "Folder not found"})
		return
	}

	folder.Name = strings.TrimSpace(body.Name)
	folder.UpdatedAt = database.FlexibleTime(time.Now())
	h.db.Save(&folder)

	c.JSON(http.StatusOK, folder)
}

func (h *Handler) DeleteFolder(c *gin.Context) {
	id := c.Param("id")
	userID := middleware.GetUserID(c)
	var folder database.Folder
	if err := h.db.Where("id = ? AND userId = ?", id, userID).First(&folder).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"message": "Folder not found"})
		return
	}

	// Soft delete files in this folder
	h.db.Model(&database.File{}).Where("folderId = ? AND userId = ?", id, userID).Update("isTrashed", true)

	// Delete subfolders recursively
	var children []database.Folder
	h.db.Where("parentId = ? AND userId = ?", id, userID).Find(&children)
	for _, child := range children {
		h.deleteFolderRecursive(child.ID, userID)
	}

	h.db.Delete(&folder)
	c.JSON(http.StatusOK, gin.H{"success": true})
}

func (h *Handler) deleteFolderRecursive(id string, userID string) {
	h.db.Model(&database.File{}).Where("folderId = ? AND userId = ?", id, userID).Update("isTrashed", true)
	var children []database.Folder
	h.db.Where("parentId = ? AND userId = ?", id, userID).Find(&children)
	for _, child := range children {
		h.deleteFolderRecursive(child.ID, userID)
	}
	h.db.Where("id = ? AND userId = ?", id, userID).Delete(&database.Folder{})
}

// Files
func (h *Handler) GetFiles(c *gin.Context) {
	folderID := c.Query("folderId")
	category := c.Query("category")
	search := c.Query("search")
	nav := c.Query("nav") // 'all' | 'recent' | 'starred' | 'trash'
	userID := middleware.GetUserID(c)

	query := h.db.Where("userId = ?", userID).Order("createdAt DESC")

	if nav == "trash" {
		query = query.Where("isTrashed = ?", true)
	} else {
		query = query.Where("isTrashed = ?", false)

		if nav == "starred" {
			query = query.Where("starred = ?", true)
		} else if nav == "recent" {
			// No folder restriction
		} else {
			if search == "" {
				if folderID == "root" || folderID == "null" || folderID == "" {
					query = query.Where("folderId IS NULL")
				} else {
					query = query.Where("folderId = ?", folderID)
				}
			}
		}
	}

	if category != "" && category != "all" {
		if category == "live_photo" {
			query = query.Where("type IN ?", []string{"image", "video"})
		} else {
			query = query.Where("type = ?", category)
		}
	}

	if search != "" {
		query = query.Where("name LIKE ? OR spoolHash LIKE ?", "%"+search+"%", "%"+search+"%")
	}

	var files []database.File
	if err := query.Find(&files).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Database error"})
		return
	}

	// Filter paired live photo files from My Files and normal categories for THIS user
	finalFiles := files
	if category != "live_photo" && nav != "trash" {
		var allMedia []database.File
		h.db.Where("userId = ? AND isTrashed = ? AND type IN ?", userID, false, []string{"image", "video"}).Select("name", "mimeType").Find(&allMedia)
		images := make(map[string]bool)
		videos := make(map[string]bool)
		for _, f := range allMedia {
			ext := strings.ToLower(filepath.Ext(f.Name))
			base := strings.ToLower(strings.TrimSuffix(f.Name, ext))
			if ext == ".heic" || ext == ".jpg" || ext == ".jpeg" || ext == ".png" || strings.HasPrefix(f.MimeType, "image/") {
				images[base] = true
			}
			if ext == ".mov" || ext == ".mp4" || strings.HasPrefix(f.MimeType, "video/") {
				videos[base] = true
			}
		}
		pairedBases := make(map[string]bool)
		for b := range images {
			if videos[b] {
				pairedBases[b] = true
			}
		}
		if len(pairedBases) > 0 {
			var filtered []database.File
			for _, f := range files {
				ext := strings.ToLower(filepath.Ext(f.Name))
				base := strings.ToLower(strings.TrimSuffix(f.Name, ext))
				if !pairedBases[base] {
					filtered = append(filtered, f)
				}
			}
			finalFiles = filtered
		}
	}

	// Add preview URLs for frontend
	for i := range finalFiles {
		if finalFiles[i].TelegramMsgID > 0 {
			url := "/api/drive/files/" + finalFiles[i].ID + "/stream"
			finalFiles[i].PreviewURL = &url
			finalFiles[i].ThumbnailURL = &url
		}
	}

	c.JSON(http.StatusOK, finalFiles)
}

func (h *Handler) GetStorageMetrics(c *gin.Context) {
	userID := middleware.GetUserID(c)
	var files []database.File
	h.db.Where("userId = ?", userID).Find(&files)

	var totalBytes int64
	var trashCount int64
	imagesCount := int64(0)
	videosCount := int64(0)
	documentsCount := int64(0)
	audioCount := int64(0)
	archivesCount := int64(0)
	starredCount := int64(0)

	images := make(map[string]bool)
	videos := make(map[string]bool)

	for _, f := range files {
		if f.IsTrashed {
			trashCount++
			continue
		}
		totalBytes += f.Size
		if f.Starred {
			starredCount++
		}
		switch f.Type {
		case "image":
			imagesCount++
		case "video":
			videosCount++
		case "document":
			documentsCount++
		case "audio":
			audioCount++
		case "archive":
			archivesCount++
		}

		ext := strings.ToLower(filepath.Ext(f.Name))
		base := strings.ToLower(strings.TrimSuffix(f.Name, ext))
		if ext == ".heic" || ext == ".jpg" || ext == ".jpeg" || ext == ".png" || strings.HasPrefix(f.MimeType, "image/") {
			images[base] = true
		}
		if ext == ".mov" || ext == ".mp4" || strings.HasPrefix(f.MimeType, "video/") {
			videos[base] = true
		}
	}

	livePhotosCount := 0
	for b := range images {
		if videos[b] {
			livePhotosCount++
		}
	}

	nonLiveFiles := int64(len(files)) - trashCount - int64(livePhotosCount)
	if nonLiveFiles < 0 {
		nonLiveFiles = 0
	}

	metrics := database.StorageMetrics{
		TotalFiles:      nonLiveFiles,
		TotalBytes:      totalBytes,
		TrashCount:      trashCount,
		LivePhotosCount: livePhotosCount,
		Quota:           "UNLIMITED",
		IsUnlimited:     true,
		Provider:        "Telegram MTProto Cloud",
		Categories: map[string]int64{
			"images":     imagesCount,
			"videos":     videosCount,
			"documents":  documentsCount,
			"audio":      audioCount,
			"archives":   archivesCount,
			"starred":    starredCount,
			"trash":      trashCount,
			"live_photo": int64(livePhotosCount),
		},
	}

	c.JSON(http.StatusOK, metrics)
}

// Upload (Disk-spooled zero RAM buffering)
func (h *Handler) UploadFile(c *gin.Context) {
	fileHeader, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "No file provided"})
		return
	}

	folderID := c.PostForm("folderId")
	var targetFolderID *string
	if folderID != "" && folderID != "root" && folderID != "null" {
		targetFolderID = &folderID
	}

	userID := middleware.GetUserID(c)
	phone := middleware.GetUserPhone(c)

	// Spool incoming file to disk temporary directory
	spoolDir := filepath.Join(os.TempDir(), "freebox-spool")
	os.MkdirAll(spoolDir, 0755)

	tempFile := filepath.Join(spoolDir, fmt.Sprintf("%d_%s", time.Now().UnixNano(), fileHeader.Filename))
	if err := c.SaveUploadedFile(fileHeader, tempFile); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to spool file to disk"})
		return
	}
	defer os.Remove(tempFile) // Always cleanup

	spoolHash := generateSpoolHash(fileHeader.Filename)
	fileType := detectType(fileHeader.Filename, fileHeader.Header.Get("Content-Type"))

	uploadedMsg, err := h.tgPool.UploadFile(
		c.Request.Context(),
		phone,
		tempFile,
		fileHeader.Filename,
		fileHeader.Header.Get("Content-Type"),
		fileHeader.Size,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}

	fileRecord := database.File{
		ID:              uuid.New().String(),
		Name:            fileHeader.Filename,
		SpoolHash:       spoolHash,
		Size:            fileHeader.Size,
		MimeType:        fileHeader.Header.Get("Content-Type"),
		Type:            fileType,
		FolderID:        targetFolderID,
		UserID:          &userID,
		TelegramMsgID:   uploadedMsg.MsgID,
		TelegramStatus:  "read",
		StorageProvider: "telegram",
		CreatedAt:       database.FlexibleTime(time.Now()),
		UpdatedAt:       database.FlexibleTime(time.Now()),
	}

	if err := h.db.Create(&fileRecord).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to save file to database"})
		return
	}

	streamURL := "/api/drive/files/" + fileRecord.ID + "/stream"
	fileRecord.PreviewURL = &streamURL
	fileRecord.ThumbnailURL = &streamURL

	c.JSON(http.StatusOK, fileRecord)
}

func (h *Handler) StreamFile(c *gin.Context) {
	id := c.Param("id")
	userID := middleware.GetUserID(c)
	phone := middleware.GetUserPhone(c)

	var file database.File
	if err := h.db.Where("id = ? AND userId = ?", id, userID).First(&file).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"message": "File not found"})
		return
	}

	h.tgPool.StreamFile(
		c.Request.Context(),
		phone,
		file.TelegramMsgID,
		c.Writer,
		c.Request,
		file.Name,
		file.MimeType,
		false,
		false,
		file.Size,
		"",
	)
}

func (h *Handler) DownloadFile(c *gin.Context) {
	id := c.Param("id")
	userID := middleware.GetUserID(c)
	phone := middleware.GetUserPhone(c)

	var file database.File
	if err := h.db.Where("id = ? AND userId = ?", id, userID).First(&file).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"message": "File not found"})
		return
	}

	h.tgPool.StreamFile(
		c.Request.Context(),
		phone,
		file.TelegramMsgID,
		c.Writer,
		c.Request,
		file.Name,
		file.MimeType,
		true,
		false,
		file.Size,
		"",
	)
}

func (h *Handler) DownloadBatch(c *gin.Context) {
	idsParam := c.Query("ids")
	ids := strings.Split(idsParam, ",")
	if len(ids) == 0 || idsParam == "" {
		c.JSON(http.StatusBadRequest, gin.H{"message": "No file IDs specified"})
		return
	}

	userID := middleware.GetUserID(c)
	var files []database.File
	h.db.Where("id IN ? AND userId = ? AND isTrashed = ?", ids, userID, false).Find(&files)
	if len(files) == 0 {
		c.JSON(http.StatusNotFound, gin.H{"message": "No valid files found"})
		return
	}

	zipFilename := fmt.Sprintf("FreeBox_Batch_%s.zip", time.Now().Format("2006-01-02"))
	c.Header("Content-Type", "application/zip")
	c.Header("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, zipFilename))

	zipWriter := zip.NewWriter(c.Writer)
	defer zipWriter.Close()

	phone := middleware.GetUserPhone(c)
	for _, file := range files {
		writer, err := zipWriter.Create(file.Name)
		if err != nil {
			continue
		}
		// Stream media pipe
		h.tgPool.DownloadMediaPipe(c.Request.Context(), phone, file.TelegramMsgID, writer)
	}
}

func (h *Handler) GetPublicShareInfo(c *gin.Context) {
	spoolHash := c.Param("spoolHash")
	var file database.File
	if err := h.db.Where("spoolHash = ?", spoolHash).First(&file).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"message": "Shared file not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"id":          file.ID,
		"name":        file.Name,
		"size":        file.Size,
		"mimeType":    file.MimeType,
		"type":        file.Type,
		"spoolHash":   file.SpoolHash,
		"createdAt":   file.CreatedAt,
		"streamUrl":   "/api/drive/public/stream/" + file.SpoolHash,
		"downloadUrl": "/api/drive/public/download/" + file.SpoolHash,
	})
}

func (h *Handler) StreamPublicFile(c *gin.Context) {
	spoolHash := c.Param("spoolHash")
	var file database.File
	if err := h.db.Where("spoolHash = ?", spoolHash).First(&file).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"message": "Shared file not found"})
		return
	}

	h.tgPool.StreamFile(
		c.Request.Context(),
		"",
		file.TelegramMsgID,
		c.Writer,
		c.Request,
		file.Name,
		file.MimeType,
		false,
		true,
		file.Size,
		"",
	)
}

func (h *Handler) DownloadPublicFile(c *gin.Context) {
	spoolHash := c.Param("spoolHash")
	var file database.File
	if err := h.db.Where("spoolHash = ?", spoolHash).First(&file).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"message": "Shared file not found"})
		return
	}

	h.tgPool.StreamFile(
		c.Request.Context(),
		"",
		file.TelegramMsgID,
		c.Writer,
		c.Request,
		file.Name,
		file.MimeType,
		true,
		true,
		file.Size,
		"",
	)
}

func (h *Handler) MoveFile(c *gin.Context) {
	id := c.Param("id")
	userID := middleware.GetUserID(c)
	var body struct {
		FolderID *string `json:"folderId"`
	}
	c.ShouldBindJSON(&body)

	var targetFolderID *string
	if body.FolderID != nil && *body.FolderID != "root" && *body.FolderID != "null" && *body.FolderID != "" {
		targetFolderID = body.FolderID
	}

	h.db.Model(&database.File{}).Where("id = ? AND userId = ?", id, userID).Update("folderId", targetFolderID)
	c.JSON(http.StatusOK, gin.H{"success": true})
}

func (h *Handler) MoveFiles(c *gin.Context) {
	userID := middleware.GetUserID(c)
	var body struct {
		IDs      []string `json:"ids"`
		FolderID *string  `json:"folderId"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid request body"})
		return
	}

	var targetFolderID *string
	if body.FolderID != nil && *body.FolderID != "root" && *body.FolderID != "null" && *body.FolderID != "" {
		targetFolderID = body.FolderID
	}

	h.db.Model(&database.File{}).Where("id IN ? AND userId = ?", body.IDs, userID).Update("folderId", targetFolderID)
	c.JSON(http.StatusOK, gin.H{"success": true})
}

func (h *Handler) ToggleStar(c *gin.Context) {
	id := c.Param("id")
	userID := middleware.GetUserID(c)
	var file database.File
	if err := h.db.Where("id = ? AND userId = ?", id, userID).First(&file).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"message": "File not found"})
		return
	}

	file.Starred = !file.Starred
	h.db.Save(&file)
	c.JSON(http.StatusOK, file)
}

func (h *Handler) EmptyTrash(c *gin.Context) {
	userID := middleware.GetUserID(c)
	phone := middleware.GetUserPhone(c)
	var files []database.File
	h.db.Where("isTrashed = ? AND userId = ?", true, userID).Find(&files)

	var msgIDs []int
	for _, f := range files {
		if f.TelegramMsgID > 0 {
			msgIDs = append(msgIDs, f.TelegramMsgID)
		}
	}

	if phone != "" && len(msgIDs) > 0 {
		h.tgPool.DeleteMessages(c.Request.Context(), phone, msgIDs)
	}

	h.db.Where("isTrashed = ? AND userId = ?", true, userID).Delete(&database.File{})
	c.JSON(http.StatusOK, gin.H{"success": true})
}

func (h *Handler) RestoreBatch(c *gin.Context) {
	userID := middleware.GetUserID(c)
	var body struct {
		IDs []string `json:"ids"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid request body"})
		return
	}

	h.db.Model(&database.File{}).Where("id IN ? AND userId = ?", body.IDs, userID).Update("isTrashed", false)
	c.JSON(http.StatusOK, gin.H{"success": true})
}

func (h *Handler) DeleteBatchPermanent(c *gin.Context) {
	userID := middleware.GetUserID(c)
	var body struct {
		IDs []string `json:"ids"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid request body"})
		return
	}

	phone := middleware.GetUserPhone(c)
	var files []database.File
	h.db.Where("id IN ? AND userId = ?", body.IDs, userID).Find(&files)

	var msgIDs []int
	for _, f := range files {
		if f.TelegramMsgID > 0 {
			msgIDs = append(msgIDs, f.TelegramMsgID)
		}
	}

	if phone != "" && len(msgIDs) > 0 {
		h.tgPool.DeleteMessages(c.Request.Context(), phone, msgIDs)
	}

	h.db.Where("id IN ? AND userId = ?", body.IDs, userID).Delete(&database.File{})
	c.JSON(http.StatusOK, gin.H{"success": true})
}

func (h *Handler) DeleteFile(c *gin.Context) {
	id := c.Param("id")
	permanent := c.Query("permanent") == "true"
	userID := middleware.GetUserID(c)
	phone := middleware.GetUserPhone(c)

	var file database.File
	if err := h.db.Where("id = ? AND userId = ?", id, userID).First(&file).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"message": "File not found"})
		return
	}

	if permanent {
		if phone != "" && file.TelegramMsgID > 0 {
			h.tgPool.DeleteMessage(c.Request.Context(), phone, file.TelegramMsgID)
		}
		h.db.Delete(&file)
	} else {
		file.IsTrashed = true
		h.db.Save(&file)
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

func (h *Handler) RestoreFile(c *gin.Context) {
	id := c.Param("id")
	userID := middleware.GetUserID(c)
	var file database.File
	if err := h.db.Where("id = ? AND userId = ?", id, userID).First(&file).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"message": "File not found"})
		return
	}

	file.IsTrashed = false
	h.db.Save(&file)
	c.JSON(http.StatusOK, file)
}

func generateSpoolHash(originalName string) string {
	ext := filepath.Ext(originalName)
	if ext != "" {
		ext = ext[1:]
	} else {
		ext = "bin"
	}

	randBytes := make([]byte, 8)
	io.ReadFull(rand.Reader, randBytes)
	randHex := hex.EncodeToString(randBytes)

	u := strings.ReplaceAll(uuid.New().String(), "-", "")
	return fmt.Sprintf("spool_%s...%s_%s.%s", u[:7], u[7:11], randHex, ext)
}

func detectType(name, mime string) string {
	ext := strings.ToLower(filepath.Ext(name))
	if ext != "" {
		ext = ext[1:]
	}

	switch ext {
	case "jpg", "jpeg", "png", "gif", "webp", "heic", "svg":
		return "image"
	case "mp4", "mkv", "mov", "webm", "avi":
		return "video"
	case "pdf", "doc", "docx", "xls", "xlsx", "ppt", "txt":
		return "document"
	case "mp3", "wav", "ogg", "flac", "m4a":
		return "audio"
	case "zip", "tar", "gz", "rar", "7z":
		return "archive"
	}

	if strings.HasPrefix(mime, "image/") {
		return "image"
	}
	if strings.HasPrefix(mime, "video/") {
		return "video"
	}
	if strings.HasPrefix(mime, "audio/") {
		return "audio"
	}

	return "document"
}
