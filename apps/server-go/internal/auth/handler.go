package auth

import (
	"net/http"
	"strings"
	"time"

	"freebox-server-go/internal/database"
	"freebox-server-go/internal/middleware"
	"freebox-server-go/internal/redis"
	"freebox-server-go/internal/telegram"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Handler struct {
	db        *gorm.DB
	redis     *redis.Client
	tgPool    *telegram.ClientPool
	jwtSecret string
}

func NewHandler(db *gorm.DB, redis *redis.Client, tgPool *telegram.ClientPool, jwtSecret string) *Handler {
	return &Handler{
		db:        db,
		redis:     redis,
		tgPool:    tgPool,
		jwtSecret: jwtSecret,
	}
}

type SendCodeReq struct {
	Phone       string `json:"phone"`
	PhoneNumber string `json:"phoneNumber"`
}

type VerifyCodeReq struct {
	Phone       string `json:"phone"`
	PhoneNumber string `json:"phoneNumber"`
	Code        string `json:"code" binding:"required"`
	Password    string `json:"password,omitempty"`
}

func (h *Handler) SendCode(c *gin.Context) {
	var req SendCodeReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Please enter a valid phone number"})
		return
	}

	rawPhone := req.Phone
	if rawPhone == "" {
		rawPhone = req.PhoneNumber
	}

	cleanPhone := cleanPhoneNumber(rawPhone)
	if len(cleanPhone) < 7 {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Please enter a valid phone number with country code"})
		return
	}

	phoneCodeHash, err := h.tgPool.SendCode(c.Request.Context(), cleanPhone)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":       true,
		"phone":         cleanPhone,
		"phoneCodeHash": phoneCodeHash,
	})
}

func (h *Handler) VerifyCode(c *gin.Context) {
	var req VerifyCodeReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Verification code is required"})
		return
	}

	rawPhone := req.Phone
	if rawPhone == "" {
		rawPhone = req.PhoneNumber
	}
	cleanPhone := cleanPhoneNumber(rawPhone)
	cleanCode := strings.TrimSpace(req.Code)

	res, err := h.tgPool.VerifyCode(c.Request.Context(), cleanPhone, cleanCode, req.Password)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
		return
	}

	if res.RequiresPassword {
		c.JSON(http.StatusOK, gin.H{
			"token":            "",
			"user":             nil,
			"requiresPassword": true,
		})
		return
	}

	// Upsert User into Database
	var user database.User
	err = h.db.Where("phone = ?", cleanPhone).First(&user).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			user = database.User{
				ID:        uuid.New().String(),
				Phone:     cleanPhone,
				Name:      res.Name,
				Avatar:    res.Avatar,
				CreatedAt: database.FlexibleTime(time.Now()),
				UpdatedAt: database.FlexibleTime(time.Now()),
			}
			if err := h.db.Create(&user).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to create user"})
				return
			}
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "Database query error"})
			return
		}
	} else {
		user.Name = res.Name
		user.Avatar = res.Avatar
		user.UpdatedAt = database.FlexibleTime(time.Now())
		h.db.Save(&user)
	}

	// Create JWT token
	claims := middleware.Claims{
		Sub:   user.ID,
		Phone: user.Phone,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(30 * 24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString([]byte(h.jwtSecret))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to generate token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"token": tokenString,
		"user":  user,
	})
}

func (h *Handler) GetMe(c *gin.Context) {
	userId := middleware.GetUserID(c)
	if userId == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"message": "Unauthorized"})
		return
	}

	var user database.User
	if err := h.db.Where("id = ?", userId).First(&user).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"message": "User not found"})
		return
	}

	c.JSON(http.StatusOK, user)
}

func cleanPhoneNumber(phone string) string {
	var clean strings.Builder
	for _, ch := range phone {
		if ch >= '0' && ch <= '9' || ch == '+' {
			clean.WriteRune(ch)
		}
	}
	s := clean.String()
	if !strings.HasPrefix(s, "+") {
		s = "+" + s
	}
	return s
}
