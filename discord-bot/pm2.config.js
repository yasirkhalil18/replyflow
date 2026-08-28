module.exports = {
  apps: [
    {
      name: 'discord-saas-api',
      script: 'backend/dist/server.js',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 4000,
      },
    },
    {
      name: 'discord-bot-shard-manager',
      script: 'backend/dist/bot/sharding.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'discord-saas-frontend',
      script: 'node_modules/next/dist/bin/next',
      args: 'start frontend',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        PORT: 3000,
      },
    },
  ],
};
