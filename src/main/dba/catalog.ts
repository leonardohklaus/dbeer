import { DatabaseEngine } from '../../shared/types';

// ─── Types ───────────────────────────────────────────────────────────────────

export type DBACategory =
  | 'performance'
  | 'storage'
  | 'indexes'
  | 'connections'
  | 'locks'
  | 'maintenance';

export const DBA_CATEGORY_LABELS: Record<DBACategory, string> = {
  performance: 'Performance',
  storage: 'Storage',
  indexes: 'Indexes',
  connections: 'Connections',
  locks: 'Locks & Waits',
  maintenance: 'Maintenance',
};

export interface DBAEntry {
  id: string;
  label: string;
  description: string;
  category: DBACategory;
  engines: DatabaseEngine[];
  /** Raw SQL per engine. Only engines listed in `engines` need to have an entry. */
  sql: Partial<Record<DatabaseEngine, string>>;
  /** Optional caveat shown in the UI (e.g. "requires pg_stat_statements") */
  note?: string;
}

// ─── Catalog ─────────────────────────────────────────────────────────────────

export const DBA_CATALOG: DBAEntry[] = [
  // ── PERFORMANCE ────────────────────────────────────────────────────────────

  {
    id: 'active_queries',
    label: 'Active Queries',
    description: 'Show all queries currently running on the database.',
    category: 'performance',
    engines: ['postgresql', 'mysql', 'sqlserver', 'oracle'],
    sql: {
      postgresql: `
SELECT
  pid,
  usename,
  application_name,
  state,
  wait_event_type,
  wait_event,
  ROUND(EXTRACT(EPOCH FROM (NOW() - query_start))::numeric, 2) AS elapsed_secs,
  LEFT(query, 300) AS query
FROM pg_stat_activity
WHERE state <> 'idle'
  AND pid <> pg_backend_pid()
ORDER BY elapsed_secs DESC NULLS LAST;`.trim(),

      mysql: `
SELECT
  id,
  user,
  host,
  db AS database_name,
  command,
  time AS elapsed_secs,
  state,
  LEFT(info, 300) AS query
FROM information_schema.PROCESSLIST
WHERE command <> 'Sleep'
ORDER BY time DESC;`.trim(),

      sqlserver: `
SELECT
  r.session_id,
  s.login_name,
  r.status,
  r.cpu_time,
  r.total_elapsed_time / 1000 AS elapsed_secs,
  r.reads,
  r.writes,
  r.logical_reads,
  LEFT(t.text, 300) AS query
FROM sys.dm_exec_requests r
JOIN sys.dm_exec_sessions s ON r.session_id = s.session_id
CROSS APPLY sys.dm_exec_sql_text(r.sql_handle) t
WHERE r.session_id > 50
ORDER BY r.total_elapsed_time DESC;`.trim(),

      oracle: `
SELECT
  s.sid,
  s.serial#,
  s.username,
  s.status,
  s.osuser,
  s.machine,
  ROUND((SYSDATE - s.logon_time) * 86400, 0) AS session_secs,
  SUBSTR(q.sql_text, 1, 300) AS sql_text
FROM v$session s
LEFT JOIN v$sql q ON s.sql_id = q.sql_id
WHERE s.type = 'USER' AND s.status = 'ACTIVE'
ORDER BY session_secs DESC
FETCH FIRST 50 ROWS ONLY;`.trim(),
    },
  },

  {
    id: 'slow_queries',
    label: 'Slow Queries (Top 20)',
    description: 'Queries with the highest total execution time.',
    category: 'performance',
    engines: ['postgresql', 'mysql', 'sqlserver', 'oracle'],
    note: 'PostgreSQL: requires pg_stat_statements extension.',
    sql: {
      postgresql: `
SELECT
  calls,
  ROUND(total_exec_time::numeric, 2)            AS total_ms,
  ROUND((total_exec_time / calls)::numeric, 2)  AS avg_ms,
  ROUND(min_exec_time::numeric, 2)              AS min_ms,
  ROUND(max_exec_time::numeric, 2)              AS max_ms,
  rows,
  LEFT(query, 300) AS query
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 20;`.trim(),

      mysql: `
SELECT
  SCHEMA_NAME AS db,
  COUNT_STAR   AS executions,
  ROUND(SUM_TIMER_WAIT / COUNT_STAR / 1e9, 2) AS avg_ms,
  ROUND(SUM_TIMER_WAIT / 1e9, 2)              AS total_ms,
  SUM_ROWS_EXAMINED / COUNT_STAR              AS avg_rows_examined,
  LEFT(DIGEST_TEXT, 300) AS query
FROM performance_schema.events_statements_summary_by_digest
WHERE COUNT_STAR > 0
ORDER BY SUM_TIMER_WAIT DESC
LIMIT 20;`.trim(),

      sqlserver: `
SELECT TOP 20
  qs.execution_count,
  qs.total_elapsed_time / qs.execution_count / 1000 AS avg_elapsed_ms,
  qs.total_worker_time  / qs.execution_count / 1000 AS avg_cpu_ms,
  qs.total_logical_reads / qs.execution_count       AS avg_logical_reads,
  qs.total_physical_reads / qs.execution_count      AS avg_physical_reads,
  LEFT(qt.text, 300) AS query
FROM sys.dm_exec_query_stats qs
CROSS APPLY sys.dm_exec_sql_text(qs.sql_handle) qt
ORDER BY avg_elapsed_ms DESC;`.trim(),

      oracle: `
SELECT
  sql_id,
  executions,
  ROUND(elapsed_time / 1e6, 2)                        AS total_secs,
  ROUND(elapsed_time / 1e6 / NULLIF(executions,0), 4) AS avg_secs,
  ROUND(cpu_time     / 1e6, 2)                        AS total_cpu_secs,
  disk_reads,
  buffer_gets,
  SUBSTR(sql_text, 1, 300) AS sql_text
FROM v$sql
ORDER BY elapsed_time DESC
FETCH FIRST 20 ROWS ONLY;`.trim(),
    },
  },

  {
    id: 'wait_events',
    label: 'Wait Events',
    description: 'Current and historical database wait events — reveals bottlenecks.',
    category: 'performance',
    engines: ['postgresql', 'sqlserver', 'oracle'],
    sql: {
      postgresql: `
SELECT
  wait_event_type,
  wait_event,
  COUNT(*) AS waiters
FROM pg_stat_activity
WHERE wait_event IS NOT NULL
GROUP BY wait_event_type, wait_event
ORDER BY waiters DESC;`.trim(),

      sqlserver: `
SELECT TOP 25
  wait_type,
  waiting_tasks_count,
  wait_time_ms,
  signal_wait_time_ms,
  wait_time_ms - signal_wait_time_ms AS resource_wait_ms,
  CAST(100.0 * wait_time_ms / SUM(wait_time_ms) OVER() AS DECIMAL(5,2)) AS pct
FROM sys.dm_os_wait_stats
WHERE wait_type NOT IN (
  'SLEEP_TASK','BROKER_TO_FLUSH','BROKER_TASK_STOP','CLR_AUTO_EVENT',
  'DISPATCHER_QUEUE_SEMAPHORE','LAZYWRITER_SLEEP','LOGMGR_QUEUE',
  'REQUEST_FOR_DEADLOCK_SEARCH','RESOURCE_QUEUE','SERVER_IDLE_CHECK',
  'SLEEP_DBSTARTUP','SLEEP_MASTERDBREADY','SNI_HTTP_ACCEPT','XE_TIMER_EVENT'
)
ORDER BY wait_time_ms DESC;`.trim(),

      oracle: `
SELECT
  event,
  COUNT(*)                                  AS waiters,
  ROUND(AVG(wait_time_micro) / 1000, 2)    AS avg_wait_ms,
  wait_class
FROM v$session_wait
WHERE wait_class <> 'Idle'
GROUP BY event, wait_class
ORDER BY waiters DESC;`.trim(),
    },
  },

  {
    id: 'top_queries_cpu',
    label: 'Top Queries by CPU',
    description: 'Queries consuming the most CPU time.',
    category: 'performance',
    engines: ['postgresql', 'sqlserver', 'oracle'],
    note: 'PostgreSQL: requires pg_stat_statements.',
    sql: {
      postgresql: `
SELECT
  calls,
  ROUND((total_exec_time / calls)::numeric, 2) AS avg_ms,
  ROUND(total_exec_time::numeric, 2)           AS total_ms,
  rows,
  LEFT(query, 300) AS query
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 20;`.trim(),

      sqlserver: `
SELECT TOP 20
  qs.execution_count,
  qs.total_worker_time / qs.execution_count / 1000 AS avg_cpu_ms,
  qs.total_worker_time / 1000                       AS total_cpu_ms,
  LEFT(qt.text, 300) AS query
FROM sys.dm_exec_query_stats qs
CROSS APPLY sys.dm_exec_sql_text(qs.sql_handle) qt
ORDER BY qs.total_worker_time DESC;`.trim(),

      oracle: `
SELECT
  SUBSTR(sql_text, 1, 300)                            AS sql_text,
  executions,
  ROUND(cpu_time / 1e6, 2)                            AS total_cpu_secs,
  ROUND(cpu_time / 1e6 / NULLIF(executions,0), 4)    AS avg_cpu_secs
FROM v$sql
ORDER BY cpu_time DESC
FETCH FIRST 20 ROWS ONLY;`.trim(),
    },
  },

  // ── STORAGE ────────────────────────────────────────────────────────────────

  {
    id: 'table_sizes',
    label: 'Table Sizes',
    description: 'Space used by each table (data + indexes).',
    category: 'storage',
    engines: ['postgresql', 'mysql', 'sqlserver', 'oracle', 'sqlite'],
    sql: {
      postgresql: `
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_relation_size(schemaname||'.'||tablename))       AS table_size,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
  pg_size_pretty(
    pg_total_relation_size(schemaname||'.'||tablename)
    - pg_relation_size(schemaname||'.'||tablename)
  ) AS indexes_size
FROM pg_tables
WHERE schemaname NOT IN ('pg_catalog','information_schema')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;`.trim(),

      mysql: `
SELECT
  table_schema,
  table_name,
  ROUND(data_length / 1024 / 1024, 2)                    AS data_mb,
  ROUND(index_length / 1024 / 1024, 2)                   AS index_mb,
  ROUND((data_length + index_length) / 1024 / 1024, 2)   AS total_mb,
  table_rows
FROM information_schema.TABLES
WHERE table_schema NOT IN ('information_schema','mysql','performance_schema','sys')
ORDER BY (data_length + index_length) DESC;`.trim(),

      sqlserver: `
SELECT
  s.name                                                           AS schema_name,
  t.name                                                           AS table_name,
  p.rows                                                           AS row_count,
  CAST(ROUND(SUM(a.total_pages) * 8.0 / 1024, 2) AS DECIMAL(18,2)) AS total_mb,
  CAST(ROUND(SUM(a.used_pages)  * 8.0 / 1024, 2) AS DECIMAL(18,2)) AS used_mb
FROM sys.tables t
JOIN sys.schemas s ON t.schema_id = s.schema_id
JOIN sys.indexes i ON t.object_id = i.object_id
JOIN sys.partitions p ON i.object_id = p.object_id AND i.index_id = p.index_id
JOIN sys.allocation_units a ON p.partition_id = a.container_id
WHERE t.is_ms_shipped = 0
GROUP BY s.name, t.name, p.rows
ORDER BY total_mb DESC;`.trim(),

      oracle: `
SELECT
  owner,
  segment_name          AS table_name,
  ROUND(bytes / 1048576, 2) AS size_mb
FROM dba_segments
WHERE segment_type = 'TABLE'
ORDER BY bytes DESC
FETCH FIRST 50 ROWS ONLY;`.trim(),

      sqlite: `
SELECT
  name AS table_name,
  (
    SELECT COUNT(*) FROM sqlite_master sm2
    WHERE sm2.type = 'index' AND sm2.tbl_name = sm.name
  ) AS index_count
FROM sqlite_master sm
WHERE type = 'table'
ORDER BY name;`.trim(),
    },
  },

  {
    id: 'database_size',
    label: 'Database Size',
    description: 'Total size of the current database (and other databases if accessible).',
    category: 'storage',
    engines: ['postgresql', 'mysql', 'sqlserver', 'oracle', 'sqlite'],
    sql: {
      postgresql: `
SELECT
  datname AS database_name,
  pg_size_pretty(pg_database_size(datname)) AS size,
  pg_database_size(datname) AS size_bytes
FROM pg_database
ORDER BY pg_database_size(datname) DESC;`.trim(),

      mysql: `
SELECT
  table_schema                                                         AS database_name,
  ROUND(SUM(data_length + index_length) / 1024 / 1024, 2)            AS total_mb
FROM information_schema.TABLES
GROUP BY table_schema
ORDER BY total_mb DESC;`.trim(),

      sqlserver: `
SELECT
  name   AS database_name,
  CAST(SUM(size) * 8.0 / 1024 AS DECIMAL(18,2)) AS total_mb,
  state_desc
FROM sys.databases d
JOIN sys.master_files f ON d.database_id = f.database_id
GROUP BY d.name, d.state_desc
ORDER BY total_mb DESC;`.trim(),

      oracle: `
SELECT
  tablespace_name,
  ROUND(used_space      * 8192 / 1048576, 2) AS used_mb,
  ROUND(tablespace_size * 8192 / 1048576, 2) AS total_mb,
  ROUND(100 * used_space / NULLIF(tablespace_size,0), 2) AS used_pct
FROM dba_tablespace_usage_metrics
ORDER BY used_pct DESC;`.trim(),

      sqlite: `
SELECT
  page_count * page_size                      AS size_bytes,
  ROUND(page_count * page_size / 1048576.0, 3) AS size_mb,
  page_count,
  page_size
FROM pragma_page_count(), pragma_page_size();`.trim(),
    },
  },

  // ── INDEXES ────────────────────────────────────────────────────────────────

  {
    id: 'index_usage',
    label: 'Index Usage Stats',
    description: 'How many times each index has been used (seeks, scans, lookups).',
    category: 'indexes',
    engines: ['postgresql', 'mysql', 'sqlserver'],
    sql: {
      postgresql: `
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan  AS scans,
  idx_tup_read  AS tuples_read,
  idx_tup_fetch AS tuples_fetched,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;`.trim(),

      mysql: `
SELECT
  object_schema AS db,
  object_name   AS table_name,
  index_name,
  count_star    AS total_accesses,
  count_read    AS reads,
  count_write   AS writes
FROM performance_schema.table_io_waits_summary_by_index_usage
WHERE object_schema NOT IN ('mysql','performance_schema','information_schema','sys')
  AND index_name IS NOT NULL
ORDER BY count_star DESC;`.trim(),

      sqlserver: `
SELECT
  OBJECT_NAME(i.object_id) AS table_name,
  i.name                   AS index_name,
  i.type_desc,
  ISNULL(ius.user_seeks,  0) AS user_seeks,
  ISNULL(ius.user_scans,  0) AS user_scans,
  ISNULL(ius.user_lookups,0) AS user_lookups,
  ISNULL(ius.user_updates,0) AS user_updates,
  ISNULL(ius.last_user_seek, ius.last_user_scan) AS last_used
FROM sys.indexes i
LEFT JOIN sys.dm_db_index_usage_stats ius
  ON i.object_id = ius.object_id
  AND i.index_id = ius.index_id
  AND ius.database_id = DB_ID()
WHERE OBJECTPROPERTY(i.object_id,'IsUserTable') = 1
ORDER BY (ISNULL(ius.user_seeks,0) + ISNULL(ius.user_scans,0)) DESC;`.trim(),
    },
  },

  {
    id: 'unused_indexes',
    label: 'Unused Indexes',
    description: 'Indexes that are never used for reads but still cost writes and storage.',
    category: 'indexes',
    engines: ['postgresql', 'mysql', 'sqlserver'],
    sql: {
      postgresql: `
SELECT
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
  idx_scan AS scans_since_stats_reset
FROM pg_stat_user_indexes
WHERE idx_scan = 0
ORDER BY pg_relation_size(indexrelid) DESC;`.trim(),

      mysql: `
SELECT
  object_schema AS db,
  object_name   AS table_name,
  index_name
FROM performance_schema.table_io_waits_summary_by_index_usage
WHERE count_star = 0
  AND index_name <> 'PRIMARY'
  AND object_schema NOT IN ('mysql','performance_schema','information_schema','sys')
ORDER BY object_schema, object_name;`.trim(),

      sqlserver: `
SELECT
  OBJECT_NAME(i.object_id)   AS table_name,
  i.name                     AS index_name,
  i.type_desc,
  ISNULL(ius.user_updates,0) AS user_updates,
  ISNULL(ius.user_seeks,  0) AS user_seeks,
  ISNULL(ius.user_scans,  0) AS user_scans
FROM sys.indexes i
LEFT JOIN sys.dm_db_index_usage_stats ius
  ON i.object_id = ius.object_id
  AND i.index_id = ius.index_id
  AND ius.database_id = DB_ID()
WHERE OBJECTPROPERTY(i.object_id,'IsUserTable') = 1
  AND i.type_desc <> 'HEAP'
  AND i.is_primary_key = 0
  AND ISNULL(ius.user_seeks,0) + ISNULL(ius.user_scans,0) + ISNULL(ius.user_lookups,0) = 0
ORDER BY ISNULL(ius.user_updates,0) DESC;`.trim(),
    },
  },

  {
    id: 'missing_indexes',
    label: 'Missing Index Suggestions',
    description: 'Indexes the engine recommends creating based on query patterns.',
    category: 'indexes',
    engines: ['sqlserver'],
    sql: {
      sqlserver: `
SELECT TOP 20
  ROUND(
    s.avg_total_user_cost * s.avg_user_impact * (s.user_seeks + s.user_scans),
    0
  ) AS improvement_score,
  d.statement                 AS table_name,
  d.equality_columns,
  d.inequality_columns,
  d.included_columns
FROM sys.dm_db_missing_index_groups   g
JOIN sys.dm_db_missing_index_group_stats s ON s.group_handle = g.index_group_handle
JOIN sys.dm_db_missing_index_details  d ON d.index_handle = g.index_handle
ORDER BY improvement_score DESC;`.trim(),
    },
  },

  // ── CONNECTIONS ────────────────────────────────────────────────────────────

  {
    id: 'connection_count',
    label: 'Connection Overview',
    description: 'Number of active connections grouped by state or user.',
    category: 'connections',
    engines: ['postgresql', 'mysql', 'sqlserver', 'oracle'],
    sql: {
      postgresql: `
SELECT
  state,
  COUNT(*)             AS sessions,
  COUNT(*) FILTER (WHERE wait_event IS NOT NULL) AS waiting
FROM pg_stat_activity
GROUP BY state
ORDER BY sessions DESC;`.trim(),

      mysql: `
SELECT
  VARIABLE_NAME,
  VARIABLE_VALUE
FROM performance_schema.global_status
WHERE VARIABLE_NAME IN (
  'Threads_connected','Threads_running',
  'Max_used_connections','Connection_errors_max_connections',
  'Connections','Aborted_connects'
)
ORDER BY VARIABLE_NAME;`.trim(),

      sqlserver: `
SELECT
  login_name,
  COUNT(*)          AS session_count,
  SUM(cpu_time)     AS total_cpu,
  SUM(memory_usage) AS total_memory_pages,
  status
FROM sys.dm_exec_sessions
WHERE is_user_process = 1
GROUP BY login_name, status
ORDER BY session_count DESC;`.trim(),

      oracle: `
SELECT
  username,
  status,
  COUNT(*) AS sessions
FROM v$session
WHERE type = 'USER'
GROUP BY username, status
ORDER BY sessions DESC;`.trim(),
    },
  },

  // ── LOCKS ─────────────────────────────────────────────────────────────────

  {
    id: 'blocking_queries',
    label: 'Blocking Queries',
    description: 'Queries that are blocking other sessions from proceeding.',
    category: 'locks',
    engines: ['postgresql', 'mysql', 'sqlserver', 'oracle'],
    sql: {
      postgresql: `
SELECT
  bl.pid                    AS blocked_pid,
  a.usename                 AS blocked_user,
  LEFT(a.query, 200)        AS blocked_query,
  kl.pid                    AS blocking_pid,
  ka.usename                AS blocking_user,
  LEFT(ka.query, 200)       AS blocking_query
FROM pg_catalog.pg_locks bl
JOIN pg_catalog.pg_stat_activity a  ON a.pid  = bl.pid
JOIN pg_catalog.pg_locks kl
  ON kl.transactionid = bl.transactionid AND kl.pid <> bl.pid
JOIN pg_catalog.pg_stat_activity ka ON ka.pid = kl.pid
WHERE NOT bl.granted;`.trim(),

      mysql: `
SELECT
  r.trx_id                  AS waiting_trx_id,
  r.trx_mysql_thread_id     AS waiting_thread,
  LEFT(r.trx_query, 200)    AS waiting_query,
  b.trx_id                  AS blocking_trx_id,
  b.trx_mysql_thread_id     AS blocking_thread,
  LEFT(b.trx_query, 200)    AS blocking_query
FROM information_schema.INNODB_TRX b
JOIN information_schema.INNODB_TRX r
  ON r.trx_wait_started IS NOT NULL AND b.trx_id <> r.trx_id
ORDER BY b.trx_started;`.trim(),

      sqlserver: `
SELECT
  s_blocking.session_id  AS blocking_session,
  s_blocked.session_id   AS blocked_session,
  s_blocking.login_name  AS blocking_login,
  s_blocked.login_name   AS blocked_login,
  LEFT(t_blocking.text, 200) AS blocking_query,
  LEFT(t_blocked.text,  200) AS blocked_query,
  r.wait_type,
  r.wait_time / 1000     AS wait_secs
FROM sys.dm_exec_sessions s_blocking
JOIN sys.dm_exec_requests r ON r.blocking_session_id = s_blocking.session_id
JOIN sys.dm_exec_sessions s_blocked ON s_blocked.session_id = r.session_id
OUTER APPLY sys.dm_exec_sql_text(s_blocking.most_recent_sql_handle) t_blocking
OUTER APPLY sys.dm_exec_sql_text(r.sql_handle) t_blocked;`.trim(),

      oracle: `
SELECT
  l.sid                      AS blocking_sid,
  s.username                 AS blocking_user,
  l2.sid                     AS blocked_sid,
  s2.username                AS blocked_user,
  o.object_name,
  DECODE(l.lmode,
    2,'Row Share',3,'Row Exclusive',4,'Share',5,'Share Row Excl',6,'Exclusive'
  ) AS lock_mode
FROM v$lock l
JOIN v$lock l2    ON l.id1 = l2.id1 AND l.id2 = l2.id2 AND l.block = 1 AND l2.request > 0
JOIN v$session s  ON l.sid  = s.sid
JOIN v$session s2 ON l2.sid = s2.sid
LEFT JOIN dba_objects o ON l.id1 = o.object_id;`.trim(),
    },
  },

  {
    id: 'current_locks',
    label: 'Current Locks',
    description: 'All locks held or requested in the database right now.',
    category: 'locks',
    engines: ['postgresql', 'sqlserver'],
    sql: {
      postgresql: `
SELECT
  pg_class.relname      AS table_name,
  pg_locks.locktype,
  pg_locks.mode,
  pg_locks.granted,
  pg_stat_activity.pid,
  pg_stat_activity.usename,
  pg_stat_activity.state,
  LEFT(pg_stat_activity.query, 200) AS query
FROM pg_locks
LEFT JOIN pg_class ON pg_locks.relation = pg_class.oid
LEFT JOIN pg_stat_activity ON pg_stat_activity.pid = pg_locks.pid
WHERE pg_class.relname NOT LIKE 'pg_%'
ORDER BY pg_locks.granted, pg_class.relname;`.trim(),

      sqlserver: `
SELECT
  tl.request_session_id  AS session_id,
  tl.resource_type,
  tl.resource_database_id,
  OBJECT_NAME(tl.resource_associated_entity_id) AS object_name,
  tl.request_mode        AS lock_mode,
  tl.request_status      AS lock_status,
  LEFT(t.text, 200)      AS query
FROM sys.dm_tran_locks tl
LEFT JOIN sys.dm_exec_requests r ON tl.request_session_id = r.session_id
OUTER APPLY sys.dm_exec_sql_text(r.sql_handle) t
WHERE tl.request_session_id > 50
ORDER BY tl.request_session_id;`.trim(),
    },
  },

  // ── MAINTENANCE ────────────────────────────────────────────────────────────

  {
    id: 'vacuum_stats',
    label: 'Vacuum / Analyze Stats',
    description: 'Table bloat, dead tuples, and last vacuum/analyze timestamps.',
    category: 'maintenance',
    engines: ['postgresql'],
    sql: {
      postgresql: `
SELECT
  schemaname,
  tablename,
  n_live_tup                                                AS live_rows,
  n_dead_tup                                                AS dead_rows,
  ROUND(100.0 * n_dead_tup / NULLIF(n_live_tup + n_dead_tup,0), 2) AS dead_pct,
  last_vacuum,
  last_autovacuum,
  last_analyze,
  last_autoanalyze,
  vacuum_count,
  autovacuum_count
FROM pg_stat_user_tables
ORDER BY n_dead_tup DESC;`.trim(),
    },
  },

  {
    id: 'cache_hit_ratio',
    label: 'Buffer / Cache Hit Ratio',
    description: 'Percentage of reads served from memory vs disk — higher is better.',
    category: 'maintenance',
    engines: ['postgresql', 'mysql'],
    sql: {
      postgresql: `
SELECT
  schemaname,
  tablename,
  heap_blks_hit  AS cache_hits,
  heap_blks_read AS disk_reads,
  ROUND(
    100.0 * heap_blks_hit / NULLIF(heap_blks_hit + heap_blks_read, 0), 2
  ) AS hit_ratio_pct
FROM pg_statio_user_tables
WHERE heap_blks_hit + heap_blks_read > 0
ORDER BY disk_reads DESC;`.trim(),

      mysql: `
SELECT
  VARIABLE_NAME,
  VARIABLE_VALUE
FROM performance_schema.global_status
WHERE VARIABLE_NAME IN (
  'Innodb_buffer_pool_reads',
  'Innodb_buffer_pool_read_requests',
  'Innodb_buffer_pool_pages_total',
  'Innodb_buffer_pool_pages_free',
  'Innodb_buffer_pool_pages_data',
  'Innodb_buffer_pool_pages_dirty'
)
ORDER BY VARIABLE_NAME;`.trim(),
    },
  },

  {
    id: 'table_bloat',
    label: 'Table Bloat Estimate',
    description: 'Estimates wasted space in PostgreSQL heap tables.',
    category: 'maintenance',
    engines: ['postgresql'],
    sql: {
      postgresql: `
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
  ROUND(100.0 * n_dead_tup / NULLIF(n_live_tup + n_dead_tup, 0), 2) AS bloat_pct,
  n_dead_tup  AS dead_tuples,
  n_live_tup  AS live_tuples,
  last_autovacuum
FROM pg_stat_user_tables
WHERE n_dead_tup > 0
ORDER BY n_dead_tup DESC
LIMIT 20;`.trim(),
    },
  },

  {
    id: 'db_stats',
    label: 'Database Activity Stats',
    description: 'Rollbacks, deadlocks, temp files and other database-level stats.',
    category: 'maintenance',
    engines: ['postgresql'],
    sql: {
      postgresql: `
SELECT
  datname,
  numbackends       AS active_connections,
  xact_commit       AS commits,
  xact_rollback     AS rollbacks,
  blks_read         AS disk_reads,
  blks_hit          AS cache_hits,
  tup_returned,
  tup_fetched,
  tup_inserted,
  tup_updated,
  tup_deleted,
  conflicts,
  deadlocks,
  temp_files,
  ROUND(temp_bytes / 1048576.0, 2) AS temp_mb
FROM pg_stat_database
WHERE datname = current_database();`.trim(),
    },
  },

  {
    id: 'replication_lag',
    label: 'Replication Status & Lag',
    description: 'Replication lag and streaming status for replicas.',
    category: 'maintenance',
    engines: ['postgresql'],
    sql: {
      postgresql: `
SELECT
  client_addr,
  state,
  sent_lsn,
  write_lsn,
  flush_lsn,
  replay_lsn,
  write_lag,
  flush_lag,
  replay_lag,
  sync_state
FROM pg_stat_replication
ORDER BY client_addr;`.trim(),
    },
  },

  {
    id: 'sqlserver_index_fragmentation',
    label: 'Index Fragmentation',
    description: 'Fragmentation percentage for each index — >30% usually warrants a rebuild.',
    category: 'maintenance',
    engines: ['sqlserver'],
    note: 'This query may take a few seconds on large databases.',
    sql: {
      sqlserver: `
SELECT
  OBJECT_NAME(ips.object_id)    AS table_name,
  i.name                        AS index_name,
  i.type_desc,
  ROUND(ips.avg_fragmentation_in_percent, 2) AS fragmentation_pct,
  ips.page_count
FROM sys.dm_db_index_physical_stats(
  DB_ID(), NULL, NULL, NULL, 'LIMITED'
) ips
JOIN sys.indexes i
  ON ips.object_id = i.object_id AND ips.index_id = i.index_id
WHERE ips.page_count > 100
  AND ips.avg_fragmentation_in_percent > 10
ORDER BY ips.avg_fragmentation_in_percent DESC;`.trim(),
    },
  },

  {
    id: 'sqlite_integrity',
    label: 'Integrity Check',
    description: 'Runs SQLite integrity_check pragma to detect database corruption.',
    category: 'maintenance',
    engines: ['sqlite'],
    sql: {
      sqlite: `PRAGMA integrity_check;`,
    },
  },

  {
    id: 'sqlite_info',
    label: 'Database Info',
    description: 'Page size, page count, encoding and other PRAGMA settings.',
    category: 'maintenance',
    engines: ['sqlite'],
    sql: {
      sqlite: `
SELECT 'page_size'    AS setting, CAST(page_size    AS TEXT) AS value FROM pragma_page_size()
UNION ALL
SELECT 'page_count',                CAST(page_count   AS TEXT)          FROM pragma_page_count()
UNION ALL
SELECT 'freelist_count',            CAST(freelist_count AS TEXT)        FROM pragma_freelist_count()
UNION ALL
SELECT 'journal_mode',              journal_mode                        FROM pragma_journal_mode()
UNION ALL
SELECT 'wal_autocheckpoint',        CAST(wal_autocheckpoint AS TEXT)    FROM pragma_wal_autocheckpoint()
UNION ALL
SELECT 'encoding',                  encoding                            FROM pragma_encoding();`.trim(),
    },
  },
];
