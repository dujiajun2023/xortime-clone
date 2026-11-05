import { ipcMain } from 'electron';
import { queryAll, runSql } from './database';

export function registerIpcHandlers() {
  // Pomodoro sessions
  ipcMain.handle('start-pomodoro-session', (_, taskId, projectId, duration, type) => {
    const result = runSql(
      `INSERT INTO pomodoro_sessions (task_id, project_id, duration_minutes, session_type, started_at)
       VALUES (?, ?, ?, ?, datetime('now'))`,
      [taskId, projectId, duration, type]
    );
    return { id: result.lastInsertRowid };
  });

  ipcMain.handle('complete-pomodoro-session', (_, sessionId) => {
    runSql(
      `UPDATE pomodoro_sessions
       SET completed_at = datetime('now'), status = 'completed', actual_minutes = duration_minutes
       WHERE id = ?`,
      [sessionId]
    );
    return { success: true };
  });

  ipcMain.handle('break-pomodoro-session', (_, sessionId, actualMinutes) => {
    runSql(
      `UPDATE pomodoro_sessions
       SET completed_at = datetime('now'), status = 'broken', actual_minutes = ?
       WHERE id = ?`,
      [actualMinutes, sessionId]
    );
    return { success: true };
  });

  ipcMain.handle('get-pomodoro-sessions', (_, filters = {}) => {
    let query = 'SELECT * FROM pomodoro_sessions WHERE 1=1';
    const params: any[] = [];

    if (filters.taskId) {
      query += ' AND task_id = ?';
      params.push(filters.taskId);
    }
    if (filters.projectId) {
      query += ' AND project_id = ?';
      params.push(filters.projectId);
    }
    if (filters.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }
    if (filters.startDate) {
      query += ' AND date(started_at) >= ?';
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      query += ' AND date(started_at) <= ?';
      params.push(filters.endDate);
    }

    query += ' ORDER BY started_at DESC';
    return queryAll(query, params);
  });

  // Tasks
  ipcMain.handle('create-task', (_, task) => {
    const result = runSql(
      `INSERT INTO tasks (title, description, category_id, project_id, estimated_pomodoros, actual_pomodoros, is_done, is_archived, sort_order, deadline)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        task.title,
        task.description,
        task.category_id,
        task.project_id,
        task.estimated_pomodoros,
        task.actual_pomodoros,
        task.is_done ? 1 : 0,
        task.is_archived ? 1 : 0,
        task.sort_order,
        task.deadline,
      ]
    );
    return { id: result.lastInsertRowid };
  });

  ipcMain.handle('update-task', (_, id, task) => {
    const fields: string[] = [];
    const params: any[] = [];

    if (task.title !== undefined) {
      fields.push('title = ?');
      params.push(task.title);
    }
    if (task.description !== undefined) {
      fields.push('description = ?');
      params.push(task.description);
    }
    if (task.category_id !== undefined) {
      fields.push('category_id = ?');
      params.push(task.category_id);
    }
    if (task.project_id !== undefined) {
      fields.push('project_id = ?');
      params.push(task.project_id);
    }
    if (task.estimated_pomodoros !== undefined) {
      fields.push('estimated_pomodoros = ?');
      params.push(task.estimated_pomodoros);
    }
    if (task.actual_pomodoros !== undefined) {
      fields.push('actual_pomodoros = ?');
      params.push(task.actual_pomodoros);
    }
    if (task.is_done !== undefined) {
      fields.push('is_done = ?');
      params.push(task.is_done ? 1 : 0);
      if (task.is_done) {
        fields.push("completed_at = datetime('now')");
      }
    }
    if (task.is_archived !== undefined) {
      fields.push('is_archived = ?');
      params.push(task.is_archived ? 1 : 0);
    }
    if (task.sort_order !== undefined) {
      fields.push('sort_order = ?');
      params.push(task.sort_order);
    }
    if (task.deadline !== undefined) {
      fields.push('deadline = ?');
      params.push(task.deadline);
    }
    if (task.is_recurring !== undefined) {
      fields.push('is_recurring = ?');
      params.push(task.is_recurring ? 1 : 0);
    }

    if (fields.length === 0) return { success: false };

    params.push(id);
    runSql(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`, params);
    return { success: true };
  });

  ipcMain.handle('delete-task', (_, id) => {
    runSql('UPDATE tasks SET is_archived = 1 WHERE id = ?', [id]);
    return { success: true };
  });

  ipcMain.handle('restore-task', (_, id) => {
    runSql('UPDATE tasks SET is_archived = 0, is_done = 0, completed_at = NULL WHERE id = ?', [id]);
    return { success: true };
  });

  ipcMain.handle('permanent-delete-task', (_, id) => {
    runSql('DELETE FROM tasks WHERE id = ?', [id]);
    return { success: true };
  });

  ipcMain.handle('get-tasks', (_, filters = {}) => {
    let query = 'SELECT * FROM tasks WHERE 1=1';
    const params: any[] = [];

    if (filters.projectId !== undefined) {
      query += ' AND project_id = ?';
      params.push(filters.projectId);
    }
    if (filters.categoryId !== undefined) {
      query += ' AND category_id = ?';
      params.push(filters.categoryId);
    }
    if (filters.isDone !== undefined) {
      query += ' AND is_done = ?';
      params.push(filters.isDone ? 1 : 0);
    }
    if (filters.isArchived !== undefined) {
      query += ' AND is_archived = ?';
      params.push(filters.isArchived ? 1 : 0);
    }

    query += ' ORDER BY sort_order ASC, created_at DESC';
    return queryAll(query, params);
  });

  // Daily tasks
  ipcMain.handle('create-daily-task', (_, dailyTask) => {
    const result = runSql(
      `INSERT OR IGNORE INTO daily_tasks (task_id, date, estimated_pomodoros, actual_pomodoros, internal_interruptions, external_interruptions, is_done)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        dailyTask.task_id,
        dailyTask.date,
        dailyTask.estimated_pomodoros,
        dailyTask.actual_pomodoros,
        dailyTask.internal_interruptions,
        dailyTask.external_interruptions,
        dailyTask.is_done ? 1 : 0,
      ]
    );
    return { id: result.lastInsertRowid };
  });

  ipcMain.handle('update-daily-task', (_, id, dailyTask) => {
    const fields: string[] = [];
    const params: any[] = [];

    if (dailyTask.estimated_pomodoros !== undefined) {
      fields.push('estimated_pomodoros = ?');
      params.push(dailyTask.estimated_pomodoros);
    }
    if (dailyTask.actual_pomodoros !== undefined) {
      fields.push('actual_pomodoros = ?');
      params.push(dailyTask.actual_pomodoros);
    }
    if (dailyTask.internal_interruptions !== undefined) {
      fields.push('internal_interruptions = ?');
      params.push(dailyTask.internal_interruptions);
    }
    if (dailyTask.external_interruptions !== undefined) {
      fields.push('external_interruptions = ?');
      params.push(dailyTask.external_interruptions);
    }
    if (dailyTask.is_done !== undefined) {
      fields.push('is_done = ?');
      params.push(dailyTask.is_done ? 1 : 0);
    }

    if (fields.length === 0) return { success: false };

    params.push(id);
    runSql(`UPDATE daily_tasks SET ${fields.join(', ')} WHERE id = ?`, params);
    return { success: true };
  });

  ipcMain.handle('sync-recurring-tasks', (_, date) => {
    const recurring = queryAll(
      "SELECT id, estimated_pomodoros FROM tasks WHERE is_recurring = 1 AND is_archived = 0 AND is_done = 0"
    );
    for (const task of recurring) {
      const existing = queryAll(
        "SELECT id FROM daily_tasks WHERE task_id = ? AND date = ?",
        [task.id, date]
      );
      if (existing.length === 0) {
        runSql(
          "INSERT INTO daily_tasks (task_id, date, estimated_pomodoros, actual_pomodoros, internal_interruptions, external_interruptions, is_done) VALUES (?, ?, ?, 0, 0, 0, 0)",
          [task.id, date, task.estimated_pomodoros]
        );
      }
    }
    return { success: true };
  });

  ipcMain.handle('get-daily-tasks', (_, date) => {
    return queryAll(
      `SELECT dt.*, t.title, t.category_id, t.project_id
       FROM daily_tasks dt
       LEFT JOIN tasks t ON dt.task_id = t.id
       WHERE dt.date = ?
       ORDER BY dt.id ASC`,
      [date]
    );
  });

  ipcMain.handle('get-daily-tasks-range', (_, startDate, endDate) => {
    return queryAll(
      `SELECT dt.*, t.title, t.category_id, t.project_id
       FROM daily_tasks dt
       LEFT JOIN tasks t ON dt.task_id = t.id
       WHERE dt.date >= ? AND dt.date <= ?
       ORDER BY dt.date ASC, dt.id ASC`,
      [startDate, endDate]
    );
  });

  ipcMain.handle('increment-interruption', (_, dailyTaskId, type) => {
    const column = type === 'internal' ? 'internal_interruptions' : 'external_interruptions';
    runSql(`UPDATE daily_tasks SET ${column} = ${column} + 1 WHERE id = ?`, [dailyTaskId]);
    return { success: true };
  });

  // Projects
  ipcMain.handle('create-project', (_, project) => {
    const result = runSql(
      'INSERT INTO projects (name, description, is_active) VALUES (?, ?, ?)',
      [project.name, project.description, project.is_active ? 1 : 0]
    );
    return { id: result.lastInsertRowid };
  });

  ipcMain.handle('update-project', (_, id, project) => {
    const fields: string[] = [];
    const params: any[] = [];

    if (project.name !== undefined) {
      fields.push('name = ?');
      params.push(project.name);
    }
    if (project.description !== undefined) {
      fields.push('description = ?');
      params.push(project.description);
    }
    if (project.is_active !== undefined) {
      fields.push('is_active = ?');
      params.push(project.is_active ? 1 : 0);
    }

    if (fields.length === 0) return { success: false };

    params.push(id);
    runSql(`UPDATE projects SET ${fields.join(', ')} WHERE id = ?`, params);
    return { success: true };
  });

  ipcMain.handle('close-project', (_, id) => {
    runSql(`UPDATE projects SET is_active = 0, closed_at = datetime('now') WHERE id = ?`, [id]);
    return { success: true };
  });

  ipcMain.handle('delete-project', (_, id) => {
    runSql('DELETE FROM projects WHERE id = ?', [id]);
    return { success: true };
  });

  ipcMain.handle('get-projects', (_, isActive) => {
    if (isActive === undefined) {
      return queryAll('SELECT * FROM projects ORDER BY created_at DESC');
    }
    return queryAll('SELECT * FROM projects WHERE is_active = ? ORDER BY created_at DESC', [isActive ? 1 : 0]);
  });

  // Categories
  ipcMain.handle('get-categories', () => {
    return queryAll('SELECT * FROM categories ORDER BY sort_order ASC');
  });

  // Next things
  ipcMain.handle('create-next-thing', (_, nextThing) => {
    const result = runSql(
      'INSERT INTO next_things (title, description, category_id) VALUES (?, ?, ?)',
      [nextThing.title, nextThing.description, nextThing.category_id]
    );
    return { id: result.lastInsertRowid };
  });

  ipcMain.handle('update-next-thing', (_, id, nextThing) => {
    const fields: string[] = [];
    const params: any[] = [];

    if (nextThing.title !== undefined) {
      fields.push('title = ?');
      params.push(nextThing.title);
    }
    if (nextThing.description !== undefined) {
      fields.push('description = ?');
      params.push(nextThing.description);
    }
    if (nextThing.category_id !== undefined) {
      fields.push('category_id = ?');
      params.push(nextThing.category_id);
    }

    if (fields.length === 0) return { success: false };

    params.push(id);
    runSql(`UPDATE next_things SET ${fields.join(', ')} WHERE id = ?`, params);
    return { success: true };
  });

  ipcMain.handle('delete-next-thing', (_, id) => {
    runSql('DELETE FROM next_things WHERE id = ?', [id]);
    return { success: true };
  });

  ipcMain.handle('get-next-things', () => {
    return queryAll('SELECT * FROM next_things ORDER BY created_at DESC');
  });

  // Settings
  ipcMain.handle('get-settings', () => {
    const rows = queryAll('SELECT * FROM settings') as { key: string; value: string }[];
    const settings: any = {};
    rows.forEach((row) => {
      settings[row.key] = row.value;
    });
    return {
      pomodoro_minutes: parseInt(settings.pomodoro_minutes || '25'),
      break_minutes: parseInt(settings.break_minutes || '5'),
      long_break_minutes: parseInt(settings.long_break_minutes || '15'),
      pomodoros_until_long_break: parseInt(settings.pomodoros_until_long_break || '4'),
      play_alarm: settings.play_alarm === '1',
      play_ticking: settings.play_ticking === '1',
      minimize_to_tray: settings.minimize_to_tray === '1',
      auto_start_break: settings.auto_start_break === '1',
      auto_start_pomodoro: settings.auto_start_pomodoro === '1',
    };
  });

  ipcMain.handle('update-setting', (_, key, value) => {
    runSql('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);
    return { success: true };
  });
}
