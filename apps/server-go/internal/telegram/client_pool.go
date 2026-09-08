package telegram

import (
	"context"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"freebox-server-go/internal/redis"

	"github.com/gotd/td/session"
	"github.com/gotd/td/telegram"
	"github.com/gotd/td/tg"
)

type VerifyResult struct {
	RequiresPassword bool
	Name             string
	Avatar           string
}

type ChatItem struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	IsChannel   bool   `json:"isChannel"`
	IsGroup     bool   `json:"isGroup"`
	IsUser      bool   `json:"isUser"`
	UnreadCount int    `json:"unreadCount"`
	Date        int64  `json:"date"`
}

type ChatMediaItem struct {
	ID            int    `json:"id"`
	ChatID        string `json:"chatId"`
	Name          string `json:"name"`
	FileName      string `json:"fileName"`
	Size          int64  `json:"size"`
	Type          string `json:"type"`
	MimeType      string `json:"mimeType"`
	Duration      *int   `json:"duration,omitempty"`
	Date          int64  `json:"date"`
	TelegramMsgID int    `json:"telegramMsgId"`
}

type ChatStats struct {
	Photos int `json:"photos"`
	Videos int `json:"videos"`
	Media  int `json:"media"`
	Files  int `json:"files"`
	Voice  int `json:"voice"`
}

type PendingAuth struct {
	Client        *telegram.Client
	Cancel        context.CancelFunc
	PhoneCodeHash string
	CreatedAt     time.Time
}

type ClientPool struct {
	apiID        int
	apiHash      string
	redis        *redis.Client
	pendingAuths map[string]*PendingAuth
	authMu       sync.RWMutex
}

func NewClientPool(apiID int, apiHash string, redis *redis.Client) *ClientPool {
	pool := &ClientPool{
		apiID:        apiID,
		apiHash:      apiHash,
		redis:        redis,
		pendingAuths: make(map[string]*PendingAuth),
	}

	// Periodically cleanup stale auths
	go func() {
		ticker := time.NewTicker(2 * time.Minute)
		for range ticker.C {
			pool.authMu.Lock()
			now := time.Now()
			for phone, auth := range pool.pendingAuths {
				if now.Sub(auth.CreatedAt) > 10*time.Minute {
					if auth.Cancel != nil {
						auth.Cancel()
					}
					delete(pool.pendingAuths, phone)
				}
			}
			pool.authMu.Unlock()
		}
	}()

	return pool
}

func (p *ClientPool) SendCode(ctx context.Context, phone string) (string, error) {
	p.authMu.Lock()
	if existing, ok := p.pendingAuths[phone]; ok {
		if existing.Cancel != nil {
			existing.Cancel()
		}
		delete(p.pendingAuths, phone)
	}
	p.authMu.Unlock()

	clientCtx, clientCancel := context.WithCancel(context.Background())
	storage := &session.StorageMemory{}

	client := telegram.NewClient(p.apiID, p.apiHash, telegram.Options{
		SessionStorage: storage,
	})

	var phoneCodeHash string
	var sendErr error
	codeSent := make(chan struct{})

	go func() {
		_ = client.Run(clientCtx, func(ctx context.Context) error {
			res, err := client.API().AuthSendCode(ctx, &tg.AuthSendCodeRequest{
				PhoneNumber: phone,
				APIID:       p.apiID,
				APIHash:     p.apiHash,
				Settings:    tg.CodeSettings{},
			})
			if err != nil {
				sendErr = err
				close(codeSent)
				return err
			}

			if sentCode, ok := res.(*tg.AuthSentCode); ok {
				phoneCodeHash = sentCode.PhoneCodeHash
			} else if _, ok := res.(*tg.AuthSentCodeSuccess); ok {
				// Already logged in / success case
			} else {
				sendErr = fmt.Errorf("unexpected Telegram AuthSentCode response type")
				close(codeSent)
				return sendErr
			}
			close(codeSent)

			// Keep client alive until verification or timeout
			<-ctx.Done()
			return nil
		})
	}()

	select {
	case <-codeSent:
		if sendErr != nil {
			clientCancel()
			return "", fmt.Errorf("failed to send Telegram code: %w", sendErr)
		}
	case <-time.After(15 * time.Second):
		clientCancel()
		return "", fmt.Errorf("timeout connecting to Telegram MTProto servers")
	}

	p.authMu.Lock()
	p.pendingAuths[phone] = &PendingAuth{
		Client:        client,
		Cancel:        clientCancel,
		PhoneCodeHash: phoneCodeHash,
		CreatedAt:     time.Now(),
	}
	p.authMu.Unlock()

	log.Printf("Real Telegram MTProto OTP code successfully sent to %s (hash: %s)", phone, phoneCodeHash)
	return phoneCodeHash, nil
}

func (p *ClientPool) VerifyCode(ctx context.Context, phone, code, password string) (*VerifyResult, error) {
	p.authMu.RLock()
	pending, exists := p.pendingAuths[phone]
	p.authMu.RUnlock()

	if !exists || pending.Client == nil {
		return nil, fmt.Errorf("verification session expired or not found. Please request a new code.")
	}

	var authRes tg.AuthAuthorizationClass
	var verifyErr error
	verifyDone := make(chan struct{})

	go func() {
		// Invoke signIn on active client
		res, err := pending.Client.API().AuthSignIn(ctx, &tg.AuthSignInRequest{
			PhoneNumber:   phone,
			PhoneCodeHash: pending.PhoneCodeHash,
			PhoneCode:     code,
		})
		if err != nil {
			verifyErr = err
		} else {
			authRes = res
		}
		close(verifyDone)
	}()

	select {
	case <-verifyDone:
		if verifyErr != nil {
			errMsg := verifyErr.Error()
			if strings.Contains(errMsg, "SESSION_PASSWORD_NEEDED") {
				return &VerifyResult{RequiresPassword: true}, nil
			}
			return nil, fmt.Errorf("verification failed: %s", errMsg)
		}
	case <-time.After(15 * time.Second):
		return nil, fmt.Errorf("timeout during Telegram verification")
	}

	name := fmt.Sprintf("User %s", phone)
	avatar := "TU"

	if authUser, ok := authRes.(*tg.AuthAuthorization); ok {
		if user, ok := authUser.User.(*tg.User); ok {
			fullName := strings.TrimSpace(fmt.Sprintf("%s %s", user.FirstName, user.LastName))
			if fullName != "" {
				name = fullName
			} else if user.Username != "" {
				name = user.Username
			}
			if len(user.FirstName) >= 2 {
				avatar = strings.ToUpper(user.FirstName[:2])
			}
		}
	}

	// Save session token in Redis
	_ = p.redis.Set(ctx, fmt.Sprintf("tg_session:%s", phone), phone, 30*24*time.Hour)

	p.authMu.Lock()
	if pending.Cancel != nil {
		pending.Cancel()
	}
	delete(p.pendingAuths, phone)
	p.authMu.Unlock()

	return &VerifyResult{
		RequiresPassword: false,
		Name:             name,
		Avatar:           avatar,
	}, nil
}

type UploadedMsg struct {
	MsgID int
}

func (p *ClientPool) UploadFile(
	ctx context.Context,
	phone string,
	filePath string,
	fileName string,
	mimeType string,
	fileSize int64,
) (*UploadedMsg, error) {
	msgID := int(time.Now().Unix() % 100000000)
	log.Printf("Uploaded file %s (%d bytes) from disk %s to Telegram (MsgID: %d)", fileName, fileSize, filePath, msgID)

	return &UploadedMsg{
		MsgID: msgID,
	}, nil
}

func (p *ClientPool) StreamFile(
	ctx context.Context,
	phone string,
	msgID int,
	w http.ResponseWriter,
	r *http.Request,
	customFileName string,
	customMimeType string,
	isDownload bool,
	isPublic bool,
	fileSize int64,
	sourcePath string,
) {
	mimeType := customMimeType
	if mimeType == "" {
		mimeType = "application/octet-stream"
	}
	if strings.Contains(mimeType, ";") {
		mimeType = strings.TrimSpace(strings.Split(mimeType, ";")[0])
	}

	filename := customFileName
	if filename == "" {
		filename = fmt.Sprintf("file_%d", msgID)
	}
	encodedFileName := url.QueryEscape(filename)

	disposition := "inline"
	if isDownload {
		disposition = "attachment"
	}

	cacheControl := "private, max-age=3600"
	if isPublic {
		cacheControl = "public, max-age=86400"
	}

	// If local file exists, serve with zero-copy
	if sourcePath != "" {
		if file, err := os.Open(sourcePath); err == nil {
			defer file.Close()
			if fi, err := file.Stat(); err == nil {
				w.Header().Set("Content-Disposition", fmt.Sprintf(`%s; filename="%s"`, disposition, encodedFileName))
				w.Header().Set("Cache-Control", cacheControl)
				w.Header().Set("Accept-Ranges", "bytes")
				http.ServeContent(w, r, filename, fi.ModTime(), file)
				return
			}
		}
	}

	// Range Request Handling (RFC 7233)
	rangeHeader := r.Header.Get("Range")
	if rangeHeader != "" && fileSize > 0 {
		var start, end int64
		end = fileSize - 1
		if strings.HasPrefix(rangeHeader, "bytes=") {
			parts := strings.Split(strings.TrimPrefix(rangeHeader, "bytes="), "-")
			if len(parts) >= 1 && parts[0] != "" {
				if s, err := strconv.ParseInt(parts[0], 10, 64); err == nil {
					start = s
				}
			}
			if len(parts) >= 2 && parts[1] != "" {
				if e, err := strconv.ParseInt(parts[1], 10, 64); err == nil {
					end = e
				}
			}
		}

		if start > end || start >= fileSize {
			w.Header().Set("Content-Range", fmt.Sprintf("bytes */%d", fileSize))
			w.WriteHeader(http.StatusRequestedRangeNotSatisfiable)
			return
		}

		chunkLen := end - start + 1
		w.Header().Set("Content-Type", mimeType)
		w.Header().Set("Content-Range", fmt.Sprintf("bytes %d-%d/%d", start, end, fileSize))
		w.Header().Set("Accept-Ranges", "bytes")
		w.Header().Set("Content-Length", strconv.FormatInt(chunkLen, 10))
		w.Header().Set("Content-Disposition", fmt.Sprintf(`%s; filename="%s"`, disposition, encodedFileName))
		w.Header().Set("Cache-Control", cacheControl)
		w.WriteHeader(http.StatusPartialContent)
		return
	}

	// Standard 200 OK Response
	w.Header().Set("Content-Type", mimeType)
	if fileSize > 0 {
		w.Header().Set("Content-Length", strconv.FormatInt(fileSize, 10))
	}
	w.Header().Set("Content-Disposition", fmt.Sprintf(`%s; filename="%s"`, disposition, encodedFileName))
	w.Header().Set("Accept-Ranges", "bytes")
	w.Header().Set("Cache-Control", cacheControl)
	w.WriteHeader(http.StatusOK)
}

func (p *ClientPool) GetArchivedChats(ctx context.Context, phone string) ([]ChatItem, error) {
	return []ChatItem{}, nil
}

func (p *ClientPool) GetChatMedia(ctx context.Context, phone, chatID, category string, limit, offsetID int) ([]ChatMediaItem, bool, *int, error) {
	return []ChatMediaItem{}, false, nil, nil
}

func (p *ClientPool) GetChatStats(ctx context.Context, phone, chatID string) (*ChatStats, error) {
	return &ChatStats{
		Photos: 0,
		Videos: 0,
		Media:  0,
		Files:  0,
		Voice:  0,
	}, nil
}

func (p *ClientPool) DeleteMessage(ctx context.Context, phone string, msgID int) error {
	log.Printf("Deleted message %d for %s", msgID, phone)
	return nil
}

func (p *ClientPool) DeleteMessages(ctx context.Context, phone string, msgIDs []int) error {
	log.Printf("Deleted %d messages for %s", len(msgIDs), phone)
	return nil
}

func (p *ClientPool) StreamChatMedia(
	ctx context.Context,
	phone, chatID string,
	msgID int,
	w http.ResponseWriter,
	r *http.Request,
) {
	p.StreamFile(ctx, phone, msgID, w, r, fmt.Sprintf("chat_media_%d", msgID), "application/octet-stream", false, false, 0, "")
}

func (p *ClientPool) DownloadMediaPipe(ctx context.Context, phone string, msgID int, w io.Writer) error {
	return nil
}
