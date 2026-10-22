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

/**
 * Une base SQLite en mode WAL porte la version 2 dans son en-tête (octets 18
 * et 19). Ouvrir ou désérialiser une telle image sans le fichier `-wal` qui
 * l'accompagne échoue avec SQLITE_CANTOPEN (« unable to open database file »),
 * ce qui faisait échouer l'import. On repasse l'en-tête en mode « rollback
 * journal » (1/1) : le contenu est identique, mais l'image devient autonome.
 */
function toStandaloneImage(bytes: Uint8Array): Uint8Array {
  if (bytes.length < 20) return bytes;
  if (bytes[18] !== 2 && bytes[19] !== 2) return bytes;
  const standalone = new Uint8Array(bytes);
  standalone[18] = 1;
  standalone[19] = 1;
  return standalone;
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
  const bytes = toStandaloneImage(await db.serializeAsync());
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

  const tmp = await deserializeDatabaseAsync(toStandaloneImage(bytes));
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

    // `PRAGMA foreign_keys` est ignore a l'interieur d'une transaction : il
    // doit etre bascule avant, puis remis dans son etat initial apres.
    const foreignKeys = await db.getFirstAsync<{ foreign_keys: number }>('PRAGMA foreign_keys');
    await db.execAsync('PRAGMA foreign_keys = OFF');
    try {
      await db.withTransactionAsync(async () => {
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
      });
    } finally {
      if (foreignKeys?.foreign_keys) {
        await db.execAsync('PRAGMA foreign_keys = ON');
      }
    }

    const counts = {} as Record<TableName, number>;
    for (const table of TABLES) {
      counts[table] = await countRows(db, table);
    }
    return { fileName: '', counts };
  } finally {
    await tmp.closeAsync().catch(() => undefined);
  }
}

/**
 * Lit le fichier choisi par l'utilisateur.
 *
 * expo-file-system applique un contrôle de permission sur les URI `file://` :
 * un chemin qui n'est pas dans le bac à sable de l'app est refusé (« Missing
 * 'READ' permission for accessing the file »). Les URI `content://` renvoyés
 * par le sélecteur système sont eux toujours lisibles (accès direct via le
 * ContentResolver), c'est donc cette forme qu'on conserve.
 */
async function readPickedBytes(uri: string): Promise<Uint8Array> {
  try {
    return await new File(uri).bytes();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/READ' permission/i.test(message)) {
      throw new Error(
        "Le fichier choisi n’a pas pu être lu par l’application. Réessaie en le copiant d’abord dans le dossier « Téléchargements » de l’appareil."
      );
    }
    throw err;
  }
}

export async function pickAndImportDatabase(db: SQLiteDatabase): Promise<ImportResult | null> {
  const picked = await DocumentPicker.getDocumentAsync({
    type: ['application/octet-stream', 'application/vnd.sqlite3', '*/*'],
    // On garde l'URI `content://` du sélecteur système plutôt que la copie
    // `file://` dans le cache : c'est le seul type d'URI que le contrôle de
    // permission d'expo-file-system laisse passer sur Android.
    copyToCacheDirectory: false,
    multiple: false,
  });
  if (picked.canceled || picked.assets.length === 0) return null;

  const asset = picked.assets[0];
  const bytes = await readPickedBytes(asset.uri);
  const result = await importBytes(db, bytes);
  return { ...result, fileName: asset.name };
}
