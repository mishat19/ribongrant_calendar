import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import type { SQLiteDatabase } from 'expo-sqlite';
import { deserializeDatabaseAsync } from 'expo-sqlite';

const TABLES = [
  'events',
  'members',
  'missions',
  'member_missions',
  'availabilities',
  'attributions',
  'mission_slots',
] as const;

type TableName = (typeof TABLES)[number];

const SQLITE_HEADER = 'SQLite format 3\u0000';

function assertSqliteFile(bytes: Uint8Array): void {
  const header = Array.from(bytes.slice(0, 16))
    .map((b) => String.fromCharCode(b))
    .join('');
  if (header !== SQLITE_HEADER) {
    throw new Error('Ce fichier n’est pas une base de données SQLite valide.');
  }
}

function fileStamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

export interface ExportResult {
  uri: string;
  fileName: string;
  size: number;
  shared: boolean;
}

export async function exportDatabase(db: SQLiteDatabase): Promise<ExportResult> {
  const bytes = await db.serializeAsync();
  const fileName = `ribongrant-calendar-${fileStamp()}.db`;
  const file = new File(Paths.cache, fileName);
  if (file.exists) file.delete();
  file.create();
  file.write(bytes);

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    try {
      await Sharing.shareAsync(file.uri, {
        mimeType: 'application/octet-stream',
        dialogTitle: 'Partager la base de données Ribongrant Calendar',
        UTI: 'public.database',
      });
    } catch (err) {
      const fallbackUri = file.uri.startsWith('file://') ? file.uri : `file://${file.uri}`;
      await Sharing.shareAsync(fallbackUri, {
        mimeType: 'application/octet-stream',
        dialogTitle: 'Partager la base de données Ribongrant Calendar',
        UTI: 'public.database',
      });
    }
  }
  return { uri: file.uri, fileName, size: bytes.byteLength, shared: canShare };
}

export interface ImportResult {
  fileName: string;
  counts: Record<TableName, number>;
}

async function countRows(db: SQLiteDatabase, table: TableName): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`);
  return row?.n ?? 0;
}

async function readTable(db: SQLiteDatabase, table: TableName): Promise<Record<string, unknown>[]> {
  return db.getAllAsync<Record<string, unknown>>(`SELECT * FROM ${table}`);
}

interface ColumnInfo {
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
}

/**
 * Colonnes de la table destination : l'import ne copie que les colonnes
 * communes. Une base du bureau a par exemple `events.created_at`, absente du
 * schema mobile : sans ce filtre l'import echoue entierement.
 */
async function destinationColumns(
  db: SQLiteDatabase,
  table: TableName
): Promise<ColumnInfo[]> {
  return db.getAllAsync<ColumnInfo>(`PRAGMA table_info(${table})`);
}

async function importBytes(db: SQLiteDatabase, bytes: Uint8Array): Promise<ImportResult> {
  assertSqliteFile(bytes);

  const tmp = await deserializeDatabaseAsync(bytes);
  try {
    const tableCheck = await tmp.getAllAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table'"
    );
    const present = new Set(tableCheck.map((r) => r.name));
    for (const table of TABLES) {
      if (!present.has(table)) {
        throw new Error(`Base invalide : table « ${table} » manquante.`);
      }
    }

    const snapshot: Record<TableName, Record<string, unknown>[]> = {} as Record<
      TableName,
      Record<string, unknown>[]
    >;
    const schemas: Record<TableName, ColumnInfo[]> = {} as Record<TableName, ColumnInfo[]>;
    for (const table of TABLES) {
      snapshot[table] = await readTable(tmp, table);
      schemas[table] = await destinationColumns(db, table);
    }

    await db.withTransactionAsync(async () => {
      await db.execAsync('PRAGMA foreign_keys = OFF');
      for (const table of TABLES) {
        await db.runAsync(`DELETE FROM ${table}`);
      }
      for (const table of TABLES) {
        const infos = schemas[table];
        const allowed = new Set(infos.map((c) => c.name));
        const required = infos.filter((c) => c.notnull === 1 && c.dflt_value === null);
        for (const row of snapshot[table]) {
          const columns = Object.keys(row).filter((c) => allowed.has(c));
          if (columns.length === 0) continue;
          const placeholders = columns.map(() => '?').join(', ');
          const values = columns.map((name) => {
            const value = row[name];
            if (value !== null && value !== undefined) return value as never;
            const info = required.find((c) => c.name === name);
            if (!info) return null as never;
            // colonne NOT NULL sans defaut absente de la source : on la remplit
            return (info.type.toUpperCase().includes('INT') ? 0 : '') as never;
          });
          await db.runAsync(
            `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`,
            ...values
          );
        }
      }
      await db.execAsync('PRAGMA foreign_keys = ON');
    });

    const counts = {} as Record<TableName, number>;
    for (const table of TABLES) {
      counts[table] = await countRows(db, table);
    }
    return { fileName: '', counts };
  } finally {
    await tmp.closeAsync().catch(() => undefined);
  }
}

export async function pickAndImportDatabase(db: SQLiteDatabase): Promise<ImportResult | null> {
  const picked = await DocumentPicker.getDocumentAsync({
    type: ['application/octet-stream', 'application/vnd.sqlite3', '*/*'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (picked.canceled || picked.assets.length === 0) return null;

  const asset = picked.assets[0];
  const bytes = new Uint8Array(await new File(asset.uri).arrayBuffer());
  const result = await importBytes(db, bytes);
  return { ...result, fileName: asset.name };
}
