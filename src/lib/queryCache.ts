import { supabase } from "@/integrations/supabase/client";

export interface CacheOptions {
  expiryHours?: number; // Default 24 hours
}

/**
 * Get cached data from query_cache table
 */
export async function getCachedData<T>(
  cacheKey: string
): Promise<T | null> {
  try {
    const { data, error } = await supabase
      .from("query_cache")
      .select("cache_data, expires_at")
      .eq("cache_key", cacheKey)
      .single();

    if (error || !data) return null;

    // Check if cache is expired
    if (new Date(data.expires_at) < new Date()) {
      // Delete expired cache
      await supabase.from("query_cache").delete().eq("cache_key", cacheKey);
      return null;
    }

    return data.cache_data as T;
  } catch (error) {
    console.error("Error reading cache:", error);
    return null;
  }
}

/**
 * Set cached data in query_cache table
 */
export async function setCachedData<T>(
  cacheKey: string,
  data: T,
  options: CacheOptions = {}
): Promise<void> {
  try {
    const expiryHours = options.expiryHours || 24;
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + expiryHours);

    await supabase
      .from("query_cache")
      .upsert({
        cache_key: cacheKey,
        cache_data: data as any,
        expires_at: expiresAt.toISOString(),
      });
  } catch (error) {
    console.error("Error writing cache:", error);
  }
}

/**
 * Invalidate cache by key pattern
 */
export async function invalidateCache(keyPattern?: string): Promise<void> {
  try {
    if (keyPattern) {
      await supabase
        .from("query_cache")
        .delete()
        .ilike("cache_key", `%${keyPattern}%`);
    } else {
      // Clear all cache
      await supabase.from("query_cache").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    }
  } catch (error) {
    console.error("Error invalidating cache:", error);
  }
}

/**
 * Clean expired cache entries
 */
export async function cleanExpiredCache(): Promise<void> {
  try {
    await supabase.rpc("clean_expired_cache");
  } catch (error) {
    console.error("Error cleaning expired cache:", error);
  }
}

/**
 * Generate cache key based on current date
 */
export function getDailyCacheKey(prefix: string): string {
  const today = new Date().toISOString().split("T")[0];
  return `${prefix}_${today}`;
}
