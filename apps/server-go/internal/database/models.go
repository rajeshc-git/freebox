package database

import (
	"database/sql/driver"
	"encoding/json"
	"time"
)

type FlexibleTime time.Time

func (t *FlexibleTime) Scan(value interface{}) error {
	if value == nil {
		*t = FlexibleTime(time.Time{})
		return nil
	}
	switch v := value.(type) {
	case int64:
		if v > 100000000000 { // Milliseconds (Prisma default in SQLite)
			*t = FlexibleTime(time.UnixMilli(v))
		} else {
			*t = FlexibleTime(time.Unix(v, 0))
		}
		return nil
	case int:
		*t = FlexibleTime(time.Unix(int64(v), 0))
		return nil
	case float64:
		*t = FlexibleTime(time.UnixMilli(int64(v)))
		return nil
	case time.Time:
		*t = FlexibleTime(v)
		return nil
	case string:
		formats := []string{
			time.RFC3339,
			time.RFC3339Nano,
			"2006-01-02 15:04:05.999999999-07:00",
			"2006-01-02 15:04:05",
			"2006-01-02T15:04:05.000Z",
		}
		for _, f := range formats {
			if parsed, err := time.Parse(f, v); err == nil {
				*t = FlexibleTime(parsed)
				return nil
			}
		}
		*t = FlexibleTime(time.Time{})
		return nil
	case []byte:
		return t.Scan(string(v))
	}
	return nil
}

func (t FlexibleTime) Value() (driver.Value, error) {
	return time.Time(t), nil
}

func (t FlexibleTime) MarshalJSON() ([]byte, error) {
	return json.Marshal(time.Time(t).Format(time.RFC3339))
}

func (t *FlexibleTime) UnmarshalJSON(b []byte) error {
	var s string
	if err := json.Unmarshal(b, &s); err != nil {
		return err
	}
	parsed, err := time.Parse(time.RFC3339, s)
	if err != nil {
		return err
	}
	*t = FlexibleTime(parsed)
	return nil
}

func (t FlexibleTime) Time() time.Time {
	return time.Time(t)
}

func (t FlexibleTime) Format(layout string) string {
	return time.Time(t).Format(layout)
}

func (t FlexibleTime) IsZero() bool {
	return time.Time(t).IsZero()
}

type User struct {
	ID        string       `gorm:"column:id;primaryKey" json:"id"`
	Phone     string       `gorm:"column:phone;uniqueIndex" json:"phone"`
	Name      string       `gorm:"column:name;default:'Telegram User'" json:"name"`
	Avatar    string       `gorm:"column:avatar;default:'TU'" json:"avatar"`
	CreatedAt FlexibleTime `gorm:"column:createdAt" json:"createdAt"`
	UpdatedAt FlexibleTime `gorm:"column:updatedAt" json:"updatedAt"`

	Folders []Folder `gorm:"foreignKey:UserID" json:"folders,omitempty"`
	Files   []File   `gorm:"foreignKey:UserID" json:"files,omitempty"`
}

func (User) TableName() string {
	return "User"
}

type Folder struct {
	ID        string       `gorm:"column:id;primaryKey" json:"id"`
	Name      string       `gorm:"column:name" json:"name"`
	Color     string       `gorm:"column:color;default:'#3b82f6'" json:"color"`
	ParentID  *string      `gorm:"column:parentId" json:"parentId"`
	UserID    *string      `gorm:"column:userId" json:"userId"`
	CreatedAt FlexibleTime `gorm:"column:createdAt" json:"createdAt"`
	UpdatedAt FlexibleTime `gorm:"column:updatedAt" json:"updatedAt"`

	Children []Folder `gorm:"foreignKey:ParentID" json:"children,omitempty"`
	Files    []File   `gorm:"foreignKey:FolderID" json:"files,omitempty"`

	// Virtual count struct for frontend compatibility
	Count *FolderCount `gorm:"-" json:"_count,omitempty"`
}

type FolderCount struct {
	Files    int64 `json:"files"`
	Children int64 `json:"children"`
}

func (Folder) TableName() string {
	return "Folder"
}

type File struct {
	ID                 string       `gorm:"column:id;primaryKey" json:"id"`
	Name               string       `gorm:"column:name" json:"name"`
	SpoolHash          string       `gorm:"column:spoolHash;uniqueIndex" json:"spoolHash"`
	Size               int64        `gorm:"column:size" json:"size"`
	MimeType           string       `gorm:"column:mimeType" json:"mimeType"`
	Type               string       `gorm:"column:type" json:"type"`
	FolderID           *string      `gorm:"column:folderId" json:"folderId"`
	UserID             *string      `gorm:"column:userId" json:"userId"`
	TelegramMsgID      int          `gorm:"column:telegramMsgId;default:0" json:"telegramMsgId"`
	TelegramFileID     *string      `gorm:"column:telegramFileId" json:"telegramFileId"`
	TelegramAccessHash *string      `gorm:"column:telegramAccessHash" json:"telegramAccessHash"`
	TelegramStatus     string       `gorm:"column:telegramStatus;default:'read'" json:"telegramStatus"`
	Starred            bool         `gorm:"column:starred;default:false" json:"starred"`
	IsTrashed          bool         `gorm:"column:isTrashed;default:false" json:"isTrashed"`
	StorageProvider    string       `gorm:"column:storageProvider;default:'telegram'" json:"storageProvider"`
	PreviewURL         *string      `gorm:"column:previewUrl" json:"previewUrl"`
	ThumbnailURL       *string      `gorm:"column:thumbnailUrl" json:"thumbnailUrl"`
	CreatedAt          FlexibleTime `gorm:"column:createdAt" json:"createdAt"`
	UpdatedAt          FlexibleTime `gorm:"column:updatedAt" json:"updatedAt"`
}

func (File) TableName() string {
	return "File"
}

type StorageMetrics struct {
	TotalFiles       int64            `json:"totalFiles"`
	TotalBytes       int64            `json:"totalBytes"`
	TrashCount       int64            `json:"trashCount"`
	LivePhotosCount  int              `json:"livePhotosCount"`
	Quota            string           `json:"quota"`
	IsUnlimited      bool             `json:"isUnlimited"`
	Provider         string           `json:"provider"`
	Categories       map[string]int64 `json:"categories"`
}
