import { supabase } from "@/integrations/supabase/client";

export interface SystemState {
  tableExists: boolean;
  usersCount: number;
  needsRestore: boolean;
  needsInitialUser: boolean;
}

export async function getSystemState(): Promise<SystemState> {
  try {
    // Use the edge function which uses service role key to bypass RLS
    const { data, error } = await supabase.functions.invoke("check-system-state");

    if (error) {
      console.error("Error calling check-system-state:", error);
      // Fallback: assume system is working to avoid blocking login
      return {
        tableExists: true,
        usersCount: 1,
        needsRestore: false,
        needsInitialUser: false,
      };
    }

    return {
      tableExists: data.tableExists ?? true,
      usersCount: data.usersCount ?? 1,
      needsRestore: data.needsRestore ?? false,
      needsInitialUser: data.needsInitialUser ?? false,
    };
  } catch (err) {
    console.error("Error getting system state:", err);
    // Fallback: assume system is working to avoid blocking login
    return {
      tableExists: true,
      usersCount: 1,
      needsRestore: false,
      needsInitialUser: false,
    };
  }
}
