import { useState, useEffect, useRef, useCallback } from 'react';

type TimerState = 'idle' | 'running' | 'paused' | 'break';

export default function Timer() {
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [timerState, setTimerState] = useState<TimerState>('idle');
  const [sessionType, setSessionType] = useState<'work' | 'short_break' | 'long_break'>('work');
  const [settings, setSettings] = useState<any>(null);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [completedPomodoros, setCompletedPomodoros] = useState(0);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const completedRef = useRef(false);
  const tickingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const tickingAudioRef = useRef<AudioContext | null>(null);
  const endTimeRef = useRef<number | null>(null);
  const remainingAtPauseRef = useRef<number>(0);

  const sessionTypeRef = useRef(sessionType);
  const sessionIdRef = useRef(sessionId);
  const completedPomodorosRef = useRef(completedPomodoros);
  const settingsRef = useRef(settings);
  const timerStateRef = useRef(timerState);
  const selectedTaskIdRef = useRef(selectedTaskId);
  const timeLeftRef = useRef(timeLeft);
  const handleTimerCompleteRef = useRef<() => void>(() => {});
  const updateFloatingRef = useRef<(time: number, type: string) => void>(() => {});

  useEffect(() => { sessionTypeRef.current = sessionType; }, [sessionType]);
  useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);
  useEffect(() => { completedPomodorosRef.current = completedPomodoros; }, [completedPomodoros]);
  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => { timerStateRef.current = timerState; }, [timerState]);
  useEffect(() => { selectedTaskIdRef.current = selectedTaskId; }, [selectedTaskId]);
  useEffect(() => { timeLeftRef.current = timeLeft; }, [timeLeft]);

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
  }, []);

  const loadTasks = async () => {
    const data = await window.api.getTasks({ isDone: false, isArchived: false });
    setTasks(data);
  };

  const updateFloating = useCallback((time: number, type: string) => {
    const mins = Math.floor(time / 60);
    const secs = time % 60;
    const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    const taskName = tasks.find(t => t.id === selectedTaskIdRef.current)?.title || '';
    window.api.updateFloatingWindow({ time: timeStr, type, taskName });
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

  const startBreak = (type: 'short_break' | 'long_break', minutes: number, autoStart = false) => {
    setSessionType(type);
    sessionTypeRef.current = type;
    const breakSeconds = minutes * 60;
    setTimeLeft(breakSeconds);
    if (autoStart) {
      endTimeRef.current = Date.now() + breakSeconds * 1000;
    } else {
      endTimeRef.current = null;
    }
    setTimerState(autoStart ? 'running' : 'break');
    timerStateRef.current = autoStart ? 'running' : 'break';
    setSessionId(null);
    sessionIdRef.current = null;
    completedRef.current = false;
    updateFloatingRef.current(breakSeconds, type);
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

      if (currentSettings && newCompleted % currentSettings.pomodoros_until_long_break === 0) {
        startBreak('long_break', currentSettings.long_break_minutes, currentSettings.auto_start_break);
      } else {
        startBreak('short_break', currentSettings?.break_minutes || 5, currentSettings?.auto_start_break);
      }
    } else {
      setTimerState('idle');
      timerStateRef.current = 'idle';
      setTimeLeft((currentSettings?.pomodoro_minutes || 25) * 60);
      setSessionType('work');
      sessionTypeRef.current = 'work';
      setSessionId(null);
      sessionIdRef.current = null;
      window.api.closeFloatingWindow();

      if (currentSettings?.auto_start_pomodoro) {
        setTimeout(() => {
          startTimer((currentSettings.pomodoro_minutes || 25) * 60);
        }, 500);
      }
    }
  }, [playAlarmSound]);

  useEffect(() => { handleTimerCompleteRef.current = handleTimerComplete; }, [handleTimerComplete]);

  useEffect(() => {
    if (timerState === 'running') {
      completedRef.current = false;
      intervalRef.current = setInterval(() => {
        if (endTimeRef.current) {
          const remaining = Math.max(0, Math.ceil((endTimeRef.current - Date.now()) / 1000));
          setTimeLeft(remaining);
          if (remaining <= 0) {
            handleTimerCompleteRef.current();
          } else {
            updateFloatingRef.current(remaining, sessionTypeRef.current);
          }
        }
      }, 200);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [timerState]);

  const startTimer = async (overrideDuration?: number) => {
    try {
      const s = settingsRef.current;
      if (!s) return;
      const duration = overrideDuration ?? (
        sessionTypeRef.current === 'work' ? s.pomodoro_minutes :
        sessionTypeRef.current === 'short_break' ? s.break_minutes :
        s.long_break_minutes
      );

      const taskId = selectedTaskIdRef.current;
      const result = await window.api.startPomodoroSession(taskId, null, duration, sessionTypeRef.current);
      setSessionId(result.id);
      sessionIdRef.current = result.id;

      const timeLeftSeconds = duration * 60;
      endTimeRef.current = Date.now() + timeLeftSeconds * 1000;
      setTimeLeft(timeLeftSeconds);

      setTimerState('running');
      timerStateRef.current = 'running';

      await window.api.showFloatingWindow();
      updateFloatingRef.current(timeLeftSeconds, sessionTypeRef.current);

      if (taskId && sessionTypeRef.current === 'work') {
        const dailyTasks = await window.api.getDailyTasks(new Date().toISOString().split('T')[0]);
        const dailyTask = dailyTasks.find((dt: any) => dt.task_id === taskId);
        if (dailyTask) {
          await window.api.updateDailyTask(dailyTask.id, {
            actual_pomodoros: dailyTask.actual_pomodoros + 1,
          });
        }
      }
    } catch (err) {
      console.error('Failed to start timer:', err);
    }
  };

  const pauseTimer = () => {
    remainingAtPauseRef.current = timeLeftRef.current;
    endTimeRef.current = null;
    setTimerState('paused');
    timerStateRef.current = 'paused';
  };

  const resumeTimer = () => {
    endTimeRef.current = Date.now() + remainingAtPauseRef.current * 1000;
    setTimerState('running');
    timerStateRef.current = 'running';
  };

  const resetTimer = () => {
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

        <div className="relative w-80 h-80 mx-auto mb-8">
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
              className="px-8 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {settings ? '开始' : '加载中...'}
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
          {timerState === 'break' && (
            <button
              onClick={() => startTimer()}
              className="px-8 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              开始休息
            </button>
          )}
        </div>

        <div className="mt-8 text-gray-500">
          今日已完成 <span className="text-2xl font-bold text-gray-800">{completedPomodoros}</span> 个番茄钟
        </div>
      </div>
    </div>
  );
}
