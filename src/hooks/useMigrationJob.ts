import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type MigrationJobStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

export interface MigrationJob {
  id: string;
  user_id: string;
  user_email: string | null;
  status: MigrationJobStatus;
  current_table: string | null;
  current_table_index: number | null;
  total_tables: number | null;
  processed_rows: number | null;
  total_rows: number | null;
  current_table_processed: number | null;
  current_table_total: number | null;
  progress_percent: number | null;
  tables_config: any;
  destination_config: any;
  failed_tables: any;
  completed_tables: any;
  error_message: string | null;
  cancel_requested: boolean | null;
  pause_requested: boolean | null;
  is_paused: boolean | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Subscribes to the currently active (pending or running) migration job globally.
 * Only ONE active job is allowed at a time (enforced by a partial unique index).
 */
export function useActiveMigrationJob() {
  const [job, setJob] = useState<MigrationJob | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchActive = async () => {
    const { data } = await supabase
      .from("migration_jobs")
      .select("*")
      .in("status", ["pending", "running"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setJob((data as MigrationJob | null) ?? null);
    setLoading(false);
  };

  useEffect(() => {
    fetchActive();

    const channel = supabase
      .channel("migration_jobs_active")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "migration_jobs" },
        () => {
          fetchActive();
        }
      )
      .subscribe();

    const pollInterval = window.setInterval(() => {
      fetchActive();
    }, 5000);

    return () => {
      window.clearInterval(pollInterval);
      supabase.removeChannel(channel);
    };
  }, []);

  return { job, loading, refresh: fetchActive };
}

/**
 * Helpers for the page that runs the migration.
 */
export const migrationJobApi = {
  async create(params: {
    destination_config: any;
    tables_config: any;
    total_tables: number;
    total_rows: number;
  }): Promise<MigrationJob> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const { data, error } = await supabase
      .from("migration_jobs")
      .insert({
        user_id: user.id,
        user_email: user.email,
        status: "running",
        started_at: new Date().toISOString(),
        destination_config: params.destination_config,
        tables_config: params.tables_config,
        total_tables: params.total_tables,
        total_rows: params.total_rows,
        progress_percent: 0,
      })
      .select("*")
      .single();

    if (error) throw error;
    return data as MigrationJob;
  },

  async update(id: string, patch: Partial<MigrationJob>) {
    await supabase.from("migration_jobs").update(patch).eq("id", id);
  },

  async complete(id: string, opts: { failed_tables?: any[]; error_message?: string | null } = {}) {
    const hasErrors = opts.failed_tables && opts.failed_tables.length > 0;
    await supabase
      .from("migration_jobs")
      .update({
        status: hasErrors ? "failed" : "completed",
        completed_at: new Date().toISOString(),
        progress_percent: 100,
        failed_tables: opts.failed_tables ?? [],
        error_message: opts.error_message ?? null,
      })
      .eq("id", id);
  },

  async fail(id: string, error_message: string) {
    await supabase
      .from("migration_jobs")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error_message,
      })
      .eq("id", id);
  },

  async cancel(id: string) {
    await supabase
      .from("migration_jobs")
      .update({ cancel_requested: true } as any)
      .eq("id", id);
  },

  async pause(id: string) {
    await supabase
      .from("migration_jobs")
      .update({ pause_requested: true, is_paused: true } as any)
      .eq("id", id);
  },

  async resume(id: string) {
    await supabase
      .from("migration_jobs")
      .update({ pause_requested: false, is_paused: false } as any)
      .eq("id", id);
  },

  async checkCancelRequested(id: string): Promise<boolean> {
    const { data } = await supabase
      .from("migration_jobs")
      .select("cancel_requested")
      .eq("id", id)
      .maybeSingle();
    return Boolean((data as any)?.cancel_requested);
  },

  async checkPauseRequested(id: string): Promise<boolean> {
    const { data } = await supabase
      .from("migration_jobs")
      .select("pause_requested")
      .eq("id", id)
      .maybeSingle();
    return Boolean((data as any)?.pause_requested);
  },

  async findActive(): Promise<MigrationJob | null> {
    const { data } = await supabase
      .from("migration_jobs")
      .select("*")
      .in("status", ["pending", "running"])
      .limit(1)
      .maybeSingle();
    return (data as MigrationJob | null) ?? null;
  },
};
