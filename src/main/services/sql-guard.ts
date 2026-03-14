/**
 * SQL Guard — Read-Only Enforcement
 *
 * DBeer is a READ-ONLY database client. This module enforces that constraint
 * at the lowest level, before any SQL reaches the database driver.
 *
 * Two layers of protection:
 * 1. FORBIDDEN_PATTERNS — regex blacklist of dangerous statement prefixes
 * 2. ALLOWED_PATTERNS — whitelist of explicitly allowed statement types
 *
 * Both must pass. A query must NOT match any forbidden pattern AND must
 * match at least one allowed pattern.
 */

// ─── Forbidden Statement Patterns ────────────────────────────────────────────
// These are blocked unconditionally, regardless of context.

const FORBIDDEN_PATTERNS: { pattern: RegExp; label: string }[] = [
  // DML — Data Manipulation (write)
  { pattern: /^\s*INSERT\s/i, label: 'INSERT' },
  { pattern: /^\s*UPDATE\s/i, label: 'UPDATE' },
  { pattern: /^\s*DELETE\s/i, label: 'DELETE' },
  { pattern: /^\s*MERGE\s/i, label: 'MERGE' },
  { pattern: /^\s*UPSERT\s/i, label: 'UPSERT' },
  { pattern: /^\s*REPLACE\s/i, label: 'REPLACE' },

  // DDL — Data Definition
  { pattern: /^\s*CREATE\s/i, label: 'CREATE' },
  { pattern: /^\s*ALTER\s/i, label: 'ALTER' },
  { pattern: /^\s*DROP\s/i, label: 'DROP' },
  { pattern: /^\s*TRUNCATE\s/i, label: 'TRUNCATE' },
  { pattern: /^\s*RENAME\s/i, label: 'RENAME' },

  // DCL — Data Control
  { pattern: /^\s*GRANT\s/i, label: 'GRANT' },
  { pattern: /^\s*REVOKE\s/i, label: 'REVOKE' },

  // TCL — Transaction Control (prevent manual transaction tricks)
  { pattern: /^\s*BEGIN\s/i, label: 'BEGIN' },
  { pattern: /^\s*COMMIT\s/i, label: 'COMMIT' },
  { pattern: /^\s*ROLLBACK\s/i, label: 'ROLLBACK' },
  { pattern: /^\s*SAVEPOINT\s/i, label: 'SAVEPOINT' },

  // Administrative
  { pattern: /^\s*EXEC(UTE)?\s/i, label: 'EXECUTE' },
  { pattern: /^\s*CALL\s/i, label: 'CALL' },
  { pattern: /^\s*SET\s/i, label: 'SET' },
  { pattern: /^\s*VACUUM\s/i, label: 'VACUUM' },
  { pattern: /^\s*REINDEX\s/i, label: 'REINDEX' },
  { pattern: /^\s*ANALYZE\s/i, label: 'ANALYZE' },
  { pattern: /^\s*CLUSTER\s/i, label: 'CLUSTER' },
  { pattern: /^\s*COPY\s/i, label: 'COPY' },
  { pattern: /^\s*LOAD\s/i, label: 'LOAD' },
  { pattern: /^\s*IMPORT\s/i, label: 'IMPORT' },
  { pattern: /^\s*EXPORT\s/i, label: 'EXPORT' },

  // Dangerous functions/keywords anywhere in the query
  { pattern: /\bINTO\s+OUTFILE\b/i, label: 'INTO OUTFILE' },
  { pattern: /\bINTO\s+DUMPFILE\b/i, label: 'INTO DUMPFILE' },
  { pattern: /\bLOAD_FILE\s*\(/i, label: 'LOAD_FILE()' },
  { pattern: /\bpg_sleep\s*\(/i, label: 'pg_sleep()' },
  { pattern: /\bWAITFOR\s+DELAY\b/i, label: 'WAITFOR DELAY' },
  { pattern: /\bxp_cmdshell\b/i, label: 'xp_cmdshell' },
  { pattern: /\bsp_executesql\b/i, label: 'sp_executesql' },
  { pattern: /\bDBMS_/i, label: 'DBMS_ package' },
  { pattern: /\bUTL_/i, label: 'UTL_ package' },
];

// ─── Allowed Statement Patterns ──────────────────────────────────────────────
// Only these are permitted to execute.

const ALLOWED_PATTERNS: RegExp[] = [
  /^\s*SELECT\s/i,
  /^\s*WITH\s/i,         // CTEs that start with WITH ... SELECT
  /^\s*SHOW\s/i,         // SHOW TABLES, SHOW COLUMNS, etc. (MySQL)
  /^\s*DESCRIBE\s/i,     // DESCRIBE table (MySQL/Oracle)
  /^\s*DESC\s/i,         // DESC table (Oracle)
  /^\s*EXPLAIN\s/i,      // EXPLAIN query plans
  /^\s*PRAGMA\s/i,       // SQLite PRAGMA (read-only introspection)
  /^\s*TABLE\s/i,        // TABLE statement (PostgreSQL 16+ shorthand for SELECT * FROM)
  /^\s*VALUES\s/i,       // VALUES as standalone query (no INSERT)
];

// ─── Public API ──────────────────────────────────────────────────────────────

export interface SQLValidationResult {
  allowed: boolean;
  reason?: string;
  blockedKeyword?: string;
}

/**
 * Validates that a SQL string is read-only.
 * Returns { allowed: true } if safe, or { allowed: false, reason, blockedKeyword } if blocked.
 */
export function validateReadOnlySQL(sql: string): SQLValidationResult {
  const trimmed = sql.trim();

  if (!trimmed) {
    return { allowed: false, reason: 'Empty query.' };
  }

  // Strip leading comments (both -- and /* */ style) to check the actual statement
  const stripped = stripLeadingComments(trimmed);

  // Check forbidden patterns first
  for (const { pattern, label } of FORBIDDEN_PATTERNS) {
    if (pattern.test(stripped)) {
      return {
        allowed: false,
        reason: `🔒 Blocked: ${label} operations are not allowed. DBeer is a read-only client — no data modifications, no structural changes.`,
        blockedKeyword: label,
      };
    }
  }

  // Check if it matches any allowed pattern
  const isAllowed = ALLOWED_PATTERNS.some(p => p.test(stripped));
  if (!isAllowed) {
    return {
      allowed: false,
      reason: `🔒 Blocked: This statement type is not recognized as a read-only query. DBeer only allows SELECT, WITH, SHOW, DESCRIBE, EXPLAIN, and PRAGMA.`,
    };
  }

  // Additional: check for multiple statements (prevent piggyback attacks like "SELECT 1; DROP TABLE")
  if (containsMultipleStatements(stripped)) {
    return {
      allowed: false,
      reason: '🔒 Blocked: Multiple SQL statements detected. Only single queries are allowed.',
    };
  }

  return { allowed: true };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function stripLeadingComments(sql: string): string {
  let s = sql;
  // Remove block comments
  while (s.startsWith('/*')) {
    const end = s.indexOf('*/');
    if (end === -1) break;
    s = s.substring(end + 2).trim();
  }
  // Remove line comments
  while (s.startsWith('--')) {
    const nl = s.indexOf('\n');
    if (nl === -1) return '';
    s = s.substring(nl + 1).trim();
  }
  return s;
}

function containsMultipleStatements(sql: string): boolean {
  // Simple heuristic: count semicolons that aren't inside string literals
  let inSingle = false;
  let inDouble = false;
  let semicolonCount = 0;

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    const prev = i > 0 ? sql[i - 1] : '';

    if (ch === "'" && !inDouble && prev !== '\\') inSingle = !inSingle;
    if (ch === '"' && !inSingle && prev !== '\\') inDouble = !inDouble;
    if (ch === ';' && !inSingle && !inDouble) {
      semicolonCount++;
      // Allow trailing semicolon on last statement
      const remaining = sql.substring(i + 1).trim();
      if (remaining.length > 0) {
        return true; // There's meaningful content after a semicolon
      }
    }
  }

  return false;
}
