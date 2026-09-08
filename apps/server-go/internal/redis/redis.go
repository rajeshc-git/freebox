package redis

import (
	"context"
	"fmt"
	"log"
	"time"

	redisClient "github.com/redis/go-redis/v9"
)

type Client struct {
	rdb *redisClient.Client
}

func New(host, port string) *Client {
	addr := fmt.Sprintf("%s:%s", host, port)
	rdb := redisClient.NewClient(&redisClient.Options{
		Addr: addr,
	})

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := rdb.Ping(ctx).Err(); err != nil {
		log.Printf("Warning: Redis connection ping failed to %s: %v", addr, err)
	} else {
		log.Printf("Connected to Redis at %s", addr)
	}

	return &Client{rdb: rdb}
}

func (c *Client) Get(ctx context.Context, key string) (string, error) {
	return c.rdb.Get(ctx, key).Result()
}

func (c *Client) Set(ctx context.Context, key string, value interface{}, expiration time.Duration) error {
	return c.rdb.Set(ctx, key, value, expiration).Err()
}

func (c *Client) Del(ctx context.Context, keys ...string) error {
	return c.rdb.Del(ctx, keys...).Err()
}
