import { supabase } from "@/integrations/supabase/client";

export interface SystemState {
  tableExists: boolean;
  usersCount: number;
  needsRestore: boolean;
  needsInitialUser: boolean;
}

export async function getSystemState(): Promise<SystemState> {
  // We avoid relying on backend functions here because some deployments may block /functions
  // while /rest remains accessible.
  let tableExists = false;
  let usersCount = 0;

  const { error, count } = await supabase
    .from("profiles")
    // Avoid HEAD requests (some proxies/extensions block them and cause "Failed to fetch")
    .select("id", { count: "exact" })
    .limit(1);

  if (error) {
    const msg = (error as any)?.message as string | undefined;
    const code = (error as any)?.code as string | undefined;

    // Postgres: undefined_table
    if (code === "42P01" || msg?.includes("does not exist")) {
      tableExists = false;
      usersCount = 0;
    } else {
      // Unknown error: rethrow so callers can decide (auth issues, network issues, etc.)
      throw error;
    }
  } else {
    tableExists = true;
    usersCount = count ?? 0;
  }

  return {
    tableExists,
    usersCount,
    needsRestore: !tableExists,
    needsInitialUser: tableExists && usersCount === 0,
  };
}
