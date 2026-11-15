import fs from 'node:fs';
import path from 'node:path';
import initSqlJs, { Database as SqlJsDatabase, SqlValue } from 'sql.js';

export class SqliteStore {
  private db: SqlJsDatabase;
  private filePath: string | null;

  private constructor(db: SqlJsDatabase, filePath: string | null) {
    this.db = db;
    this.filePath = filePath;
  }

  static async open(dbPath: string): Promise<SqliteStore> {
    const SQL = await initSqlJs();
    const isMemory = dbPath === ':memory:';
    let db: SqlJsDatabase;

    if (!isMemory && fs.existsSync(dbPath)) {
      const buffer = fs.readFileSync(dbPath);
      db = new SQL.Database(buffer);
    } else {
      db = new SQL.Database();
    }

    const store = new SqliteStore(db, isMemory ? null : dbPath);
    store.initializeSchema();
    return store;
  }

  private initializeSchema(): void {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS couriers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        rating REAL NOT NULL,
        completed_deliveries INTEGER NOT NULL,
        vehicle_model TEXT NOT NULL,
        vehicle_class TEXT NOT NULL,
        license_plate TEXT NOT NULL,
        phone TEXT NOT NULL DEFAULT '+48 500 100 200',
        bio TEXT NOT NULL DEFAULT '',
        current_address TEXT NOT NULL DEFAULT '',
        trunk_length_cm INTEGER NOT NULL,
        trunk_width_cm INTEGER NOT NULL,
        trunk_height_cm INTEGER NOT NULL,
        trunk_max_weight_kg INTEGER NOT NULL,
        trunk_volume_liters INTEGER NOT NULL,
        current_hub TEXT NOT NULL,
        destination_hub TEXT NOT NULL,
        available_from TEXT NOT NULL,
        price_per_km_pln REAL NOT NULL,
        status TEXT NOT NULL,
        avatar_initials TEXT NOT NULL,
        map_x REAL NOT NULL,
        map_y REAL NOT NULL
      );

      CREATE TABLE IF NOT EXISTS shipments (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        business_name TEXT NOT NULL,
        direction TEXT NOT NULL,
        pickup_hub TEXT NOT NULL,
        pickup_address TEXT NOT NULL,
        pickup_map_x REAL,
        pickup_map_y REAL,
        dropoff_hub TEXT NOT NULL,
        dropoff_address TEXT NOT NULL,
        dropoff_map_x REAL,
        dropoff_map_y REAL,
        distance_km REAL NOT NULL,
        cargo_description TEXT NOT NULL,
        estimate_json TEXT NOT NULL,
        status TEXT NOT NULL,
        assigned_courier_id TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (assigned_courier_id) REFERENCES couriers(id)
      );

      CREATE TABLE IF NOT EXISTS courier_messages (
        id TEXT PRIMARY KEY,
        courier_id TEXT NOT NULL,
        sender TEXT NOT NULL,
        sender_name TEXT NOT NULL,
        text TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (courier_id) REFERENCES couriers(id)
      );

      CREATE TABLE IF NOT EXISTS monthly_metrics (
        month_index INTEGER PRIMARY KEY,
        month TEXT NOT NULL,
        outbound_pln INTEGER NOT NULL,
        inbound_pln INTEGER NOT NULL,
        outbound_count INTEGER NOT NULL,
        inbound_count INTEGER NOT NULL,
        co2_saved_kg INTEGER NOT NULL
      );
    `);
    this.ensureColumns('couriers', [
      ['phone', "TEXT NOT NULL DEFAULT '+48 500 100 200'"],
      ['bio', "TEXT NOT NULL DEFAULT ''"],
      ['current_address', "TEXT NOT NULL DEFAULT ''"],
    ]);
    this.ensureColumns('shipments', [
      ['pickup_map_x', 'REAL'],
      ['pickup_map_y', 'REAL'],
      ['dropoff_map_x', 'REAL'],
      ['dropoff_map_y', 'REAL'],
    ]);
    this.persist();
  }

  private ensureColumns(table: string, columns: Array<[string, string]>): void {
    const existing = new Set(
      this.queryAll<{ name: string }>(`PRAGMA table_info(${table})`).map((row) => row.name)
    );
    for (const [col, def] of columns) {
      if (!existing.has(col)) {
        this.db.run(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`);
      }
    }
  }

  queryAll<T = Record<string, unknown>>(sql: string, params: SqlValue[] = []): T[] {
    const stmt = this.db.prepare(sql);
    stmt.bind(params);
    const rows: T[] = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject() as T);
    }
    stmt.free();
    return rows;
  }

  queryOne<T = Record<string, unknown>>(sql: string, params: SqlValue[] = []): T | null {
    const rows = this.queryAll<T>(sql, params);
    return rows[0] ?? null;
  }

  execute(sql: string, params: SqlValue[] = []): void {
    const stmt = this.db.prepare(sql);
    stmt.run(params);
    stmt.free();
    this.persist();
  }

  executeBatch(callback: (db: SqlJsDatabase) => void): void {
    callback(this.db);
    this.persist();
  }

  persist(): void {
    if (!this.filePath) {
      return;
    }
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const data = this.db.export();
    fs.writeFileSync(this.filePath, Buffer.from(data));
  }

  close(): void {
    this.db.close();
  }
}
