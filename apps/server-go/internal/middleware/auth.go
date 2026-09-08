package middleware

import (
	"errors"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

type Claims struct {
	Sub   string `json:"sub"`
	Phone string `json:"phone"`
	jwt.RegisteredClaims
}

func AuthMiddleware(jwtSecret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		tokenStr := extractToken(c)
		if tokenStr == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"message": "Authentication required"})
			c.Abort()
			return
		}

		claims, err := parseToken(tokenStr, jwtSecret)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"message": "Invalid or expired token"})
			c.Abort()
			return
		}

		c.Set("userId", claims.Sub)
		c.Set("phone", claims.Phone)
		c.Next()
	}
}

func OptionalAuthMiddleware(jwtSecret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		tokenStr := extractToken(c)
		if tokenStr != "" {
			if claims, err := parseToken(tokenStr, jwtSecret); err == nil {
				c.Set("userId", claims.Sub)
				c.Set("phone", claims.Phone)
			}
		}
		c.Next()
	}
}

func extractToken(c *gin.Context) string {
	// Check Authorization header
	authHeader := c.GetHeader("Authorization")
	if strings.HasPrefix(authHeader, "Bearer ") {
		return strings.TrimPrefix(authHeader, "Bearer ")
	}

	// Check query param
	if tokenQuery := c.Query("token"); tokenQuery != "" {
		return tokenQuery
	}

	return ""
}

func parseToken(tokenStr, jwtSecret string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &Claims{}, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return []byte(jwtSecret), nil
	})

	if err != nil {
		return nil, err
	}

	if claims, ok := token.Claims.(*Claims); ok && token.Valid {
		return claims, nil
	}

	return nil, errors.New("invalid token")
}

func GetUserPhone(c *gin.Context) string {
	if phone, exists := c.Get("phone"); exists {
		if pStr, ok := phone.(string); ok {
			return pStr
		}
	}
	return ""
}

func GetUserID(c *gin.Context) string {
	if uid, exists := c.Get("userId"); exists {
		if uStr, ok := uid.(string); ok {
			return uStr
		}
	}
	return ""
}
