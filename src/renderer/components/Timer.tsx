import { useState, useEffect, useRef, useCallback } from 'react';

type TimerState = 'idle' | 'running' | 'paused' | 'confirm';
type BreakType = 'short_break' | 'long_break';

export default function Timer() {
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [timerState, setTimerState] = useState<TimerState>('idle');
  const [sessionType, setSessionType] = useState<'work' | 'short_break' | 'long_break'>('work');
  const [settings, setSettings] = useState<any>(null);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [completedPomodoros, setCompletedPomodoros] = useState(0);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [confirmNext, setConfirmNext] = useState<BreakType | null>(null);
  const [prompt, setPrompt] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const completedRef = useRef(false);
  const tickingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const tickingAudioRef = useRef<AudioContext | null>(null);
  const endTimeRef = useRef<number | null>(null);
  const remainingAtPauseRef = useRef<number>(0);
  const plannedSecondsRef = useRef<number>(0);
  const [brokenToday, setBrokenToday] = useState({ count: 0, minutes: 0 });

  const sessionTypeRef = useRef(sessionType);
  const sessionIdRef = useRef(sessionId);
  const completedPomodorosRef = useRef(completedPomodoros);
  const settingsRef = useRef(settings);
  const timerStateRef = useRef(timerState);
  const selectedTaskIdRef = useRef(selectedTaskId);
  const timeLeftRef = useRef(timeLeft);
  const handleTimerCompleteRef = useRef<() => void>(() => {});
  const updateFloatingRef = useRef<(time: number, type: string, flash?: boolean, endTime?: number, timerActive?: boolean) => void>(() => {});

  useEffect(() => { sessionTypeRef.current = sessionType; }, [sessionType]);
  useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);
  useEffect(() => { completedPomodorosRef.current = completedPomodoros; }, [completedPomodoros]);
  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => { timerStateRef.current = timerState; }, [timerState]);
  useEffect(() => { selectedTaskIdRef.current = selectedTaskId; }, [selectedTaskId]);
  useEffect(() => { timeLeftRef.current = timeLeft; }, [timeLeft]);

  const clearPersistedTimer = () => {
    ['xortime_endTime', 'xortime_sessionType', 'xortime_selectedTaskId',
     'xortime_sessionId', 'xortime_completedPomodoros', 'xortime_plannedSeconds'].forEach((k) => localStorage.removeItem(k));
  };

  // Switching tabs unmounts this component, so a running pomodoro has to be
  // rebuilt from storage or it silently resets to a full 25:00.
  useEffect(() => {
    const savedEndTime = localStorage.getItem('xortime_endTime');
    const savedSessionType = localStorage.getItem('xortime_sessionType');
    if (!savedEndTime || !savedSessionType) return;

    const endTime = parseInt(savedEndTime, 10);
    if (!(endTime > Date.now())) {
      clearPersistedTimer();
      return;
    }

    endTimeRef.current = endTime;
    setTimeLeft(Math.max(0, Math.ceil((endTime - Date.now()) / 1000)));
    setSessionType(savedSessionType as 'work' | 'short_break' | 'long_break');

    const savedTaskId = localStorage.getItem('xortime_selectedTaskId');
    if (savedTaskId) setSelectedTaskId(parseInt(savedTaskId, 10));
    const savedSessionId = localStorage.getItem('xortime_sessionId');
    if (savedSessionId) setSessionId(parseInt(savedSessionId, 10));
    const savedCompleted = localStorage.getItem('xortime_completedPomodoros');
    if (savedCompleted) setCompletedPomodoros(parseInt(savedCompleted, 10));

    // resetTimer derives elapsed focus time from plannedSecondsRef; without
    // restoring it, breaking a pomodoro after a tab switch records 0 minutes.
    const savedPlanned = localStorage.getItem('xortime_plannedSeconds');
    plannedSecondsRef.current = savedPlanned
      ? parseInt(savedPlanned, 10)
      : Math.ceil((endTime - Date.now()) / 1000);

    setTimerState('running');
    window.api.showFloatingWindow();
    const remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
    const mins = Math.floor(remaining / 60);
    const secs = remaining % 60;
    window.api.updateFloatingWindow({
      time: `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`,
      type: savedSessionType,
      taskName: '',
      endTime,
      timerActive: true,
    });
  }, []);

  // A pending confirmation prompt also has to survive remounts
  useEffect(() => {
    const savedEndTime = localStorage.getItem('xortime_endTime');
    if (savedEndTime && parseInt(savedEndTime, 10) > Date.now()) return;

    const savedConfirm = localStorage.getItem('xortime_confirm');
    if (!savedConfirm) return;

    setConfirmNext(savedConfirm as BreakType);
    setTimerState('confirm');
    timerStateRef.current = 'confirm';
    setTimeLeft(0);
    window.api.showFloatingWindow();
    window.api.updateFloatingWindow({ time: '00:00', type: 'work', taskName: '', flash: true });
  }, []);

  const didMountRef = useRef(false);
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    if (timerState === 'confirm' && confirmNext) {
      localStorage.setItem('xortime_confirm', confirmNext);
    } else {
      localStorage.removeItem('xortime_confirm');
    }
    if (timerState === 'running' && endTimeRef.current) {
      localStorage.setItem('xortime_endTime', String(endTimeRef.current));
      localStorage.setItem('xortime_sessionType', sessionTypeRef.current);
      localStorage.setItem('xortime_selectedTaskId', String(selectedTaskIdRef.current ?? ''));
      localStorage.setItem('xortime_sessionId', String(sessionIdRef.current ?? ''));
      localStorage.setItem('xortime_completedPomodoros', String(completedPomodorosRef.current));
      localStorage.setItem('xortime_plannedSeconds', String(plannedSecondsRef.current));
    } else if (timerState === 'idle') {
      clearPersistedTimer();
    }
  }, [timerState, confirmNext]);

  useEffect(() => {
    window.api.getSettings()
      .then(setSettings)
      .catch((err) => {
        console.error('Failed to load settings:', err);
        setSettings({
          pomodoro_minutes: 25,
          break_minutes: 5,
          long_break_minutes: 15,
          pomodoros_until_long_break: 4,
          play_alarm: true,
          play_ticking: false,
          minimize_to_tray: true,
          auto_start_break: false,
          auto_start_pomodoro: false,
        });
      });
    loadTasks();
    loadBrokenToday();
  }, []);

  const loadTasks = async () => {
    const data = await window.api.getTasks({ isDone: false, isArchived: false });
    setTasks(data);
  };

  const loadBrokenToday = async () => {
    const today = new Date().toISOString().split('T')[0];
    const rows = await window.api.getPomodoroSessions({ startDate: today, endDate: today, status: 'broken' });
    setBrokenToday({
      count: rows.length,
      minutes: rows.reduce((s: number, r: any) => s + (r.actual_minutes || 0), 0),
    });
  };

  const updateFloating = useCallback((time: number, type: string, flash = false, endTime?: number, timerActive?: boolean) => {
    const mins = Math.floor(time / 60);
    const secs = time % 60;
    const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    const taskName = tasks.find(t => t.id === selectedTaskIdRef.current)?.title || '';
    window.api.updateFloatingWindow({ time: timeStr, type, taskName, flash, endTime, timerActive });
  }, [tasks]);

  useEffect(() => { updateFloatingRef.current = updateFloating; }, [updateFloating]);

  const playAlarmSound = useCallback(() => {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 800;
      osc.type = 'sine';
      gain.gain.value = 0.3;
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      osc.stop(ctx.currentTime + 0.5);
    } catch {}
  }, []);

  const playTick = useCallback(() => {
    try {
      if (!tickingAudioRef.current || tickingAudioRef.current.state === 'closed') {
        tickingAudioRef.current = new AudioContext();
      }
      const ctx = tickingAudioRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 1000;
      osc.type = 'sine';
      gain.gain.value = 0.05;
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.03);
      osc.stop(ctx.currentTime + 0.03);
    } catch {}
  }, []);

  useEffect(() => {
    if (timerState === 'running' && settings?.play_ticking) {
      tickingIntervalRef.current = setInterval(playTick, 1000);
    } else {
      if (tickingIntervalRef.current) {
        clearInterval(tickingIntervalRef.current);
        tickingIntervalRef.current = null;
      }
    }
    return () => {
      if (tickingIntervalRef.current) {
        clearInterval(tickingIntervalRef.current);
        tickingIntervalRef.current = null;
      }
    };
  }, [timerState, settings?.play_ticking, playTick]);

  const startBreak = (type: BreakType, minutes: number) => {
    setSessionType(type);
    sessionTypeRef.current = type;
    const breakSeconds = minutes * 60;
    setTimeLeft(breakSeconds);
    endTimeRef.current = Date.now() + breakSeconds * 1000;
    setTimerState('running');
    timerStateRef.current = 'running';
    setSessionId(null);
    sessionIdRef.current = null;
    completedRef.current = false;
    updateFloatingRef.current(breakSeconds, type, false, endTimeRef.current, true);
  };

  const breakMinutes = (s: any, type: BreakType) =>
    type === 'long_break' ? (s?.long_break_minutes || 15) : (s?.break_minutes || 5);

  const enterConfirm = (next: BreakType) => {
    setConfirmNext(next);
    setTimerState('confirm');
    timerStateRef.current = 'confirm';
    setTimeLeft(0);
    window.api.showFloatingWindow();
    updateFloatingRef.current(0, next, true);
  };

  const handleConfirm = () => {
    const next = confirmNext;
    if (!next) return;
    setConfirmNext(null);
    localStorage.removeItem('xortime_confirm');
    startBreak(next, breakMinutes(settingsRef.current, next));
  };

  const handleTimerComplete = useCallback(async () => {
    if (completedRef.current) return;
    completedRef.current = true;

    const currentSessionId = sessionIdRef.current;
    const currentType = sessionTypeRef.current;
    const currentSettings = settingsRef.current;
    const currentCompleted = completedPomodorosRef.current;

    if (currentSessionId) {
      await window.api.completePomodoroSession(currentSessionId);
    }

    if (currentSettings?.play_alarm) {
      playAlarmSound();
    }

    if (currentType === 'work') {
      const newCompleted = currentCompleted + 1;
      setCompletedPomodoros(newCompleted);
      completedPomodorosRef.current = newCompleted;

      // Record the finished pomodoro against today's plan for this task
      const taskId = selectedTaskIdRef.current;
      if (taskId) {
        const dateStr = new Date().toISOString().split('T')[0];
        const dailyTasks = await window.api.getDailyTasks(dateStr);
        const dailyTask = dailyTasks.find((dt: any) => dt.task_id === taskId);
        if (dailyTask) {
          await window.api.updateDailyTask(dailyTask.id, {
            actual_pomodoros: (dailyTask.actual_pomodoros || 0) + 1,
          });
        } else {
          await window.api.createDailyTask({
            task_id: taskId,
            date: dateStr,
            estimated_pomodoros: 1,
            actual_pomodoros: 1,
            internal_interruptions: 0,
            external_interruptions: 0,
            is_done: false,
          });
        }
      }

      const nextBreak: BreakType =
        currentSettings && newCompleted % currentSettings.pomodoros_until_long_break === 0
          ? 'long_break'
          : 'short_break';

      if (currentSettings?.auto_start_break) {
        startBreak(nextBreak, breakMinutes(currentSettings, nextBreak));
      } else {
        enterConfirm(nextBreak);
      }
    } else {
      setTimeLeft((currentSettings?.pomodoro_minutes || 25) * 60);
      setSessionType('work');
      sessionTypeRef.current = 'work';
      setSessionId(null);
      sessionIdRef.current = null;

      if (currentSettings?.auto_start_pomodoro) {
        startTimer((currentSettings.pomodoro_minutes || 25) * 60);
      } else {
        // Back to idle so the task can be switched before the next pomodoro
        setPrompt('休息结束！选择下一个任务，然后开始');
        setTimerState('idle');
        timerStateRef.current = 'idle';
        updateFloatingRef.current(0, 'work', true);
      }
    }
  }, [playAlarmSound]);

  useEffect(() => { handleTimerCompleteRef.current = handleTimerComplete; }, [handleTimerComplete]);

  // Sync time when window becomes visible again
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && timerStateRef.current === 'running' && endTimeRef.current) {
        // Immediately sync the time when window becomes visible
        const remaining = Math.max(0, Math.ceil((endTimeRef.current - Date.now()) / 1000));
        setTimeLeft(remaining);
        
        if (remaining <= 0) {
          handleTimerCompleteRef.current();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (timerState === 'running') {
      completedRef.current = false;
      
      const tick = () => {
        if (endTimeRef.current) {
          const now = Date.now();
          const remaining = Math.max(0, Math.ceil((endTimeRef.current - now) / 1000));
          setTimeLeft(remaining);
          
          if (remaining <= 0) {
            // handleTimerComplete guards itself via completedRef, so repeated
            // ticks cannot double-fire it
            handleTimerCompleteRef.current();
          }
        }
      };
      
      // Use 50ms interval for faster updates
      const tickInterval = setInterval(tick, 50);
      
      // Also tick immediately to avoid initial delay
      tick();
      
      return () => {
        clearInterval(tickInterval);
      };
    }
  }, [timerState]);

  const startTimer = async (overrideDuration?: number) => {
    try {
      const s = settingsRef.current;
      if (!s) return;
      setPrompt(null);
      const duration = overrideDuration ?? (
        sessionTypeRef.current === 'work' ? s.pomodoro_minutes :
        sessionTypeRef.current === 'short_break' ? s.break_minutes :
        s.long_break_minutes
      );

      const taskId = selectedTaskIdRef.current;
      const projectId = taskId
        ? (tasks.find((t: any) => t.id === taskId)?.project_id ?? null)
        : null;
      const result = await window.api.startPomodoroSession(taskId, projectId, duration, sessionTypeRef.current);
      setSessionId(result.id);
      sessionIdRef.current = result.id;

      const timeLeftSeconds = duration * 60;
      plannedSecondsRef.current = timeLeftSeconds;
      endTimeRef.current = Date.now() + timeLeftSeconds * 1000;
      setTimeLeft(timeLeftSeconds);

      setTimerState('running');
      timerStateRef.current = 'running';

      await window.api.showFloatingWindow();
      updateFloatingRef.current(timeLeftSeconds, sessionTypeRef.current, false, endTimeRef.current, true);
    } catch (err) {
      console.error('Failed to start timer:', err);
    }
  };

  const pauseTimer = () => {
    remainingAtPauseRef.current = timeLeftRef.current;
    endTimeRef.current = null;
    setTimerState('paused');
    timerStateRef.current = 'paused';
    updateFloatingRef.current(timeLeftRef.current, sessionTypeRef.current, false, undefined, false);
  };

  const resumeTimer = () => {
    endTimeRef.current = Date.now() + remainingAtPauseRef.current * 1000;
    setTimerState('running');
    timerStateRef.current = 'running';
    updateFloatingRef.current(remainingAtPauseRef.current, sessionTypeRef.current, false, endTimeRef.current, true);
  };

  const resetTimer = () => {
    const sid = sessionIdRef.current;
    if (sid && sessionTypeRef.current === 'work') {
      const elapsed = Math.max(0, plannedSecondsRef.current - timeLeftRef.current);
      const minutes = Math.floor(elapsed / 60);
      window.api.breakPomodoroSession(sid, minutes).then(loadBrokenToday);
    }
    setTimerState('idle');
    timerStateRef.current = 'idle';
    setSessionId(null);
    sessionIdRef.current = null;
    endTimeRef.current = null;
    setTimeLeft((settings?.pomodoro_minutes || 25) * 60);
    setSessionType('work');
    sessionTypeRef.current = 'work';
    completedRef.current = false;
    window.api.closeFloatingWindow();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const totalSeconds = settings
    ? (sessionType === 'work' ? settings.pomodoro_minutes :
        sessionType === 'short_break' ? settings.break_minutes :
        settings.long_break_minutes) * 60
    : 25 * 60;
  const progress = ((totalSeconds - timeLeft) / totalSeconds) * 100;

  const taskLabel = selectedTaskId
    ? tasks.find(t => t.id === selectedTaskId)?.title || '未知任务'
    : null;

  const canStart = selectedTaskId !== null && settings !== null;

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
        <div className="mb-6">
          <span className={`inline-block px-4 py-2 rounded-full text-sm font-medium ${
            sessionType === 'work' ? 'bg-red-100 text-red-700' :
            sessionType === 'short_break' ? 'bg-green-100 text-green-700' :
            'bg-blue-100 text-blue-700'
          }`}>
            {sessionType === 'work' ? '专注时间' : sessionType === 'short_break' ? '短休息' : '长休息'}
          </span>
        </div>

        {timerState === 'idle' && (
          <div className="mb-6">
            <select
              value={selectedTaskId || ''}
              onChange={(e) => setSelectedTaskId(e.target.value ? Number(e.target.value) : null)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700"
            >
              <option value="">请选择任务...</option>
              {tasks.map((task: any) => (
                <option key={task.id} value={task.id}>{task.title}</option>
              ))}
            </select>
            {taskLabel && (
              <p className="text-sm text-gray-500 mt-2">将记录到: {taskLabel}</p>
            )}
            {!selectedTaskId && (
              <p className="text-sm text-orange-500 mt-2">请先选择一个任务再开始番茄钟</p>
            )}
          </div>
        )}

        {timerState === 'confirm' && (
          <div className="mb-6 animate-flash">
            <span className="inline-block px-6 py-3 rounded-xl bg-red-500 text-white text-lg font-bold shadow-lg">
              番茄钟完成！
            </span>
          </div>
        )}

        {timerState === 'idle' && prompt && (
          <div className="mb-6 animate-flash">
            <span className="inline-block px-6 py-3 rounded-xl bg-green-600 text-white text-lg font-bold shadow-lg">
              {prompt}
            </span>
          </div>
        )}

        <div className={`relative w-80 h-80 mx-auto mb-8 ${timerState === 'confirm' ? 'animate-flash' : ''}`}>
          <svg className="w-full h-full transform -rotate-90">
            <circle cx="160" cy="160" r="140" stroke="#e5e7eb" strokeWidth="12" fill="none" />
            <circle
              cx="160" cy="160" r="140"
              stroke={sessionType === 'work' ? '#ef4444' : sessionType === 'short_break' ? '#22c55e' : '#3b82f6'}
              strokeWidth="12" fill="none"
              strokeDasharray={`${2 * Math.PI * 140}`}
              strokeDashoffset={`${2 * Math.PI * 140 * (1 - progress / 100)}`}
              strokeLinecap="round"
              className="transition-all duration-1000"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-6xl font-mono font-bold text-gray-800">
              {formatTime(timeLeft)}
            </div>
          </div>
        </div>

        <div className="flex justify-center gap-4">
          {timerState === 'idle' && (
            <button
              onClick={() => startTimer()}
              disabled={!canStart}
              className={`px-8 py-3 text-white rounded-lg font-medium transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed ${
                prompt
                  ? 'bg-green-600 hover:bg-green-700 animate-flash'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {prompt ? '开始下一个番茄钟' : settings ? '开始' : '加载中...'}
            </button>
          )}
          {timerState === 'running' && (
            <button
              onClick={pauseTimer}
              className="px-8 py-3 bg-yellow-500 text-white rounded-lg font-medium hover:bg-yellow-600 transition-colors"
            >
              暂停
            </button>
          )}
          {timerState === 'paused' && (
            <button
              onClick={resumeTimer}
              className="px-8 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              继续
            </button>
          )}
          {(timerState === 'running' || timerState === 'paused') && (
            <button
              onClick={resetTimer}
              className="px-8 py-3 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors"
            >
              重置
            </button>
          )}
          {timerState === 'confirm' && (
            <button
              onClick={handleConfirm}
              className="px-8 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors animate-flash"
            >
              {confirmNext === 'long_break'
                ? `开始长休息（${settings?.long_break_minutes ?? 15} 分钟）`
                : `开始休息（${settings?.break_minutes ?? 5} 分钟）`}
            </button>
          )}
        </div>

        <div className="mt-8 text-gray-500">
          今日已完成 <span className="text-2xl font-bold text-gray-800">{completedPomodoros}</span> 个番茄钟
        </div>
        <div className="mt-2 text-gray-500" title="中途放弃的番茄钟（重置时记录）">
          <span className="inline-block align-middle" style={{ filter: 'grayscale(0.6)', transform: 'rotate(45deg)' }}>🍅</span>
          <span className="align-middle">💥 今日打烂 </span>
          <span className="text-2xl font-bold text-red-500 align-middle">{brokenToday.count}</span>
          <span className="align-middle"> 个</span>
          {brokenToday.minutes > 0 && (
            <span className="ml-2 text-sm align-middle">（已专注 {brokenToday.minutes} 分钟）</span>
          )}
        </div>
      </div>
    </div>
  );
}
