import { contextBridge, ipcRenderer } from 'electron';

export type PomodoroSession = {
  id: number;
  task_id: number | null;
  project_id: number | null;
  duration_minutes: number;
  session_type: 'work' | 'short_break' | 'long_break';
  started_at: string;
  completed_at: string | null;
};

export type Task = {
  id: number;
  title: string;
  description: string | null;
  category_id: number | null;
  project_id: number | null;
  estimated_pomodoros: number;
  actual_pomodoros: number;
  is_done: boolean;
  is_archived: boolean;
  sort_order: number;
  deadline: string | null;
  created_at: string;
  completed_at: string | null;
};

export type DailyTask = {
  id: number;
  task_id: number;
  date: string;
  estimated_pomodoros: number;
  actual_pomodoros: number;
  internal_interruptions: number;
  external_interruptions: number;
  is_done: boolean;
};

export type Project = {
  id: number;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  closed_at: string | null;
};

export type Category = {
  id: number;
  name: string;
  color: string;
  sort_order: number;
};

export type NextThing = {
  id: number;
  title: string;
  description: string | null;
  category_id: number | null;
  created_at: string;
};

export type Settings = {
  pomodoro_minutes: number;
  break_minutes: number;
  long_break_minutes: number;
  pomodoros_until_long_break: number;
  play_alarm: boolean;
  play_ticking: boolean;
  minimize_to_tray: boolean;
  auto_start_break: boolean;
  auto_start_pomodoro: boolean;
};

const api = {
  // Pomodoro sessions
  startPomodoroSession: (taskId: number | null, projectId: number | null, duration: number, type: string) =>
    ipcRenderer.invoke('start-pomodoro-session', taskId, projectId, duration, type),
  completePomodoroSession: (sessionId: number) =>
    ipcRenderer.invoke('complete-pomodoro-session', sessionId),
  getPomodoroSessions: (filters?: { taskId?: number; projectId?: number; startDate?: string; endDate?: string }) =>
    ipcRenderer.invoke('get-pomodoro-sessions', filters),

  // Tasks
  createTask: (task: Omit<Task, 'id' | 'created_at' | 'completed_at'>) =>
    ipcRenderer.invoke('create-task', task),
  updateTask: (id: number, task: Partial<Omit<Task, 'id' | 'created_at' | 'completed_at'>>) =>
    ipcRenderer.invoke('update-task', id, task),
  deleteTask: (id: number) =>
    ipcRenderer.invoke('delete-task', id),
  getTasks: (filters?: { projectId?: number; categoryId?: number; isDone?: boolean; isArchived?: boolean }) =>
    ipcRenderer.invoke('get-tasks', filters),

  // Daily tasks
  createDailyTask: (dailyTask: Omit<DailyTask, 'id'>) =>
    ipcRenderer.invoke('create-daily-task', dailyTask),
  updateDailyTask: (id: number, dailyTask: Partial<Omit<DailyTask, 'id'>>) =>
    ipcRenderer.invoke('update-daily-task', id, dailyTask),
  getDailyTasks: (date: string) =>
    ipcRenderer.invoke('get-daily-tasks', date),
  getDailyTasksRange: (startDate: string, endDate: string) =>
    ipcRenderer.invoke('get-daily-tasks-range', startDate, endDate),
  incrementInterruption: (dailyTaskId: number, type: 'internal' | 'external') =>
    ipcRenderer.invoke('increment-interruption', dailyTaskId, type),

  // Projects
  createProject: (project: Omit<Project, 'id' | 'created_at' | 'closed_at'>) =>
    ipcRenderer.invoke('create-project', project),
  updateProject: (id: number, project: Partial<Omit<Project, 'id' | 'created_at' | 'closed_at'>>) =>
    ipcRenderer.invoke('update-project', id, project),
  closeProject: (id: number) =>
    ipcRenderer.invoke('close-project', id),
  deleteProject: (id: number) =>
    ipcRenderer.invoke('delete-project', id),
  getProjects: (isActive?: boolean) =>
    ipcRenderer.invoke('get-projects', isActive),

  // Categories
  getCategories: () =>
    ipcRenderer.invoke('get-categories'),

  // Next things
  createNextThing: (nextThing: Omit<NextThing, 'id' | 'created_at'>) =>
    ipcRenderer.invoke('create-next-thing', nextThing),
  updateNextThing: (id: number, nextThing: Partial<Omit<NextThing, 'id' | 'created_at'>>) =>
    ipcRenderer.invoke('update-next-thing', id, nextThing),
  deleteNextThing: (id: number) =>
    ipcRenderer.invoke('delete-next-thing', id),
  getNextThings: () =>
    ipcRenderer.invoke('get-next-things'),

  // Settings
  getSettings: () =>
    ipcRenderer.invoke('get-settings'),
  updateSetting: (key: string, value: string) =>
    ipcRenderer.invoke('update-setting', key, value),

  // App info
  getAppVersion: () =>
    ipcRenderer.invoke('get-app-version'),
  getUserDataPath: () =>
    ipcRenderer.invoke('get-user-data-path'),

  // Events
  onStartPomodoro: (callback: () => void) => {
    ipcRenderer.on('start-pomodoro', callback);
    return () => ipcRenderer.removeListener('start-pomodoro', callback);
  },

  // Floating window
  showFloatingWindow: () =>
    ipcRenderer.invoke('show-floating-window'),
  hideFloatingWindow: () =>
    ipcRenderer.invoke('hide-floating-window'),
  updateFloatingWindow: (data: { time: string; type: string; taskName: string; flash?: boolean }) =>
    ipcRenderer.invoke('update-floating-window', data),
  closeFloatingWindow: () =>
    ipcRenderer.invoke('close-floating-window'),
  moveFloatingWindow: (deltaX: number, deltaY: number) =>
    ipcRenderer.invoke('move-floating-window', { deltaX, deltaY }),
  focusMainWindow: () =>
    ipcRenderer.invoke('focus-main-window'),
  onFloatingUpdate: (callback: (data: { time: string; type: string; taskName: string }) => void) => {
    ipcRenderer.on('floating-update', (_, data) => callback(data));
    return () => ipcRenderer.removeListener('floating-update', callback as any);
  },
};

contextBridge.exposeInMainWorld('api', api);

export type Api = typeof api;
