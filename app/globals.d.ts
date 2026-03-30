// Global type augmentation for per-route cache registry
declare global {
  var __routeCaches: Map<string, Map<string, { data: unknown; expires: number }>> | undefined;
}

export {};
