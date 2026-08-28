import { ShardingManager } from 'discord.js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const token = process.env.DISCORD_BOT_TOKEN;

if (!token) {
  console.log('[ShardingManager] DISCORD_BOT_TOKEN environment variable not set. Running cluster in Standby Mode.');
} else {
  const manager = new ShardingManager(path.join(__dirname, 'index.js'), {
    token: token,
    totalShards: 'auto',
  });

  manager.on('shardCreate', (shard) => {
    console.log(`[ShardingManager] Successfully spawned Shard #${shard.id}`);
  });

  manager.spawn().catch((err) => {
    console.error('[ShardingManager] Error spawning shards:', err);
  });
}
