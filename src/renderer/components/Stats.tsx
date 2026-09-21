import { useState, useEffect } from 'react';

type DateRange = 'week' | 'month';

export default function Stats() {
  const [range, setRange] = useState<DateRange>('week');
  const [sessions, setSessions] = useState<any[]>([]);
  const [dailyData, setDailyData] = useState<{ date: string; pomodoros: number; done: number; total: number; intInt: number; extInt: number }[]>([]);

  useEffect(() => {
    loadStats();
  }, [range]);

  const loadStats = async () => {
    const end = new Date();
    const start = new Date();
    if (range === 'week') {
      start.setDate(start.getDate() - 6);
    } else {
      start.setDate(start.getDate() - 29);
    }

    const startDate = start.toISOString().split('T')[0];
    const endDate = end.toISOString().split('T')[0];

    const sessionData = await window.api.getPomodoroSessions({ startDate, endDate });
    setSessions(sessionData);

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
  const maxPomodoros = dailyData.length > 0 ? Math.max(...dailyData.map(d => d.pomodoros)) : 0;

  const maxBar = Math.max(maxPomodoros, 1);

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">统计报表</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setRange('week')}
            className={`px-4 py-2 rounded-lg ${range === 'week' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
          >
            本周
          </button>
          <button
            onClick={() => setRange('month')}
            className={`px-4 py-2 rounded-lg ${range === 'month' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
          >
            本月
          </button>
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
          <div className="text-sm text-gray-500">任务完成</div>
          <div className="text-3xl font-bold text-green-500 mt-1">{totalDone}/{totalTasks}</div>
          <div className="text-xs text-gray-400 mt-1">
            完成率 {totalTasks > 0 ? Math.round(totalDone / totalTasks * 100) : 0}%
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="text-sm text-gray-500">内部中断</div>
          <div className="text-3xl font-bold text-yellow-500 mt-1">{totalIntInt}</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="text-sm text-gray-500">外部中断</div>
          <div className="text-3xl font-bold text-orange-500 mt-1">{totalExtInt}</div>
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
