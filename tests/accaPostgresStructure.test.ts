import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

/**
 * ============================================================================
 * POSTGRESQL STRUCTURAL EVIDENCE ONLY
 * ============================================================================
 *
 * Sprint 20B-B stage B2.
 *
 * NOTHING in this file executes SQL. No PostgreSQL server, container, or client binary is
 * available in this environment, so no statement here has ever been run. These tests read the
 * adapter source and the migration text and assert their STRUCTURE.
 *
 * What that can prove: the transaction is opened and closed, both writes sit inside it, the
 * candidate predicate carries the expected status and version, the client is released in a
 * `finally`, the SQL is parameterized, the constraints are declared, and no generic payload
 * update exists.
 *
 * What it CANNOT prove: that PostgreSQL actually rolls back, that the unique indexes actually
 * reject a concurrent duplicate, that isolation behaves as intended under contention, or that
 * any of this SQL is even syntactically valid to the server. Those remain UNPROVEN and are
 * reported as such.
 */

const root = process.cwd();
const ADAPTER = "lib/acca-publication/adapters/postgres.ts";
const MIGRATION = "db/migrations/20260728_create_published_accas.sql";

const adapterSrc = readFileSync(path.join(root, ADAPTER), "utf8");
const migrationSrc = readFileSync(path.join(root, MIGRATION), "utf8");

/**
 * Comment-stripped views.
 *
 * Both files EXPLAIN their own constraints in prose — the migration header names the
 * `DROP TABLE` reverse path and cites `DOUBLE PRECISION` as the type it refuses to use, and
 * the adapter mentions its hard-coded `ORDER BY`. Asserting "this token does not appear"
 * against the raw text would therefore fail on the documentation rather than on the code, so
 * the negative assertions below run against executable text only.
 */
const migrationSql = migrationSrc
  .split("\n")
  .map((line) => line.replace(/--.*$/, ""))
  .join("\n");

const adapterCode = adapterSrc
  .split("\n")
  .filter((line) => {
    const t = line.trim();
    return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
  })
  .join("\n");

/** The body of `createDraftFromCandidate`, which is the transactional unit. */
function createFunctionBody(): string {
  const start = adapterSrc.indexOf("async createDraftFromCandidate(");
  assert.ok(start > 0, "createDraftFromCandidate must exist");
  const end = adapterSrc.indexOf("async getAccaById", start);
  assert.ok(end > start, "could not delimit the create function");
  return adapterSrc.slice(start, end);
}

const createBody = createFunctionBody();

/* ================================================================== *
 * 1. Transaction shape
 * ================================================================== */

test("POSTGRESQL STRUCTURAL EVIDENCE ONLY: the create path opens a transaction on one client", () => {
  assert.match(createBody, /const client = await pool\.connect\(\)/, "must take one client");
  assert.match(createBody, /client\.query\("BEGIN"\)/, "must BEGIN");
  assert.match(createBody, /client\.query\("COMMIT"\)/, "must COMMIT");
  assert.match(createBody, /client\.query\("ROLLBACK"\)/, "must ROLLBACK");
});

test("POSTGRESQL STRUCTURAL EVIDENCE ONLY: both writes sit between BEGIN and COMMIT", () => {
  const begin = createBody.indexOf('client.query("BEGIN")');
  const insert = createBody.indexOf("INSERT INTO published_accas");
  const update = createBody.indexOf("UPDATE builder_publication_candidates");
  const commit = createBody.indexOf('client.query("COMMIT")');

  assert.ok(begin >= 0 && insert > begin, "the insert must follow BEGIN");
  assert.ok(update > insert, "the candidate conversion must follow the insert");
  assert.ok(commit > update, "COMMIT must follow both writes");

  // Both writes go through the transactional client, never the bare pool.
  assert.match(createBody, /client\.query<Row>\(\s*`INSERT INTO published_accas/);
  assert.match(createBody, /client\.query<\{[\s\S]*?\}>\(\s*`UPDATE builder_publication_candidates/);
});

test("POSTGRESQL STRUCTURAL EVIDENCE ONLY: a failed candidate update rolls back before COMMIT", () => {
  // The zero-row branch must ROLLBACK, and every return inside it must come after that.
  const guard = createBody.indexOf("if (converted.rows.length !== 1)");
  const rollback = createBody.indexOf('client.query("ROLLBACK")', guard);
  const commit = createBody.indexOf('client.query("COMMIT")');
  assert.ok(guard > 0, "must diagnose a zero-row candidate update");
  assert.ok(rollback > guard, "the zero-row branch must ROLLBACK");
  assert.ok(commit > rollback, "COMMIT must be unreachable from the rollback branch");

  // The branch returns rather than falling through to COMMIT.
  const branch = createBody.slice(guard, commit);
  assert.match(branch, /return \{ ok: false/, "the rollback branch must return");
});

test("POSTGRESQL STRUCTURAL EVIDENCE ONLY: every caught error rolls back and the client is released in finally", () => {
  assert.match(
    createBody,
    /catch \(err\) \{\s*await client\.query\("ROLLBACK"\)/,
    "the catch must ROLLBACK first",
  );
  assert.match(
    createBody,
    /\} finally \{\s*client\.release\(\);\s*\}/,
    "the client must be released in a finally block",
  );
});

test("POSTGRESQL STRUCTURAL EVIDENCE ONLY: the rollback itself cannot mask the original error", () => {
  // A ROLLBACK that throws must not replace the error being handled.
  assert.match(createBody, /client\.query\("ROLLBACK"\)\.catch\(\(\) => undefined\)/);
});

/* ================================================================== *
 * 2. Candidate conversion predicate
 * ================================================================== */

test("POSTGRESQL STRUCTURAL EVIDENCE ONLY: the candidate update is guarded by status and version", () => {
  assert.match(createBody, /WHERE candidate_id = \$4/, "must key on the candidate id");
  assert.match(createBody, /AND status = \$5/, "must carry the expected-status predicate");
  assert.match(createBody, /AND version = \$6/, "must carry the expected-version predicate");
  assert.match(createBody, /SET status = 'CONVERTED'/, "must target CONVERTED");
  assert.match(createBody, /version = version \+ 1/, "must increment the version exactly once");
  assert.match(createBody, /converted_acca_id = \$3/, "must record the Acca id");
  assert.match(createBody, /RETURNING status, version/, "must return the new state");

  // $5 and $6 are bound to the caller's expectations, and $3 to the inserted Acca id.
  assert.match(createBody, /candidate\.expectedStatus,/);
  assert.match(createBody, /candidate\.expectedVersion,/);
  assert.match(createBody, /insert\.accaId,\s*\n\s*candidate\.candidateId,/);
});

test("POSTGRESQL STRUCTURAL EVIDENCE ONLY: the candidate version is incremented in SQL, never read-modify-written", () => {
  // Scoped to the SET clause. `AND version = $6` in the WHERE clause is the optimistic
  // predicate and is required; what must not exist is an application-computed value being
  // ASSIGNED to the column.
  const setStart = createBody.indexOf("SET status = 'CONVERTED'");
  const setEnd = createBody.indexOf("WHERE candidate_id", setStart);
  assert.ok(setStart > 0 && setEnd > setStart, "could not delimit the SET clause");
  const setClause = createBody.slice(setStart, setEnd);

  assert.equal(
    /version\s*=\s*\$\d+/.test(setClause),
    false,
    "the version must never be set from an application-computed value",
  );
  assert.match(setClause, /version = version \+ 1/);
  // The predicate really is present in the WHERE clause, where it belongs.
  assert.match(createBody.slice(setEnd), /AND version = \$6/);
});

test("POSTGRESQL STRUCTURAL EVIDENCE ONLY: exactly one diagnostic reread classifies a lost race", () => {
  const rereads = createBody.match(/SELECT status, version, converted_acca_id/g) ?? [];
  assert.equal(rereads.length, 1, "exactly one diagnostic reread");
  // It only reads. It must never attempt to repair the state it finds.
  const rereadStart = createBody.indexOf("SELECT status, version, converted_acca_id");
  const tail = createBody.slice(rereadStart);
  assert.equal(/UPDATE |INSERT |DELETE /.test(tail), false, "the diagnostic must not write");
});

/* ================================================================== *
 * 3. Parameterization
 * ================================================================== */

test("POSTGRESQL STRUCTURAL EVIDENCE ONLY: no request value is interpolated into SQL", () => {
  // Every `${...}` inside a SQL template must be a column list or a bind() placeholder.
  const interpolations = adapterSrc.match(/\$\{[^}]+\}/g) ?? [];
  assert.ok(interpolations.length > 0, "sanity: the adapter does use templates");
  for (const token of interpolations) {
    const inner = token.slice(2, -1).trim();
    assert.ok(
      inner === "SELECT_COLUMNS" ||
        inner.startsWith("bind(") ||
        inner.startsWith("values.length") ||
        // The assembled WHERE clause. Safe only because every element of `where` is itself a
        // fixed column name plus a bind() placeholder, which the next test proves.
        inner === 'where.join(" AND ")' ||
        inner === "clause",
      `unparameterized interpolation in SQL: ${token}`,
    );
  }
});

test("POSTGRESQL STRUCTURAL EVIDENCE ONLY: every assembled WHERE predicate binds its value", () => {
  const pushes = [...adapterSrc.matchAll(/where\.push\(([^;]*?)\);/gs)].map((m) => m[1].trim());
  assert.ok(pushes.length >= 7, `expected every filter to be pushed, got ${pushes.length}`);
  for (const predicate of pushes) {
    assert.ok(
      predicate.includes("${bind("),
      `WHERE predicate does not bind its value: ${predicate}`,
    );
    // The left-hand side is a literal column name, never a variable.
    assert.match(
      predicate,
      /^`[a-z_]+ (=|>=|<=) \$\{bind\([^)]*\)\}`$/,
      `WHERE predicate is not a fixed column compared to a placeholder: ${predicate}`,
    );
  }
});

test("POSTGRESQL STRUCTURAL EVIDENCE ONLY: filters bind values and never become column names or sort keys", () => {
  assert.match(adapterSrc, /ORDER BY created_at DESC, acca_id DESC/, "ordering is hard-coded");
  // Counted against executable text: the prose above `listAccas` also says "ORDER BY".
  const orderByCount = (adapterCode.match(/ORDER BY/g) ?? []).length;
  assert.equal(orderByCount, 1, "there must be exactly one, hard-coded ORDER BY");

  // Each filter is a fixed column compared against a bound placeholder.
  for (const column of [
    "status",
    "locale",
    "source_candidate_id",
    "created_at >=",
    "created_at <=",
    "published_at >=",
    "published_at <=",
  ]) {
    assert.ok(
      adapterSrc.includes(`${column} = \${bind(`) || adapterSrc.includes(`${column} \${bind(`),
      `filter on ${column} must be bound`,
    );
  }
});

/* ================================================================== *
 * 4. No generic payload update
 * ================================================================== */

test("POSTGRESQL STRUCTURAL EVIDENCE ONLY: the only UPDATE to published_accas is the lifecycle transition", () => {
  const updates = adapterSrc.match(/UPDATE published_accas/g) ?? [];
  assert.equal(updates.length, 1, "there must be exactly one UPDATE against published_accas");

  const start = adapterSrc.indexOf("UPDATE published_accas");
  const end = adapterSrc.indexOf("RETURNING", start);
  const setClause = adapterSrc.slice(start, end);

  // Only lifecycle columns may be assigned.
  const allowed = [
    "status",
    "version",
    "updated_at",
    "published_at",
    "archived_at",
    "published_by",
    "archived_by",
  ];
  const assignments = [...setClause.matchAll(/^\s*(\w+)\s*=/gm)].map((m) => m[1]);
  assert.ok(assignments.length > 0, "sanity: the update assigns something");
  for (const column of assignments) {
    assert.ok(allowed.includes(column), `lifecycle update must not assign ${column}`);
  }

  // The immutable snapshot columns are never assigned anywhere.
  for (const immutable of [
    "title",
    "summary",
    "locale",
    "slug",
    "legs",
    "combined_odds",
    "evidence_snapshot",
    "qualification_snapshot",
    "source_references",
    "created_at",
    "created_by",
    "source_candidate_id",
  ]) {
    assert.equal(
      new RegExp(`SET[\\s\\S]{0,600}?\\b${immutable}\\s*=`).test(setClause),
      false,
      `${immutable} must never be updated`,
    );
  }
});

test("POSTGRESQL STRUCTURAL EVIDENCE ONLY: no DELETE statement exists", () => {
  assert.equal(/DELETE\s+FROM/i.test(adapterSrc), false, "the adapter must never delete a row");
  assert.equal(/TRUNCATE/i.test(adapterSrc), false);
});

test("POSTGRESQL STRUCTURAL EVIDENCE ONLY: the Acca lifecycle update is guarded like the candidate one", () => {
  const start = adapterSrc.indexOf("UPDATE published_accas");
  const body = adapterSrc.slice(start, start + 1200);
  assert.match(body, /WHERE acca_id = \$4/);
  assert.match(body, /AND status = \$5/);
  assert.match(body, /AND version = \$6/);
  assert.match(body, /version = version \+ 1/);
});

/* ================================================================== *
 * 5. Unique violation classification
 * ================================================================== */

test("POSTGRESQL STRUCTURAL EVIDENCE ONLY: unique violations are classified by constraint name", () => {
  assert.match(adapterSrc, /const UNIQUE_VIOLATION = "23505"/, "must know the SQLSTATE");
  assert.match(createBody, /code === UNIQUE_VIOLATION/);
  assert.match(createBody, /constraint === "published_accas_slug_uidx"/);
  assert.match(createBody, /constraint === "published_accas_source_candidate_uidx"/);
  assert.match(createBody, /code: "slug_conflict"/);
  assert.match(createBody, /code: "acca_already_exists_for_candidate"/);

  // Both constraint names must actually be created by the migration.
  assert.ok(migrationSrc.includes("published_accas_slug_uidx"));
  assert.ok(migrationSrc.includes("published_accas_source_candidate_uidx"));
});

test("POSTGRESQL STRUCTURAL EVIDENCE ONLY: uniqueness is enforced by storage, not only by a pre-check", () => {
  // The adapter performs NO application-side existence check before inserting — it relies on
  // the constraint and classifies the violation. A pre-check would be a race, not a guarantee.
  assert.equal(
    /SELECT[\s\S]{0,200}FROM published_accas[\s\S]{0,200}WHERE slug/.test(createBody),
    false,
    "must not pre-check the slug instead of relying on the unique index",
  );
});

test("POSTGRESQL STRUCTURAL EVIDENCE ONLY: no raw driver text can escape to a caller", () => {
  assert.match(adapterSrc, /err\.message\.slice\(0, 200\)/, "messages must be bounded");
  assert.equal(/err\.stack/.test(adapterSrc), false, "stack traces must never be surfaced");
  assert.equal(/connectionString\s*[,)]/.test(adapterSrc.split("createPostgresAccaStore")[2] ?? ""), false);
});

/* ================================================================== *
 * 6. Migration structure
 * ================================================================== */

test("POSTGRESQL STRUCTURAL EVIDENCE ONLY: the migration is additive and creates one table", () => {
  assert.match(migrationSrc, /CREATE TABLE IF NOT EXISTS published_accas/);
  const creates = migrationSql.match(/CREATE TABLE/g) ?? [];
  assert.equal(creates.length, 1, "must not add unrelated tables");
  // Executable text only. The header documents `DROP TABLE IF EXISTS published_accas;` as the
  // reverse path in a comment, which must not be mistaken for a statement.
  assert.equal(/DROP TABLE/.test(migrationSql), false, "must not drop anything");
  assert.equal(/ALTER TABLE/.test(migrationSql), false, "must not alter an existing table");
  assert.ok(/DROP TABLE IF EXISTS published_accas;/.test(migrationSrc), "reverse path documented");
});

test("POSTGRESQL STRUCTURAL EVIDENCE ONLY: keys, uniqueness and exact types are declared", () => {
  assert.match(migrationSrc, /acca_id\s+TEXT PRIMARY KEY/);
  assert.match(
    migrationSrc,
    /CREATE UNIQUE INDEX IF NOT EXISTS published_accas_source_candidate_uidx\s*\n\s*ON published_accas \(source_candidate_id\)/,
  );
  assert.match(
    migrationSrc,
    /CREATE UNIQUE INDEX IF NOT EXISTS published_accas_slug_uidx\s*\n\s*ON published_accas \(slug\)/,
  );

  // Exact decimal arithmetic, never a floating type.
  assert.match(migrationSrc, /combined_odds\s+NUMERIC\(14,4\)\s+NOT NULL/);
  // Executable text only: the header explains WHY DOUBLE PRECISION was rejected, so the raw
  // source legitimately contains the phrase.
  assert.equal(
    /\b(DOUBLE PRECISION|REAL|FLOAT\d*)\b/i.test(migrationSql),
    false,
    "no floating-point column may hold odds",
  );

  // Snapshots are JSONB.
  for (const column of ["legs", "evidence_snapshot", "qualification_snapshot", "source_references"]) {
    assert.ok(
      new RegExp(`${column}\\s+JSONB\\s+NOT NULL`).test(migrationSrc),
      `${column} must be JSONB NOT NULL`,
    );
  }
});

test("POSTGRESQL STRUCTURAL EVIDENCE ONLY: the unique columns are NOT NULL so uniqueness is total", () => {
  // A nullable unique column would let unlimited NULL rows coexist, which would silently
  // defeat "one candidate, one Acca". Both unique columns are therefore NOT NULL.
  assert.match(migrationSrc, /source_candidate_id\s+TEXT\s+NOT NULL/);
  assert.match(migrationSrc, /slug\s+TEXT\s+NOT NULL/);
});

test("POSTGRESQL STRUCTURAL EVIDENCE ONLY: status, version and actor bounds are declared", () => {
  assert.match(migrationSrc, /CHECK \(status IN \('DRAFT', 'PUBLISHED', 'ARCHIVED'\)\)/);
  assert.match(migrationSrc, /CHECK \(version >= 1\)/);
  assert.match(migrationSrc, /CHECK \(created_by = 'admin'\)/);
  assert.match(migrationSrc, /CHECK \(published_by IS NULL OR published_by = 'admin'\)/);
  assert.match(migrationSrc, /CHECK \(archived_by IS NULL OR archived_by = 'admin'\)/);
  assert.match(migrationSrc, /char_length\(title\) BETWEEN 1 AND 160/);
  assert.match(migrationSrc, /char_length\(summary\) <= 400/);
  assert.match(migrationSrc, /char_length\(locale\) BETWEEN 2 AND 16/);
  assert.match(migrationSrc, /char_length\(slug\) <= 80/);
  assert.match(migrationSrc, /combined_odds > 1 AND combined_odds <= 1000000/);
});

/**
 * The publication/archive consistency matrix from the brief, asserted as behaviour of the two
 * CHECK constraints rather than as text. Each row is evaluated against both predicates.
 */
test("POSTGRESQL STRUCTURAL EVIDENCE ONLY: the lifecycle metadata matrix is exactly enforced", () => {
  const publishedChk = extractCheck("published_accas_published_metadata_chk");
  const archivedChk = extractCheck("published_accas_archived_metadata_chk");

  type Row = {
    status: string;
    publishedAt: boolean;
    publishedBy: boolean;
    archivedAt: boolean;
    archivedBy: boolean;
  };

  const evaluate = (sql: string, row: Row): boolean => {
    const js = sql
      .replace(/published_at IS NOT NULL/g, String(row.publishedAt))
      .replace(/published_at IS NULL/g, String(!row.publishedAt))
      .replace(/published_by IS NOT NULL/g, String(row.publishedBy))
      .replace(/published_by IS NULL/g, String(!row.publishedBy))
      .replace(/archived_at IS NOT NULL/g, String(row.archivedAt))
      .replace(/archived_at IS NULL/g, String(!row.archivedAt))
      .replace(/archived_by IS NOT NULL/g, String(row.archivedBy))
      .replace(/archived_by IS NULL/g, String(!row.archivedBy))
      .replace(/status = '(\w+)'/g, (_m, s: string) => String(row.status === s))
      .replace(/status <> '(\w+)'/g, (_m, s: string) => String(row.status !== s))
      .replace(/\bAND\b/g, "&&")
      .replace(/\bOR\b/g, "||");
    assert.equal(/[a-z_]{3,}/.test(js.replace(/true|false/g, "")), false, `unreduced SQL: ${js}`);
    // eslint-disable-next-line no-new-func
    return Boolean(new Function(`return (${js});`)());
  };

  const legal: Row[] = [
    { status: "DRAFT", publishedAt: false, publishedBy: false, archivedAt: false, archivedBy: false },
    { status: "PUBLISHED", publishedAt: true, publishedBy: true, archivedAt: false, archivedBy: false },
    { status: "ARCHIVED", publishedAt: true, publishedBy: true, archivedAt: true, archivedBy: true },
  ];
  for (const row of legal) {
    assert.ok(evaluate(publishedChk, row), `${row.status} must satisfy the publication check`);
    assert.ok(evaluate(archivedChk, row), `${row.status} must satisfy the archive check`);
  }

  const illegal: Array<[string, Row]> = [
    [
      "DRAFT carrying publication metadata",
      { status: "DRAFT", publishedAt: true, publishedBy: true, archivedAt: false, archivedBy: false },
    ],
    [
      "PUBLISHED without publishedAt",
      { status: "PUBLISHED", publishedAt: false, publishedBy: true, archivedAt: false, archivedBy: false },
    ],
    [
      "PUBLISHED without publishedBy",
      { status: "PUBLISHED", publishedAt: true, publishedBy: false, archivedAt: false, archivedBy: false },
    ],
    [
      "PUBLISHED carrying archive metadata",
      { status: "PUBLISHED", publishedAt: true, publishedBy: true, archivedAt: true, archivedBy: true },
    ],
    [
      "ARCHIVED without prior publication",
      { status: "ARCHIVED", publishedAt: false, publishedBy: false, archivedAt: true, archivedBy: true },
    ],
    [
      "ARCHIVED without archivedAt",
      { status: "ARCHIVED", publishedAt: true, publishedBy: true, archivedAt: false, archivedBy: true },
    ],
    [
      "DRAFT carrying archive metadata",
      { status: "DRAFT", publishedAt: false, publishedBy: false, archivedAt: true, archivedBy: true },
    ],
  ];
  for (const [label, row] of illegal) {
    const accepted = evaluate(publishedChk, row) && evaluate(archivedChk, row);
    assert.equal(accepted, false, `${label} must be rejected by the CHECK constraints`);
  }
});

function extractCheck(name: string): string {
  const marker = `CONSTRAINT ${name}\n    CHECK (`;
  const start = migrationSrc.indexOf(marker);
  assert.ok(start > 0, `missing constraint ${name}`);
  const open = start + marker.length - 1;
  let depth = 0;
  for (let i = open; i < migrationSrc.length; i++) {
    if (migrationSrc[i] === "(") depth++;
    else if (migrationSrc[i] === ")") {
      depth--;
      if (depth === 0) return migrationSrc.slice(open + 1, i);
    }
  }
  throw new Error(`unbalanced parentheses in ${name}`);
}

test("POSTGRESQL STRUCTURAL EVIDENCE ONLY: indexes support the admin and public list queries", () => {
  // Admin listing: the adapter's hard-coded ORDER BY, optionally narrowed by status.
  assert.match(
    migrationSrc,
    /ON published_accas \(status, created_at DESC, acca_id DESC\)/,
    "admin list index must match the adapter ORDER BY",
  );
  // Public listing (B5): partial, so drafts and archives never occupy the public index.
  assert.match(
    migrationSrc,
    /ON published_accas \(published_at DESC, acca_id DESC\)\s*\n\s*WHERE status = 'PUBLISHED'/,
  );
  assert.match(
    migrationSrc,
    /ON published_accas \(locale, published_at DESC\)\s*\n\s*WHERE status = 'PUBLISHED'/,
  );
});

test("POSTGRESQL STRUCTURAL EVIDENCE ONLY: the migration documents that it was not executed", () => {
  assert.match(migrationSrc, /NOT EXECUTED/, "the file must state its execution status");
  assert.match(adapterSrc, /NOT EXECUTED against a real PostgreSQL server/);
});

/* ================================================================== *
 * 7. Adapter/migration agreement
 * ================================================================== */

test("POSTGRESQL STRUCTURAL EVIDENCE ONLY: every column the adapter writes exists in the migration", () => {
  const insertStart = adapterSrc.indexOf("INSERT INTO published_accas (");
  const insertEnd = adapterSrc.indexOf(") VALUES", insertStart);
  const columns = adapterSrc
    .slice(insertStart + "INSERT INTO published_accas (".length, insertEnd)
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);

  assert.ok(columns.length >= 17, `expected the full column list, got ${columns.length}`);
  for (const column of columns) {
    assert.ok(
      new RegExp(`^\\s{2}${column}\\s`, "m").test(migrationSrc),
      `column ${column} is written by the adapter but not declared in the migration`,
    );
  }

  // The placeholder count matches the column count, so no column is silently unbound.
  const values = adapterSrc.slice(insertEnd, adapterSrc.indexOf("RETURNING", insertEnd));
  const placeholders = new Set((values.match(/\$\d+/g) ?? []).map((p) => p));
  assert.equal(placeholders.size, columns.length, "one placeholder per column");
});

test("POSTGRESQL STRUCTURAL EVIDENCE ONLY: the adapter reads back exactly the declared columns", () => {
  const selectStart = adapterSrc.indexOf("const SELECT_COLUMNS = `");
  const selectEnd = adapterSrc.indexOf("`;", selectStart);
  const columns = adapterSrc
    .slice(selectStart, selectEnd)
    .replace("const SELECT_COLUMNS = `", "")
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
  for (const column of columns) {
    assert.ok(
      new RegExp(`^\\s{2}${column}\\s`, "m").test(migrationSrc),
      `selected column ${column} is not declared in the migration`,
    );
  }
});

test("POSTGRESQL STRUCTURAL EVIDENCE ONLY: NUMERIC is parsed once at the adapter boundary", () => {
  // node-postgres returns NUMERIC as a string. If that leaked into the domain, a combined
  // odds value would compare and serialize as text.
  assert.match(adapterSrc, /combined_odds: string \| number/, "the row type must admit a string");
  assert.match(adapterSrc, /Number\(row\.combined_odds\)/, "it must be parsed at the boundary");
});
