import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';

let db: SqlJsDatabase;
let dbPath: string;

export async function initDatabase() {
  const SQL = await initSqlJs();
  dbPath = path.join(app.getPath('userData'), 'xortime.db');

  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      closed_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      category_id INTEGER,
      project_id INTEGER,
      estimated_pomodoros INTEGER DEFAULT 1,
      actual_pomodoros INTEGER DEFAULT 0,
      is_done INTEGER DEFAULT 0,
      is_archived INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      deadline DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,
      FOREIGN KEY (category_id) REFERENCES categories(id),
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );

    CREATE TABLE IF NOT EXISTS daily_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      estimated_pomodoros INTEGER DEFAULT 1,
      actual_pomodoros INTEGER DEFAULT 0,
      internal_interruptions INTEGER DEFAULT 0,
      external_interruptions INTEGER DEFAULT 0,
      is_done INTEGER DEFAULT 0,
      FOREIGN KEY (task_id) REFERENCES tasks(id)
    );

    CREATE TABLE IF NOT EXISTS next_things (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      category_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories(id)
    );

    CREATE TABLE IF NOT EXISTS pomodoro_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER,
      project_id INTEGER,
      duration_minutes INTEGER NOT NULL,
      session_type TEXT NOT NULL,
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,
      FOREIGN KEY (task_id) REFERENCES tasks(id),
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_category ON tasks(category_id);
    CREATE INDEX IF NOT EXISTS idx_daily_tasks_date ON daily_tasks(date);
    CREATE INDEX IF NOT EXISTS idx_daily_tasks_task ON daily_tasks(task_id);
    CREATE INDEX IF NOT EXISTS idx_pomodoro_sessions_task ON pomodoro_sessions(task_id);
    CREATE INDEX IF NOT EXISTS idx_pomodoro_sessions_project ON pomodoro_sessions(project_id);
    CREATE INDEX IF NOT EXISTS idx_pomodoro_sessions_started ON pomodoro_sessions(started_at);
  `);

  try {
    const cols = db.exec("PRAGMA table_info(tasks)");
    const hasDeadline = cols.length > 0 && cols[0].values.some((r: any[]) => r[1] === 'deadline');
    if (!hasDeadline) {
      db.run('ALTER TABLE tasks ADD COLUMN deadline DATETIME');
      save();
    }
  } catch {}

  try {
    const cols = db.exec("PRAGMA table_info(pomodoro_sessions)");
    const names = cols.length > 0 ? cols[0].values.map((r: any[]) => r[1]) : [];
    if (!names.includes('status')) {
      db.run("ALTER TABLE pomodoro_sessions ADD COLUMN status TEXT DEFAULT 'completed'");
      save();
    }
    if (!names.includes('actual_minutes')) {
      db.run('ALTER TABLE pomodoro_sessions ADD COLUMN actual_minutes INTEGER');
      save();
    }
  } catch {}

  try {
    const taskCols = db.exec("PRAGMA table_info(tasks)");
    const taskNames = taskCols.length > 0 ? taskCols[0].values.map((r: any[]) => r[1]) : [];
    if (!taskNames.includes('is_recurring')) {
      db.run('ALTER TABLE tasks ADD COLUMN is_recurring INTEGER DEFAULT 0');
      save();
    }
  } catch {}

  const categoryCount = db.exec('SELECT COUNT(*) as count FROM categories');
  const count = categoryCount.length > 0 ? (categoryCount[0].values[0][0] as number) : 0;
  if (count === 0) {
    const defaultCategories = [
      ['无', '--', 0],
      ['红色', '#ef4444', 1],
      ['黄色', '#eab308', 2],
      ['绿色', '#22c55e', 3],
      ['青色', '#06b6d4', 4],
      ['粉色', '#ec4899', 5],
      ['蓝色', '#3b82f6', 6],
      ['橙色', '#f97316', 7],
      ['深绿', '#15803d', 8],
      ['紫色', '#a855f7', 9],
      ['灰色', '#6b7280', 10],
      ['黑色', '#000000', 11],
      ['紫红', '#d946ef', 12],
    ];
    for (const [name, color, order] of defaultCategories) {
      db.run('INSERT INTO categories (name, color, sort_order) VALUES (?, ?, ?)', [name, color, order]);
    }
  }

  const settingCount = db.exec('SELECT COUNT(*) as count FROM settings');
  const sCount = settingCount.length > 0 ? (settingCount[0].values[0][0] as number) : 0;
  if (sCount === 0) {
    const defaultSettings = [
      ['pomodoro_minutes', '25'],
      ['break_minutes', '5'],
      ['long_break_minutes', '15'],
      ['pomodoros_until_long_break', '4'],
      ['play_alarm', '1'],
      ['play_ticking', '0'],
      ['minimize_to_tray', '1'],
      ['auto_start_break', '0'],
      ['auto_start_pomodoro', '0'],
    ];
    for (const [key, value] of defaultSettings) {
      db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);
    }
  }

  save();
}

export function save() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

export function getDb(): SqlJsDatabase {
  if (!db) {
    throw new Error('Database not initialized');
  }
  return db;
}

export function queryAll(sql: string, params: any[] = []): any[] {
  const results = db.exec(sql, params);
  if (results.length === 0) return [];
  const { columns, values } = results[0];
  return values.map((row: any[]) => {
    const obj: any = {};
    columns.forEach((col: string, i: number) => {
      obj[col] = row[i];
    });
    return obj;
  });
}

export function queryOne(sql: string, params: any[] = []): any | null {
  const results = queryAll(sql, params);
  return results.length > 0 ? results[0] : null;
}

export function runSql(sql: string, params: any[] = []): { lastInsertRowid: number; changes: number } {
  db.run(sql, params);
  const idResult = db.exec('SELECT last_insert_rowid()');
  const changesResult = db.exec('SELECT changes()');
  save();
  return {
    lastInsertRowid: idResult.length > 0 ? (idResult[0].values[0][0] as number) : 0,
    changes: changesResult.length > 0 ? (changesResult[0].values[0][0] as number) : 0,
  };
}
