export {};

declare global {
  interface Window {
    api: {
      // Pomodoro sessions
      startPomodoroSession: (taskId: number | null, projectId: number | null, duration: number, type: string) => Promise<{ id: number }>;
      completePomodoroSession: (sessionId: number) => Promise<{ success: boolean }>;
      getPomodoroSessions: (filters?: { taskId?: number; projectId?: number; startDate?: string; endDate?: string }) => Promise<any[]>;

      // Tasks
      createTask: (task: any) => Promise<{ id: number }>;
      updateTask: (id: number, task: any) => Promise<{ success: boolean }>;
      deleteTask: (id: number) => Promise<{ success: boolean }>;
      getTasks: (filters?: any) => Promise<any[]>;

      // Daily tasks
      createDailyTask: (dailyTask: any) => Promise<{ id: number }>;
      updateDailyTask: (id: number, dailyTask: any) => Promise<{ success: boolean }>;
      getDailyTasks: (date: string) => Promise<any[]>;
      incrementInterruption: (dailyTaskId: number, type: 'internal' | 'external') => Promise<{ success: boolean }>;

      // Projects
      createProject: (project: any) => Promise<{ id: number }>;
      updateProject: (id: number, project: any) => Promise<{ success: boolean }>;
      closeProject: (id: number) => Promise<{ success: boolean }>;
      getProjects: (isActive?: boolean) => Promise<any[]>;

      // Categories
      getCategories: () => Promise<any[]>;

      // Next things
      createNextThing: (nextThing: any) => Promise<{ id: number }>;
      updateNextThing: (id: number, nextThing: any) => Promise<{ success: boolean }>;
      deleteNextThing: (id: number) => Promise<{ success: boolean }>;
      getNextThings: () => Promise<any[]>;

      // Settings
      getSettings: () => Promise<any>;
      updateSetting: (key: string, value: string) => Promise<{ success: boolean }>;

      // App info
      getAppVersion: () => Promise<string>;
      getUserDataPath: () => Promise<string>;

      // Events
      onStartPomodoro: (callback: () => void) => () => void;
    };
  }
}
