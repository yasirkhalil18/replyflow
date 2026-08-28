export interface PluginManifest {
  key: string;
  name: string;
  version: string;
  description: string;
  author: string;
  category: 'Engagement' | 'Moderation' | 'Utility' | 'AI & Feeds' | 'Custom';
  icon: string;
  permissions: string[];
}

export interface PluginContext {
  guildId: string;
  config: Record<string, any>;
  logger: {
    info: (msg: string) => void;
    warn: (msg: string) => void;
    error: (msg: string) => void;
  };
  emitWebSocket: (event: string, data: any) => void;
}

export abstract class DiscordPlugin {
  public abstract manifest: PluginManifest;

  public async onLoad(ctx: PluginContext): Promise<void> {
    ctx.logger.info(`Plugin [${this.manifest.name}] loaded.`);
  }

  public async onEnable(ctx: PluginContext): Promise<void> {
    ctx.logger.info(`Plugin [${this.manifest.name}] enabled.`);
  }

  public async onDisable(ctx: PluginContext): Promise<void> {
    ctx.logger.info(`Plugin [${this.manifest.name}] disabled.`);
  }

  public registerSlashCommands?(): Array<{ name: string; description: string; options?: any[] }>;
  
  public onEvent?(eventName: string, payload: any, ctx: PluginContext): Promise<void>;
}
