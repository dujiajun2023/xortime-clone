import { useState, useEffect } from 'react';

type DateRange = 'week' | 'month' | 'year' | 'all';

const COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#f97316', '#a855f7', '#06b6d4', '#eab308', '#ec4899', '#6b7280', '#15803d'];

function PieChart({ data, size = 200 }: { data: { label: string; value: number; color: string }[]; size?: number }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) {
    return (
      <div className="flex items-center justify-center" style={{ width: size, height: size }}>
        <span className="text-gray-400 text-sm">暂无数据</span>
      </div>
    );
  }

  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 10;
  let cumAngle = -Math.PI / 2;

  const slices = data.filter(d => d.value > 0).map((d) => {
    const angle = (d.value / total) * 2 * Math.PI;
    const startAngle = cumAngle;
    const endAngle = cumAngle + angle;
    cumAngle = endAngle;

    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const largeArc = angle > Math.PI ? 1 : 0;

    const path = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
    return { path, color: d.color, label: d.label, value: d.value, pct: ((d.value / total) * 100).toFixed(1) };
  });

  return (
    <svg width={size} height={size}>
      {slices.map((s, i) => (
        <path key={i} d={s.path} fill={s.color} stroke="#fff" strokeWidth="2">
          <title>{s.label}: {s.value} 分钟 ({s.pct}%)</title>
        </path>
      ))}
    </svg>
  );
}

function Legend({ data }: { data: { label: string; value: number; color: string }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="space-y-2 mt-4">
      {data.filter(d => d.value > 0).sort((a, b) => b.value - a.value).map((d, i) => (
        <div key={i} className="flex items-center gap-2 text-sm">
          <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: d.color }} />
          <span className="text-gray-700 truncate flex-1">{d.label}</span>
          <span className="text-gray-500 flex-shrink-0">{d.value} 分钟</span>
          <span className="text-gray-400 flex-shrink-0 w-12 text-right">
            {total > 0 ? ((d.value / total) * 100).toFixed(1) : 0}%
          </span>
        </div>
      ))}
    </div>
  );
}

export default function Stats() {
  const [range, setRange] = useState<DateRange>('week');
  const [sessions, setSessions] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [dailyData, setDailyData] = useState<{ date: string; pomodoros: number; done: number; total: number; intInt: number; extInt: number }[]>([]);

  useEffect(() => {
    loadStats();
  }, [range]);

  const loadStats = async () => {
    const end = new Date();
    const start = new Date();
    if (range === 'week') {
      start.setDate(start.getDate() - 6);
    } else if (range === 'month') {
      start.setDate(start.getDate() - 29);
    } else if (range === 'year') {
      start.setFullYear(start.getFullYear() - 1);
    } else {
      start.setFullYear(2020);
    }

    const startDate = start.toISOString().split('T')[0];
    const endDate = end.toISOString().split('T')[0];

    const [sessionData, projectData] = await Promise.all([
      window.api.getPomodoroSessions({ startDate, endDate }),
      window.api.getProjects(),
    ]);
    setSessions(sessionData);
    setProjects(projectData);

    const days: typeof dailyData = [];
    const d = new Date(start);
    while (d <= end) {
      const dateStr = d.toISOString().split('T')[0];
      const tasks = await window.api.getDailyTasks(dateStr);
      const workSessions = sessionData.filter(
        (s: any) => s.session_type === 'work' && s.started_at.startsWith(dateStr)
      );
      days.push({
        date: dateStr,
        pomodoros: workSessions.length,
        done: tasks.filter((t: any) => t.is_done).length,
        total: tasks.length,
        intInt: tasks.reduce((sum: number, t: any) => sum + (t.internal_interruptions || 0), 0),
        extInt: tasks.reduce((sum: number, t: any) => sum + (t.external_interruptions || 0), 0),
      });
      d.setDate(d.getDate() + 1);
    }
    setDailyData(days);
  };

  const totalPomodoros = dailyData.reduce((sum, d) => sum + d.pomodoros, 0);
  const totalTasks = dailyData.reduce((sum, d) => sum + d.total, 0);
  const totalDone = dailyData.reduce((sum, d) => sum + d.done, 0);
  const totalIntInt = dailyData.reduce((sum, d) => sum + d.intInt, 0);
  const totalExtInt = dailyData.reduce((sum, d) => sum + d.extInt, 0);
  const avgPomodoros = dailyData.length > 0 ? (totalPomodoros / dailyData.length).toFixed(1) : '0';
  const totalMinutes = sessions
    .filter(s => s.session_type === 'work')
    .reduce((sum, s) => sum + (s.duration_minutes || 0), 0);

  const maxBar = Math.max(...dailyData.map(d => d.pomodoros), 1);

  const projectData = projects.map((p: any, i: number) => {
    const mins = sessions
      .filter((s: any) => s.session_type === 'work' && s.project_id === p.id)
      .reduce((sum: number, s: any) => sum + (s.duration_minutes || 0), 0);
    return { label: p.name, value: mins, color: COLORS[i % COLORS.length] };
  });

  const unassigned = sessions
    .filter((s: any) => s.session_type === 'work' && !s.project_id)
    .reduce((sum: number, s: any) => sum + (s.duration_minutes || 0), 0);
  if (unassigned > 0) {
    projectData.push({ label: '未分配项目', value: unassigned, color: '#9ca3af' });
  }

  const taskMap = new Map<number, { title: string; minutes: number }>();
  sessions.filter((s: any) => s.session_type === 'work' && s.task_id).forEach((s: any) => {
    const existing = taskMap.get(s.task_id);
    if (existing) {
      existing.minutes += s.duration_minutes || 0;
    } else {
      taskMap.set(s.task_id, { title: `任务 #${s.task_id}`, minutes: s.duration_minutes || 0 });
    }
  });

  const taskData = Array.from(taskMap.entries())
    .map(([id, data], i) => ({ label: data.title, value: data.minutes, color: COLORS[i % COLORS.length] }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  const rangeLabel = range === 'week' ? '本周' : range === 'month' ? '近月' : range === 'year' ? '年度' : '全部';

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">统计报表</h2>
        <div className="flex gap-2">
          {(['week', 'month', 'year', 'all'] as DateRange[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-4 py-2 rounded-lg ${range === r ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
            >
              {r === 'week' ? '本周' : r === 'month' ? '近月' : r === 'year' ? '年度' : '全部'}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="text-sm text-gray-500">番茄总数</div>
          <div className="text-3xl font-bold text-red-500 mt-1">{totalPomodoros}</div>
          <div className="text-xs text-gray-400 mt-1">日均 {avgPomodoros}</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="text-sm text-gray-500">专注时长</div>
          <div className="text-3xl font-bold text-blue-500 mt-1">{totalMinutes}</div>
          <div className="text-xs text-gray-400 mt-1">分钟</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="text-sm text-gray-500">任务完成</div>
          <div className="text-3xl font-bold text-green-500 mt-1">{totalDone}/{totalTasks}</div>
          <div className="text-xs text-gray-400 mt-1">
            完成率 {totalTasks > 0 ? Math.round(totalDone / totalTasks * 100) : 0}%
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="text-sm text-gray-500">中断次数</div>
          <div className="text-3xl font-bold text-yellow-500 mt-1">{totalIntInt + totalExtInt}</div>
          <div className="text-xs text-gray-400 mt-1">内 {totalIntInt} / 外 {totalExtInt}</div>
        </div>
      </div>

      {/* Pie Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">{rangeLabel}时间分布 — 按项目</h3>
          <div className="flex flex-col items-center">
            <PieChart data={projectData} size={200} />
            <Legend data={projectData} />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">{rangeLabel}时间分布 — 按任务</h3>
          <div className="flex flex-col items-center">
            <PieChart data={taskData} size={200} />
            <Legend data={taskData} />
          </div>
        </div>
      </div>

      {/* Bar Chart */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-700 mb-4">每日番茄数</h3>
        <div className="flex items-end gap-1 h-48">
          {dailyData.map((day) => (
            <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
              <div className="text-xs text-gray-500">{day.pomodoros}</div>
              <div
                className="w-full bg-red-400 rounded-t-sm transition-all hover:bg-red-500"
                style={{ height: `${(day.pomodoros / maxBar) * 100}%`, minHeight: day.pomodoros > 0 ? '4px' : '0' }}
              />
              <div className="text-xs text-gray-400 rotate-45 origin-left whitespace-nowrap h-6">
                {day.date.slice(5)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Interruption Chart */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-700 mb-4">每日中断记录</h3>
        <div className="flex items-end gap-1 h-48">
          {dailyData.map((day) => {
            const maxInt = Math.max(...dailyData.map(d => d.intInt + d.extInt), 1);
            const total = day.intInt + day.extInt;
            return (
              <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                <div className="text-xs text-gray-500">{total}</div>
                <div className="w-full flex flex-col-reverse" style={{ height: `${(total / maxInt) * 100}%`, minHeight: total > 0 ? '4px' : '0' }}>
                  <div
                    className="w-full bg-yellow-400"
                    style={{ height: total > 0 ? `${(day.intInt / total) * 100}%` : '0' }}
                  />
                  <div
                    className="w-full bg-orange-400"
                    style={{ height: total > 0 ? `${(day.extInt / total) * 100}%` : '0' }}
                  />
                </div>
                <div className="text-xs text-gray-400 rotate-45 origin-left whitespace-nowrap h-6">
                  {day.date.slice(5)}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex gap-4 mt-4 justify-center">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-yellow-400 rounded-sm" />
            <span className="text-sm text-gray-600">内部中断</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-orange-400 rounded-sm" />
            <span className="text-sm text-gray-600">外部中断</span>
          </div>
        </div>
      </div>
    </div>
  );
}
