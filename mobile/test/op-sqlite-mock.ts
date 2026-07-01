/**
 * Dependency-free op-sqlite mock for Vitest.
 *
 * Mirrors the subset of the `@op-engineering/op-sqlite` API used by the app
 * (open / execute / executeSync / transaction / close), backed by plain
 * in-memory JS structures. It is NOT a general SQL engine: it understands only
 * the specific statement shapes the session repository issues (CREATE, INSERT
 * with optional UPSERT, DELETE, SELECT with WHERE/ORDER BY/LIMIT and a MAX
 * aggregate). This runs on any Node version — no `node:sqlite` required.
 *
 * Databases are cached by name so re-opening the same name shares data,
 * mimicking on-disk persistence across app launches.
 */

type Scalar = string | number | boolean | null;
type Row = Record<string, Scalar>;
type Tables = Map<string, Row[]>;

interface QueryResult {
  insertId?: number;
  rowsAffected: number;
  rows: Row[];
}

interface Transaction {
  execute: (query: string, params?: Scalar[]) => Promise<QueryResult>;
}

export interface MockDB {
  execute: (query: string, params?: Scalar[]) => Promise<QueryResult>;
  executeSync: (query: string, params?: Scalar[]) => QueryResult;
  transaction: (fn: (tx: Transaction) => Promise<void>) => Promise<void>;
  close: () => void;
  delete: () => void;
}

const databases = new Map<string, Tables>();

// =============================================================================
// Statement parsing / execution
// =============================================================================

function getTable(tables: Tables, name: string): Row[] {
  let table = tables.get(name);
  if (!table) {
    table = [];
    tables.set(name, table);
  }
  return table;
}

function splitList(list: string): string[] {
  return list.split(',').map((part) => part.trim());
}

interface Condition {
  col: string;
  op: '=' | '>=' | '<=';
  value: Scalar;
}

function parseConditions(where: string, params: Scalar[], cursor: { i: number }): Condition[] {
  return where.split(/ AND /i).map((raw) => {
    const match = raw.trim().match(/^(\w+) (=|>=|<=) (\?|'.*?'|-?\d+(?:\.\d+)?)$/);
    if (!match) throw new Error(`Unsupported condition: ${raw}`);
    const [, col, op, token] = match;
    let value: Scalar;
    if (token === '?') value = params[cursor.i++];
    else if (token.startsWith("'")) value = token.slice(1, -1);
    else value = Number(token);
    return { col, op: op as Condition['op'], value };
  });
}

function matches(row: Row, conditions: Condition[]): boolean {
  return conditions.every(({ col, op, value }) => {
    const cell = row[col];
    if (op === '=') return cell === value;
    if (op === '>=') return (cell as number) >= (value as number);
    return (cell as number) <= (value as number);
  });
}

function compareCells(a: Scalar, b: Scalar): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b));
}

function applyOrderBy(rows: Row[], orderBy: string): void {
  const keys = splitList(orderBy).map((part) => {
    const [col, dir] = part.split(/\s+/);
    return { col, desc: /desc/i.test(dir ?? '') };
  });
  rows.sort((a, b) => {
    for (const { col, desc } of keys) {
      const cmp = compareCells(a[col], b[col]);
      if (cmp !== 0) return desc ? -cmp : cmp;
    }
    return 0;
  });
}

function handleInsert(tables: Tables, query: string, params: Scalar[]): QueryResult {
  const match = query.match(
    /^INSERT INTO (\w+) \(([^)]+)\) VALUES \(([^)]+)\)(?: ON CONFLICT\((\w+)\) DO UPDATE SET (.+))?$/i
  );
  if (!match) throw new Error(`Unsupported INSERT: ${query}`);
  const [, name, colList, , conflictKey, updateClause] = match;
  const cols = splitList(colList);
  const row: Row = {};
  cols.forEach((col, index) => (row[col] = params[index]));
  const table = getTable(tables, name);

  if (conflictKey) {
    const existing = table.find((r) => r[conflictKey] === row[conflictKey]);
    if (existing) {
      applyUpsert(existing, row, updateClause);
      return { rows: [], rowsAffected: 1 };
    }
  }
  table.push(row);
  return { rows: [], rowsAffected: 1, insertId: table.length };
}

function applyUpsert(existing: Row, incoming: Row, updateClause: string): void {
  for (const assignment of splitList(updateClause)) {
    const [target, source] = assignment.split('=').map((s) => s.trim());
    existing[target] = incoming[source.replace(/^excluded\./i, '')];
  }
}

function handleDelete(tables: Tables, query: string, params: Scalar[]): QueryResult {
  const match = query.match(/^DELETE FROM (\w+)(?: WHERE (.+))?$/i);
  if (!match) throw new Error(`Unsupported DELETE: ${query}`);
  const [, name, where] = match;
  const table = getTable(tables, name);
  const before = table.length;
  const conditions = where ? parseConditions(where, params, { i: 0 }) : null;
  const kept = conditions ? table.filter((row) => !matches(row, conditions)) : [];
  tables.set(name, kept);
  return { rows: [], rowsAffected: before - kept.length };
}

function handleAggregate(tables: Tables, query: string): QueryResult | null {
  const match = query.match(/^SELECT COALESCE\(MAX\((\w+)\), ?0\) AS (\w+) FROM (\w+)$/i);
  if (!match) return null;
  const [, col, alias, name] = match;
  const values = getTable(tables, name).map((row) => Number(row[col]));
  const max = values.length > 0 ? Math.max(...values) : 0;
  return { rows: [{ [alias]: max }], rowsAffected: 0 };
}

function handleSelect(tables: Tables, query: string, params: Scalar[]): QueryResult {
  const aggregate = handleAggregate(tables, query);
  if (aggregate) return aggregate;

  const body = query.slice('SELECT '.length);
  const fromIdx = body.search(/ FROM /i);
  const selectList = body.slice(0, fromIdx).trim();
  const rest = body.slice(fromIdx + ' FROM '.length);
  const name = rest.match(/^(\w+)/)![1];
  const clauses = rest.slice(name.length);

  const where = clauses.match(/ WHERE (.+?)(?= ORDER BY | LIMIT |$)/i)?.[1];
  const orderBy = clauses.match(/ ORDER BY (.+?)(?= LIMIT |$)/i)?.[1];
  const limit = clauses.match(/ LIMIT (\?|\d+)/i)?.[1];

  const cursor = { i: 0 };
  let rows = getTable(tables, name).map((row) => ({ ...row }));
  if (where) {
    const conditions = parseConditions(where, params, cursor);
    rows = rows.filter((row) => matches(row, conditions));
  }
  if (orderBy) applyOrderBy(rows, orderBy);
  if (limit !== undefined) {
    const count = limit === '?' ? Number(params[cursor.i++]) : Number(limit);
    rows = rows.slice(0, count);
  }
  return { rows: project(rows, selectList), rowsAffected: 0 };
}

function project(rows: Row[], selectList: string): Row[] {
  if (selectList === '*') return rows;
  const cols = splitList(selectList);
  return rows.map((row) => Object.fromEntries(cols.map((col) => [col, row[col]])) as Row);
}

function runQuery(tables: Tables, query: string, params: Scalar[] = []): QueryResult {
  const q = query.replace(/\s+/g, ' ').trim();
  if (/^CREATE TABLE/i.test(q)) {
    getTable(tables, q.match(/^CREATE TABLE (?:IF NOT EXISTS )?(\w+)/i)![1]);
    return { rows: [], rowsAffected: 0 };
  }
  if (/^CREATE INDEX/i.test(q)) return { rows: [], rowsAffected: 0 };
  if (/^INSERT INTO/i.test(q)) return handleInsert(tables, q, params);
  if (/^DELETE FROM/i.test(q)) return handleDelete(tables, q, params);
  if (/^SELECT/i.test(q)) return handleSelect(tables, q, params);
  throw new Error(`Unsupported statement: ${q}`);
}

// =============================================================================
// DB factory + transactions
// =============================================================================

function cloneTables(tables: Tables): Tables {
  const copy: Tables = new Map();
  for (const [name, rows] of tables) copy.set(name, rows.map((row) => ({ ...row })));
  return copy;
}

function restoreTables(target: Tables, snapshot: Tables): void {
  target.clear();
  for (const [name, rows] of snapshot) target.set(name, rows.map((row) => ({ ...row })));
}

function makeDB(tables: Tables, key: string): MockDB {
  const execute = async (query: string, params?: Scalar[]) => runQuery(tables, query, params);
  return {
    execute,
    executeSync: (query, params) => runQuery(tables, query, params),
    async transaction(fn) {
      const snapshot = cloneTables(tables);
      try {
        await fn({ execute });
      } catch (error) {
        restoreTables(tables, snapshot);
        throw error;
      }
    },
    close: () => {},
    delete: () => databases.delete(key),
  };
}

export function open(params: { name: string; location?: string }): MockDB {
  const key = params.location ? `${params.location}:${params.name}` : params.name;
  let tables = databases.get(key);
  if (!tables) {
    tables = new Map();
    databases.set(key, tables);
  }
  return makeDB(tables, key);
}

export const openSync = open;

export const IOS_LIBRARY_PATH = ':memory:';
export const ANDROID_DATABASE_PATH = ':memory:';

/** Test helper: drop all cached in-memory databases. */
export function __resetMockDatabases(): void {
  databases.clear();
}
