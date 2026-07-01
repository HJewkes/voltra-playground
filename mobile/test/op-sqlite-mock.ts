/**
 * op-sqlite mock for Vitest (Node environment).
 *
 * Mirrors the subset of the `@op-engineering/op-sqlite` API used by the app,
 * backed by Node's built-in `node:sqlite` engine so contract tests exercise
 * real SQL. Databases are cached by name so re-opening the same name returns
 * the same in-memory data (mimics on-disk persistence across app launches).
 */

import { DatabaseSync } from 'node:sqlite';

type Scalar = string | number | boolean | null;

interface QueryResult {
  insertId?: number;
  rowsAffected: number;
  rows: Array<Record<string, Scalar>>;
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

const databases = new Map<string, DatabaseSync>();

function isSelect(query: string): boolean {
  return /^\s*(SELECT|PRAGMA)\b/i.test(query);
}

type BindValue = string | number | null;

function runQuery(db: DatabaseSync, query: string, params: Scalar[] = []): QueryResult {
  const bind = params as BindValue[];
  const stmt = db.prepare(query);
  if (isSelect(query)) {
    const rows = stmt.all(...bind) as unknown as Array<Record<string, Scalar>>;
    return { rows, rowsAffected: 0 };
  }
  const info = stmt.run(...bind);
  return {
    rows: [],
    rowsAffected: Number(info.changes),
    insertId: Number(info.lastInsertRowid),
  };
}

function makeDB(db: DatabaseSync, key: string): MockDB {
  const execute = async (query: string, params?: Scalar[]) => runQuery(db, query, params);
  return {
    execute,
    executeSync: (query, params) => runQuery(db, query, params),
    async transaction(fn) {
      db.exec('BEGIN');
      try {
        await fn({ execute });
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    close: () => {},
    delete: () => {
      db.close();
      databases.delete(key);
    },
  };
}

export function open(params: { name: string; location?: string }): MockDB {
  const key = params.location ? `${params.location}:${params.name}` : params.name;
  let db = databases.get(key);
  if (!db) {
    db = new DatabaseSync(':memory:');
    databases.set(key, db);
  }
  return makeDB(db, key);
}

export const openSync = open;

export const IOS_LIBRARY_PATH = ':memory:';
export const ANDROID_DATABASE_PATH = ':memory:';

/** Test helper: drop all cached in-memory databases. */
export function __resetMockDatabases(): void {
  for (const db of databases.values()) db.close();
  databases.clear();
}
