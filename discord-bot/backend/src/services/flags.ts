const FEATURE_FLAGS_CACHE: Record<string, boolean> = {
  ENABLE_AI: true,
  ENABLE_VOICE_XP: true,
  ENABLE_BETA_PLUGINS: true,
  ENABLE_NEW_TICKETS: true,
  ENABLE_HIGH_CONCURRENCY_WORKERS: true,
};

export class FeatureFlagEvaluator {
  public static isEnabled(flagKey: string): boolean {
    if (flagKey in FEATURE_FLAGS_CACHE) {
      return FEATURE_FLAGS_CACHE[flagKey];
    }
    return true; // Default fallback
  }

  public static setFlag(flagKey: string, enabled: boolean): void {
    FEATURE_FLAGS_CACHE[flagKey] = enabled;
    console.log(`[FeatureFlag] Flag "${flagKey}" dynamically set to: ${enabled}`);
  }

  public static getAllFlags(): Record<string, boolean> {
    return { ...FEATURE_FLAGS_CACHE };
  }
}
