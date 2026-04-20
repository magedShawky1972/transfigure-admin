import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MigrationJob, migrationJobApi, useActiveMigrationJob } from "@/hooks/useMigrationJob";

const STALE_AFTER_MS = 120_000;
const CHECK_INTERVAL_MS = 15_000;
const LOCK_TTL_MS = 45_000;
const LOCK_KEY = "global-migration-recovery-lock";
const TAB_ID = crypto.randomUUID();

type ExternalConnection = {
  url: string;
  anon_key: string;
};

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> => {
  return await Promise.race([
    promise,
    new Promise<T>((_, reject) => window.setTimeout(() => reject(new Error(message)), timeoutMs)),
  ]);
};

const isStaleJob = (job: MigrationJob | null) => {
  if (!job || job.status !== "running") return false;
  const updatedAt = new Date(job.updated_at).getTime();
  if (Number.isNaN(updatedAt)) return false;
  return Date.now() - updatedAt > STALE_AFTER_MS;
};

const readLock = () => {
  try {
    const raw = window.localStorage.getItem(LOCK_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const writeLock = (jobId: string) => {
  window.localStorage.setItem(
    LOCK_KEY,
    JSON.stringify({ jobId, owner: TAB_ID, expiresAt: Date.now() + LOCK_TTL_MS })
  );
};

const clearLock = (jobId?: string) => {
  const current = readLock();
  if (!current) return;
  if (current.owner === TAB_ID && (!jobId || current.jobId === jobId)) {
    window.localStorage.removeItem(LOCK_KEY);
  }
};

const tryAcquireLock = (jobId: string) => {
  const current = readLock();
  if (current && current.jobId === jobId && current.owner !== TAB_ID && current.expiresAt > Date.now()) {
    return false;
  }

  writeLock(jobId);
  const confirmed = readLock();
  return confirmed?.jobId === jobId && confirmed?.owner === TAB_ID;
};

export function GlobalMigrationRecovery() {
  const { job } = useActiveMigrationJob();
  const runnerRef = useRef(false);
  const heartbeatRef = useRef<number | null>(null);
  const lastStartedJobRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (heartbeatRef.current) {
        window.clearInterval(heartbeatRef.current);
      }
      clearLock(lastStartedJobRef.current ?? undefined);
    };
  }, []);

  useEffect(() => {
    const startHeartbeat = (jobId: string) => {
      if (heartbeatRef.current) {
        window.clearInterval(heartbeatRef.current);
      }

      writeLock(jobId);
      heartbeatRef.current = window.setInterval(() => writeLock(jobId), LOCK_TTL_MS / 3);
    };

    const stopHeartbeat = (jobId?: string) => {
      if (heartbeatRef.current) {
        window.clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
      clearLock(jobId);
    };

    const invokeMigrationFunction = async (body: Record<string, any>, timeoutMs = 60_000) => {
      return await withTimeout(
        supabase.functions.invoke("migrate-to-external", { body }),
        timeoutMs,
        `migrate-to-external timeout: ${body.action || "unknown action"}`
      );
    };

    const callExternalProxy = async (
      connection: ExternalConnection,
      action: string,
      params: Record<string, any> = {},
      timeoutMs = 60_000
    ) => {
      const { data, error } = await withTimeout(
        supabase.functions.invoke("external-supabase-proxy", {
          body: {
            action,
            externalUrl: connection.url,
            externalAnonKey: connection.anon_key,
            ...params,
          },
        }),
        timeoutMs,
        `external-supabase-proxy timeout: ${action}`
      );

      if (error) throw error;
      return data;
    };

    const getExternalTableCount = async (connection: ExternalConnection, tableName: string) => {
      try {
        const result = await callExternalProxy(
          connection,
          "exec_sql",
          { sql: `SELECT count(*)::int AS cnt FROM public."${tableName}"` },
          8_000
        );
        const count = result?.data?.cnt;
        return typeof count === "number" ? count : null;
      } catch {
        return null;
      }
    };

    const markCancelled = async (jobId: string, message: string) => {
      await supabase
        .from("migration_jobs")
        .update({
          status: "cancelled",
          completed_at: new Date().toISOString(),
          error_message: message,
        } as any)
        .eq("id", jobId);
    };

    const getCurrentUserId = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      return user?.id ?? null;
    };

    const getSavedConnection = async (userId: string, url: string) => {
      const { data, error } = await supabase
        .from("external_db_connections")
        .select("url, anon_key")
        .eq("user_id", userId)
        .eq("url", url)
        .maybeSingle();

      if (error) throw error;
      return data as ExternalConnection | null;
    };

    const recoverJob = async (activeJob: MigrationJob) => {
      const destinationUrl = String(activeJob.destination_config?.url ?? "").trim();
      if (!destinationUrl) {
        await migrationJobApi.fail(activeJob.id, "Missing destination connection for migration recovery");
        return;
      }

      const userId = await getCurrentUserId();
      if (!userId) return;

      const connection = await getSavedConnection(userId, destinationUrl);
      if (!connection?.anon_key) {
        await migrationJobApi.fail(activeJob.id, "Saved external database connection not found for migration recovery");
        return;
      }

      const conflictStrategy =
        activeJob.tables_config && typeof activeJob.tables_config === "object"
          ? String((activeJob.tables_config as any).conflictStrategy ?? "update")
          : "update";

      const migrateData = Boolean((activeJob.tables_config as any)?.migrateData ?? true);
      if (!migrateData) {
        await migrationJobApi.complete(activeJob.id, {
          failed_tables: Array.isArray(activeJob.failed_tables) ? activeJob.failed_tables : [],
          error_message: activeJob.error_message,
        });
        return;
      }

      const { data: tablesResult, error: tablesErr } = await invokeMigrationFunction({ action: "list_tables" });
      if (tablesErr || !tablesResult?.success) {
        throw new Error(tablesErr?.message || tablesResult?.error || "Failed to load tables for recovery");
      }

      const selectedTables = Array.isArray((activeJob.tables_config as any)?.selectedTables)
        ? ((activeJob.tables_config as any).selectedTables as unknown[]).map(String)
        : null;

      const allTables = Array.isArray(tablesResult.tables)
        ? tablesResult.tables.map((table: any) => ({
            name: String(table.name),
            rowCount: Number(table.row_count ?? 0),
          }))
        : [];

      const tables = selectedTables?.length
        ? allTables.filter((table) => selectedTables.includes(table.name))
        : allTables;

      if (tables.length === 0) {
        await migrationJobApi.complete(activeJob.id, {
          failed_tables: Array.isArray(activeJob.failed_tables) ? activeJob.failed_tables : [],
          error_message: activeJob.error_message,
        });
        return;
      }

      const completedTablesLog = Array.isArray(activeJob.completed_tables)
        ? activeJob.completed_tables.map((table) => String(table))
        : [];
      const failedTablesLog = Array.isArray(activeJob.failed_tables)
        ? activeJob.failed_tables.map((item: any) => ({ table: String(item?.table ?? ""), error: String(item?.error ?? "") }))
        : [];
      const errors: string[] = [];

      let startIndex = Math.max(0, Number(activeJob.current_table_index ?? 1) - 1);
      if (startIndex >= tables.length) startIndex = Math.max(0, completedTablesLog.length);

      let grandTotalRows = tables.reduce((sum, table) => sum + (table.rowCount || 0), 0);
      let cumulativeRows = Math.max(
        0,
        Number(activeJob.processed_rows ?? 0) - Number(activeJob.current_table_processed ?? 0)
      );

      for (let i = startIndex; i < tables.length; i++) {
        const table = tables[i];

        while (true) {
          const remotePaused = await migrationJobApi.checkPauseRequested(activeJob.id);
          if (!remotePaused) break;
          await wait(800);
        }

        if (await migrationJobApi.checkCancelRequested(activeJob.id)) {
          await markCancelled(activeJob.id, "Migration cancelled by user request");
          return;
        }

        await migrationJobApi.update(activeJob.id, {
          current_table: table.name,
          current_table_index: i + 1,
          current_table_processed: 0,
          current_table_total: table.rowCount,
          progress_percent: grandTotalRows > 0 ? Math.round((cumulativeRows / grandTotalRows) * 100) : 0,
        });

        let offset = 0;
        const batchSize = table.rowCount > 50_000 ? 500 : table.rowCount > 10_000 ? 1_000 : 2_000;
        let totalMigrated = 0;
        const maxRetries = 3;
        const existingRowsBefore = (await getExternalTableCount(connection, table.name)) ?? 0;

        try {
          while (true) {
            if (await migrationJobApi.checkCancelRequested(activeJob.id)) {
              await markCancelled(activeJob.id, `Migration cancelled during table ${table.name}`);
              return;
            }

            while (true) {
              const remotePaused = await migrationJobApi.checkPauseRequested(activeJob.id);
              if (!remotePaused) break;
              await wait(800);
            }

            let sqlResult: any = null;
            let lastErr: Error | null = null;

            for (let attempt = 0; attempt <= maxRetries; attempt++) {
              try {
                const { data, error } = await invokeMigrationFunction(
                  {
                    action: "export_table_as_sql",
                    tableName: table.name,
                    offset,
                    limit: batchSize,
                    conflictStrategy,
                  },
                  60_000
                );

                if (error || !data?.success) {
                  throw new Error(error?.message || data?.error || "Export failed");
                }

                sqlResult = data;
                break;
              } catch (err: any) {
                lastErr = err instanceof Error ? err : new Error(String(err?.message ?? err));
                if (attempt < maxRetries) {
                  await wait(2_000 * (attempt + 1));
                  continue;
                }
              }
            }

            if (!sqlResult && lastErr) throw lastErr;
            if (!sqlResult?.sql || sqlResult.rowCount === 0) break;

            const sqlWithFkDisabled = `SET session_replication_role = 'replica'; ${sqlResult.sql} SET session_replication_role = 'origin';`;
            const externalResult = await callExternalProxy(connection, "exec_sql", { sql: sqlWithFkDisabled });
            const hasProxyError = (!externalResult?.success && externalResult?.error) || externalResult?.data?.error;

            if (hasProxyError) {
              const statements = String(sqlResult.sql)
                .split(";\n")
                .filter((statement) => statement.trim());
              let stmtMigrated = 0;
              const batchErrors: string[] = [];

              for (const statement of statements) {
                try {
                  const individualResult = await callExternalProxy(connection, "exec_sql", {
                    sql: `SET session_replication_role = 'replica'; ${statement}; SET session_replication_role = 'origin';`,
                  });
                  if (individualResult?.data?.error || (!individualResult?.success && individualResult?.error)) {
                    batchErrors.push(individualResult?.data?.error || individualResult?.error || "Unknown SQL error");
                    continue;
                  }

                  const valuesMatch = statement.match(/VALUES\s*\n?([\s\S]*)/i);
                  const rowCount = valuesMatch ? (statement.match(/\),\s*\n?\(/g)?.length ?? 0) + 1 : 1;
                  stmtMigrated += rowCount;
                } catch (err: any) {
                  batchErrors.push(String(err?.message ?? err));
                }
              }

              totalMigrated += stmtMigrated;
              if (batchErrors.length > 0 && stmtMigrated === 0) {
                throw new Error(batchErrors[0]);
              }
            } else {
              totalMigrated += Number(sqlResult.rowCount ?? 0);
            }

            const estimatedTotal = Number(sqlResult.rowCount) < batchSize
              ? totalMigrated
              : totalMigrated + batchSize;
            table.rowCount = Math.max(table.rowCount || 0, estimatedTotal);
            grandTotalRows = Math.max(grandTotalRows, cumulativeRows + table.rowCount);

            const overallProcessed = cumulativeRows + totalMigrated;
            await migrationJobApi.update(activeJob.id, {
              current_table_processed: totalMigrated,
              current_table_total: table.rowCount,
              processed_rows: overallProcessed,
              total_rows: grandTotalRows,
              progress_percent: grandTotalRows > 0
                ? Math.min(99, Math.round((overallProcessed / grandTotalRows) * 100))
                : 0,
            });

            offset += batchSize;
            if (Number(sqlResult.rowCount) < batchSize) break;
            await wait(10);
          }

          const existingRowsAfter = (await getExternalTableCount(connection, table.name)) ?? (existingRowsBefore + totalMigrated);
          const newRows = existingRowsAfter - existingRowsBefore;
          const updatedRows = totalMigrated - newRows;

          completedTablesLog.push(table.name);
          cumulativeRows += totalMigrated;

          await migrationJobApi.update(activeJob.id, {
            processed_rows: cumulativeRows,
            total_rows: grandTotalRows,
            progress_percent: grandTotalRows > 0 ? Math.min(99, Math.round((cumulativeRows / grandTotalRows) * 100)) : 0,
            current_table_total: Math.max(table.rowCount || 0, totalMigrated),
            current_table_processed: totalMigrated,
            completed_tables: [...new Set(completedTablesLog)],
            failed_tables: failedTablesLog,
            destination_config: {
              ...(activeJob.destination_config ?? {}),
              last_recovered_at: new Date().toISOString(),
              last_table_summary: { table: table.name, newRows: Math.max(0, newRows), updatedRows: Math.max(0, updatedRows) },
            },
          });
        } catch (err: any) {
          const message = String(err?.message ?? err);
          errors.push(`Table ${table.name}: ${message}`);
          failedTablesLog.push({ table: table.name, error: message });
          cumulativeRows += totalMigrated;

          await migrationJobApi.update(activeJob.id, {
            processed_rows: cumulativeRows,
            total_rows: grandTotalRows,
            progress_percent: grandTotalRows > 0 ? Math.min(99, Math.round((cumulativeRows / grandTotalRows) * 100)) : 0,
            current_table_processed: totalMigrated,
            failed_tables: failedTablesLog,
            completed_tables: [...new Set(completedTablesLog)],
          });
        }
      }

      await migrationJobApi.complete(activeJob.id, {
        failed_tables: failedTablesLog,
        error_message: errors.length > 0 ? errors.join(" | ").slice(0, 2_000) : null,
      });
    };

    const maybeRecover = async () => {
      if (!job || runnerRef.current || !isStaleJob(job)) return;
      if (lastStartedJobRef.current === job.id) return;
      if (!tryAcquireLock(job.id)) return;

      runnerRef.current = true;
      lastStartedJobRef.current = job.id;
      startHeartbeat(job.id);

      try {
        await recoverJob(job);
      } catch (error) {
        console.error("Global migration recovery failed:", error);
      } finally {
        runnerRef.current = false;
        stopHeartbeat(job.id);
      }
    };

    void maybeRecover();
    const interval = window.setInterval(() => void maybeRecover(), CHECK_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [job]);

  return null;
}