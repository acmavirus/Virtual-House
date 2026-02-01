// Copyright by AcmaTvirus
import { ClusterManager } from 'discord-hybrid-sharding';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const manager = new ClusterManager(path.join(__dirname, __filename.endsWith('.ts') ? 'bot.ts' : 'bot.js'), {
    totalShards: 'auto', // Auto determine shard count
    shardsPerClusters: 2, // Shards per cluster
    totalClusters: 'auto',
    mode: 'worker', // Use worker threads for resource optimization
    token: process.env.DISCORD_TOKEN,
});

manager.on('clusterCreate', (cluster) => {
    console.log(`[Manager] Cluster ${cluster.id} has been initialized.`);
});

manager.spawn({ timeout: -1 }).catch((err) => {
    console.error('[Manager] Error starting Clusters:', err);
});
