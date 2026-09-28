import { useState, useEffect, ReactNode } from 'react';

type DateRange = 'week' | 'month' | 'year' | 'all';

interface Bucket {
  key: string;
  label: string;
  pomodoros: number;
  minutes: number;
  done: number;
  tasks: number;
  intInt: number;
  extInt: number;
}

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
  const shown = data.filter(d => d.value > 0).sort((a, b) => b.value - a.value);
  if (shown.length === 0) return null;
  return (
    <div className="space-y-2 mt-4 w-full">
      {shown.map((d, i) => (
        <div key={i} className="flex items-center gap-2 text-sm">
          <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: d.color }} />
          <span className="text-gray-700 truncate flex-1" title={d.label}>{d.label}</span>
          <span className="text-gray-500 flex-shrink-0">{d.value} 分钟</span>
          <span className="text-gray-400 flex-shrink-0 w-12 text-right">
            {total > 0 ? ((d.value / total) * 100).toFixed(1) : 0}%
          </span>
        </div>
      ))}
    </div>
  );
}

// Columns are anchored to a shared bottom baseline so bars grow upward from zero,
// with the value label sitting just above each bar top and dates aligned underneath.
function ColumnChart({
  buckets,
  max,
  valueOf,
  height = 220,
  renderBar,
}: {
  buckets: Bucket[];
  max: number;
  valueOf: (b: Bucket) => number;
  height?: number;
  renderBar: (b: Bucket) => ReactNode;
}) {
  const ticks = [1, 0.75, 0.5, 0.25, 0].map((r) => Math.round(max * r));
  return (
    <div>
      <div className="flex" style={{ height }}>
        <div className="w-8 pr-2 flex flex-col justify-between text-xs text-gray-400 text-right leading-none">
          {ticks.map((t, i) => (
            <span key={i}>{t}</span>
          ))}
        </div>
        <div className="relative flex-1">
          <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
            {ticks.map((_, i) => (
              <div key={i} className="border-t border-gray-100 w-full" />
            ))}
          </div>
          <div className="absolute inset-0 flex items-end gap-1">
            {buckets.map((b) => {
              const v = valueOf(b);
              return (
                <div key={b.key} className="flex-1 h-full flex flex-col justify-end min-w-0">
                  <div className="relative w-full" style={{ height: `${(v / max) * 100}%` }}>
                    <span className="absolute -top-5 inset-x-0 text-center text-xs text-gray-500 leading-none">
                      {v > 0 ? v : ''}
                    </span>
                    {renderBar(b)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="flex mt-2">
        <div className="w-8 pr-2" />
        <div className="flex-1 flex gap-1">
          {buckets.map((b) => (
            <div key={b.key} className="flex-1 min-w-0 text-center text-[10px] text-gray-400 truncate" title={b.label}>
              {b.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Stats() {
  const [range, setRange] = useState<DateRange>('week');
  const [sessions, setSessions] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [taskInfo, setTaskInfo] = useState<Map<number, { title: string; projectId: number | null }>>(new Map());
  const [buckets, setBuckets] = useState<Bucket[]>([]);

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

    const [sessionData, projectData, taskData, dailyRows] = await Promise.all([
      window.api.getPomodoroSessions({ startDate, endDate }),
      window.api.getProjects(),
      window.api.getTasks(),
      window.api.getDailyTasksRange(startDate, endDate),
    ]);
    setSessions(sessionData);
    setProjects(projectData);

    const info = new Map<number, { title: string; projectId: number | null }>();
    taskData.forEach((t: any) => info.set(t.id, { title: t.title, projectId: t.project_id ?? null }));
    setTaskInfo(info);

    const byMonth = range === 'year' || range === 'all';
    const list: Bucket[] = [];
    const index = new Map<string, Bucket>();

    if (byMonth) {
      const d = new Date(start.getFullYear(), start.getMonth(), 1);
      while (d <= end) {
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const b: Bucket = { key, label: key, pomodoros: 0, minutes: 0, done: 0, tasks: 0, intInt: 0, extInt: 0 };
        list.push(b);
        index.set(key, b);
        d.setMonth(d.getMonth() + 1);
      }
    } else {
      const d = new Date(start);
      while (d <= end) {
        const key = d.toISOString().split('T')[0];
        const b: Bucket = { key, label: key.slice(5), pomodoros: 0, minutes: 0, done: 0, tasks: 0, intInt: 0, extInt: 0 };
        list.push(b);
        index.set(key, b);
        d.setDate(d.getDate() + 1);
      }
    }

    const bucketOf = (dateStr: string) => index.get(byMonth ? dateStr.slice(0, 7) : dateStr.slice(0, 10));

    sessionData
      .filter((s: any) => s.session_type === 'work')
      .forEach((s: any) => {
        const b = bucketOf(s.started_at || '');
        if (!b) return;
        b.pomodoros += 1;
        b.minutes += s.duration_minutes || 0;
      });

    dailyRows.forEach((row: any) => {
      const b = bucketOf(row.date || '');
      if (!b) return;
      b.tasks += 1;
      b.done += row.is_done ? 1 : 0;
      b.intInt += row.internal_interruptions || 0;
      b.extInt += row.external_interruptions || 0;
    });

    setBuckets(list);
  };

  const totalPomodoros = buckets.reduce((s, b) => s + b.pomodoros, 0);
  const totalMinutes = sessions
    .filter((s) => s.session_type === 'work')
    .reduce((sum, s) => sum + (s.duration_minutes || 0), 0);
  const totalTasks = buckets.reduce((s, b) => s + b.tasks, 0);
  const totalDone = buckets.reduce((s, b) => s + b.done, 0);
  const totalIntInt = buckets.reduce((s, b) => s + b.intInt, 0);
  const totalExtInt = buckets.reduce((s, b) => s + b.extInt, 0);

  const projectMinutes = new Map<number | null, number>();
  sessions
    .filter((s) => s.session_type === 'work')
    .forEach((s) => {
      const pid = s.project_id ?? taskInfo.get(s.task_id)?.projectId ?? null;
      projectMinutes.set(pid, (projectMinutes.get(pid) || 0) + (s.duration_minutes || 0));
    });

  const projectData = projects
    .map((p: any, i: number) => ({
      label: p.name,
      value: projectMinutes.get(p.id) || 0,
      color: COLORS[i % COLORS.length],
    }))
    .filter((d) => d.value > 0);
  const unassigned = projectMinutes.get(null) || 0;
  if (unassigned > 0) projectData.push({ label: '未分配项目', value: unassigned, color: '#9ca3af' });

  const taskMinutes = new Map<number, number>();
  sessions
    .filter((s) => s.session_type === 'work' && s.task_id)
    .forEach((s) => {
      taskMinutes.set(s.task_id, (taskMinutes.get(s.task_id) || 0) + (s.duration_minutes || 0));
    });
  const taskData = Array.from(taskMinutes.entries())
    .map(([id, mins], i) => ({
      label: taskInfo.get(id)?.title || `任务 #${id}`,
      value: mins,
      color: COLORS[i % COLORS.length],
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  const maxPomodoros = Math.max(...buckets.map((b) => b.pomodoros), 1);
  const maxInt = Math.max(...buckets.map((b) => b.intInt + b.extInt), 1);

  const rangeLabel = range === 'week' ? '本周' : range === 'month' ? '近月' : range === 'year' ? '年度' : '全部';
  const bucketUnit = range === 'year' || range === 'all' ? '月' : '天';

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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="text-sm text-gray-500">番茄总数</div>
          <div className="text-3xl font-bold text-red-500 mt-1">{totalPomodoros}</div>
          <div className="text-xs text-gray-400 mt-1">
            日均 {buckets.length > 0 ? (totalPomodoros / buckets.length).toFixed(1) : '0'} / {bucketUnit}
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="text-sm text-gray-500">专注时长</div>
          <div className="text-3xl font-bold text-blue-500 mt-1">{totalMinutes}</div>
          <div className="text-xs text-gray-400 mt-1">分钟（约 {(totalMinutes / 60).toFixed(1)} 小时）</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="text-sm text-gray-500">任务完成</div>
          <div className="text-3xl font-bold text-green-500 mt-1">{totalDone}/{totalTasks}</div>
          <div className="text-xs text-gray-400 mt-1">
            完成率 {totalTasks > 0 ? Math.round((totalDone / totalTasks) * 100) : 0}%
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="text-sm text-gray-500">中断次数</div>
          <div className="text-3xl font-bold text-yellow-500 mt-1">{totalIntInt + totalExtInt}</div>
          <div className="text-xs text-gray-400 mt-1">内 {totalIntInt} / 外 {totalExtInt}</div>
        </div>
      </div>

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

      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-700 mb-6">{rangeLabel}番茄数（每{bucketUnit}）</h3>
        <ColumnChart
          buckets={buckets}
          max={maxPomodoros}
          valueOf={(b) => b.pomodoros}
          renderBar={(b) => (
            <div
              className="w-full h-full bg-red-400 rounded-t-sm hover:bg-red-500"
              title={`${b.label}: ${b.pomodoros} 个番茄 / ${b.minutes} 分钟`}
            />
          )}
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-700 mb-6">{rangeLabel}中断记录（每{bucketUnit}）</h3>
        <ColumnChart
          buckets={buckets}
          max={maxInt}
          valueOf={(b) => b.intInt + b.extInt}
          renderBar={(b) => {
            const total = b.intInt + b.extInt;
            if (total === 0) return <div className="w-full h-full" />;
            return (
              <div className="w-full h-full flex flex-col-reverse" title={`${b.label}: 内 ${b.intInt} / 外 ${b.extInt}`}>
                <div className="w-full bg-yellow-400" style={{ height: `${(b.intInt / total) * 100}%` }} />
                <div className="w-full bg-orange-400" style={{ height: `${(b.extInt / total) * 100}%` }} />
              </div>
            );
          }}
        />
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
