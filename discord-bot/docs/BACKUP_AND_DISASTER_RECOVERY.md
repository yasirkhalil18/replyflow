# Backup & Disaster Recovery Guide

Procedures for automated PostgreSQL snapshots, Redis RDB/AOF persistence backups, and zero-downtime restoration.

---

## 🗄️ 1. PostgreSQL Database Backups

### Automated Daily Dump Script (`pg_dump`)
```bash
#!/bin/bash
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="/var/backups/discord_saas"
mkdir -p $BACKUP_DIR

docker exec -t discord_postgres pg_dump -U postgres -d discord_saas -F c -b -v -f "$BACKUP_DIR/db_backup_$TIMESTAMP.dump"

# Retain last 30 days
find $BACKUP_DIR -type f -mtime +30 -name "*.dump" -delete
```

### Database Restoration Procedure
```bash
docker exec -i discord_postgres pg_restore -U postgres -d discord_saas -v /var/backups/discord_saas/db_backup_20260805_120000.dump
```

---

## ⚡ 2. Redis RDB/AOF Snapshot Backups

Redis automatically creates append-only files (`appendonly.aof`) and RDB snapshots (`dump.rdb`).
To force an immediate manual snapshot:

```bash
docker exec -it discord_redis redis-cli BGSAVE
```

---

## 🚨 3. High-Availability & Failover Procedures

1. **Database Failover**: Promote standby PostgreSQL read-replica to primary using `repmgr` or Managed Cloud Database (AWS RDS / DigitalOcean Managed PostgreSQL).
2. **Redis Queue Failover**: Use Redis Sentinel or Redis Cluster mode for automatic master-replica failover without losing BullMQ queue jobs.
