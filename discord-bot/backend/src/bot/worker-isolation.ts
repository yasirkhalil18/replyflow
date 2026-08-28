export interface PluginWorkerContext {
  pluginKey: string;
  guildId: string;
  eventName: string;
}

export class PluginWorkerBoundary {
  public static async runIsolated<T>(
    ctx: PluginWorkerContext,
    taskFn: () => Promise<T>
  ): Promise<{ success: boolean; result?: T; error?: string }> {
    try {
      const result = await taskFn();
      return { success: true, result };
    } catch (err: any) {
      const errorMsg = err.stack || err.message || 'Unknown plugin worker error';
      console.error(`💥 [PluginIsolation: ${ctx.pluginKey}] Crash caught on guild ${ctx.guildId} [Event: ${ctx.eventName}]:`, errorMsg);

      // Log plugin failure safely without bringing down sibling plugins or bot process
      return {
        success: false,
        error: errorMsg,
      };
    }
  }
}
