# Production Deployment & Shard Scaling Guide

Guide for deploying Discord Automation Cloud to production AWS / DigitalOcean servers with Docker Compose, Nginx SSL, PM2 cluster management, and ShardManager auto-scaling across 10,000+ guilds.

---

## 🐋 Production Deployment via Docker Compose

Run the entire multi-container stack in detached mode:

```bash
docker-compose up -d --build
```

### Containers Spawned:
- **`discord_postgres`**: PostgreSQL 16 DB (Port 5432)
- **`discord_redis`**: Redis 7 Cache & BullMQ Queue Server (Port 6379)
- **`discord_backend`**: Express REST API & Bot Cluster (Port 4000)
- **`discord_frontend`**: Next.js App Router Dashboard (Port 3000)
- **`discord_nginx`**: Nginx Reverse Proxy & SSL Termination (Ports 80/443)
- **`discord_prometheus`**: Telemetry Scraper (Port 9090)
- **`discord_grafana`**: Performance Dashboards (Port 3001)

---

## ⚡ Bot Shard Manager Auto-Scaling

Discord.js `ShardingManager` automatically calculates required shards based on guild count:

```typescript
// backend/src/bot/sharding.ts
const manager = new ShardingManager(path.join(__dirname, 'index.js'), {
  token: process.env.DISCORD_BOT_TOKEN,
  totalShards: 'auto', // Spawns 1 shard per 1,500 - 2,500 guilds automatically
});
```

To scale across multiple physical server instances, configure Redis Pub/Sub event dispatcher for cross-host RPC state synchronization.
