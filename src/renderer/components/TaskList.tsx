import { useState, useEffect } from 'react';

export default function TaskList() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [dailyTasks, setDailyTasks] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    category_id: null as number | null,
    project_id: null as number | null,
    estimated_pomodoros: 1,
    deadline: '' as string,
  });
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadDailyTasks();
  }, [selectedDate]);

  const loadData = async () => {
    const [tasksData, categoriesData, projectsData] = await Promise.all([
      window.api.getTasks({ isDone: false, isArchived: false }),
      window.api.getCategories(),
      window.api.getProjects(true),
    ]);
    setTasks(tasksData);
    setCategories(categoriesData);
    setProjects(projectsData);
  };

  const loadDailyTasks = async () => {
    const data = await window.api.getDailyTasks(selectedDate);
    setDailyTasks(data);
  };

  const handleAddTask = async () => {
    if (!newTask.title.trim()) return;

    await window.api.createTask({
      ...newTask,
      deadline: newTask.deadline || null,
      is_done: false,
      is_archived: false,
      actual_pomodoros: 0,
      sort_order: tasks.length,
    });

    setNewTask({ title: '', description: '', category_id: null, project_id: null, estimated_pomodoros: 1, deadline: '' });
    setShowAddForm(false);
    await loadData();
  };

  const handleAddToToday = async (task: any) => {
    await window.api.createDailyTask({
      task_id: task.id,
      date: selectedDate,
      estimated_pomodoros: task.estimated_pomodoros,
      actual_pomodoros: 0,
      internal_interruptions: 0,
      external_interruptions: 0,
      is_done: false,
    });
    await loadDailyTasks();
  };

  const handleToggleDone = async (dailyTask: any) => {
    await window.api.updateDailyTask(dailyTask.id, { is_done: !dailyTask.is_done });
    await loadDailyTasks();
  };

  const handleIncrementInterruption = async (dailyTaskId: number, type: 'internal' | 'external') => {
    await window.api.incrementInterruption(dailyTaskId, type);
    await loadDailyTasks();
  };

  const handleDeleteTask = async (id: number) => {
    await window.api.deleteTask(id);
    await loadData();
  };

  const handleUpdateTitle = async (id: number, title: string) => {
    if (!title.trim()) return;
    await window.api.updateTask(id, { title });
    setEditingId(null);
    await loadData();
  };

  const handleUpdatePomodoros = async (taskId: number, delta: number) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    const newVal = Math.max(1, task.estimated_pomodoros + delta);
    await window.api.updateTask(taskId, { estimated_pomodoros: newVal });
    await loadData();
  };

  const handleUpdateDailyPomodoros = async (dailyTaskId: number, currentEstimate: number, delta: number) => {
    const newVal = Math.max(1, currentEstimate + delta);
    await window.api.updateDailyTask(dailyTaskId, { estimated_pomodoros: newVal });
    await loadDailyTasks();
  };

  const handleUpdateActualPomodoros = async (dailyTaskId: number, currentActual: number, delta: number) => {
    const newVal = Math.max(0, currentActual + delta);
    await window.api.updateDailyTask(dailyTaskId, { actual_pomodoros: newVal });
    await loadDailyTasks();
  };

  const getCategoryColor = (categoryId: number | null) => {
    const cat = categories.find(c => c.id === categoryId);
    return cat?.color || '#9ca3af';
  };

  const getDeadlineStatus = (deadline: string | null) => {
    if (!deadline) return null;
    const now = new Date();
    const dl = new Date(deadline);
    const diff = dl.getTime() - now.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    if (days < 0) return { text: '已过期', color: 'text-red-600 bg-red-50' };
    if (days === 0) return { text: '今天到期', color: 'text-red-600 bg-red-50' };
    if (days <= 3) return { text: `${days}天后到期`, color: 'text-orange-600 bg-orange-50' };
    return { text: `${days}天后到期`, color: 'text-gray-500 bg-gray-50' };
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">今日任务</h2>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg"
        />
      </div>

      {/* Today's Tasks */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-700 mb-4">{selectedDate} 的任务</h3>
        {dailyTasks.length === 0 ? (
          <p className="text-gray-500 text-center py-8">今天还没有添加任务</p>
        ) : (
          <div className="space-y-3">
            {dailyTasks.map((dt: any) => (
              <div key={dt.id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                <input
                  type="checkbox"
                  checked={dt.is_done}
                  onChange={() => handleToggleDone(dt)}
                  className="w-5 h-5 rounded"
                />
                <div
                  className="w-1 h-12 rounded-full"
                  style={{ backgroundColor: getCategoryColor(dt.category_id) }}
                />
                <div className="flex-1">
                  <div className={`font-medium ${dt.is_done ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                    {dt.title}
                  </div>
                  <div className="text-sm text-gray-500 mt-1 flex items-center gap-2">
                    <span>预估</span>
                    <button
                      onClick={() => handleUpdateDailyPomodoros(dt.id, dt.estimated_pomodoros, -1)}
                      className="w-5 h-5 flex items-center justify-center bg-gray-200 text-gray-600 rounded hover:bg-gray-300 text-xs"
                    >
                      -
                    </button>
                    <span className="font-medium">{dt.estimated_pomodoros} 🍅</span>
                    <button
                      onClick={() => handleUpdateDailyPomodoros(dt.id, dt.estimated_pomodoros, 1)}
                      className="w-5 h-5 flex items-center justify-center bg-gray-200 text-gray-600 rounded hover:bg-gray-300 text-xs"
                    >
                      +
                    </button>
                    <span className="ml-2">| 实际</span>
                    <button
                      onClick={() => handleUpdateActualPomodoros(dt.id, dt.actual_pomodoros, -1)}
                      className="w-5 h-5 flex items-center justify-center bg-blue-200 text-blue-700 rounded hover:bg-blue-300 text-xs"
                    >
                      -
                    </button>
                    <span className="font-medium text-blue-700">{dt.actual_pomodoros} 🍅</span>
                    <button
                      onClick={() => handleUpdateActualPomodoros(dt.id, dt.actual_pomodoros, 1)}
                      className="w-5 h-5 flex items-center justify-center bg-blue-200 text-blue-700 rounded hover:bg-blue-300 text-xs"
                    >
                      +
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <button
                    onClick={() => handleIncrementInterruption(dt.id, 'internal')}
                    className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200"
                    title="内部中断"
                  >
                    内 {dt.internal_interruptions}
                  </button>
                  <button
                    onClick={() => handleIncrementInterruption(dt.id, 'external')}
                    className="px-2 py-1 bg-orange-100 text-orange-700 rounded hover:bg-orange-200"
                    title="外部中断"
                  >
                    外 {dt.external_interruptions}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Task Pool */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-700">任务池</h3>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            + 新建任务
          </button>
        </div>

        {showAddForm && (
          <div className="mb-6 p-4 bg-blue-50 rounded-lg">
            <input
              type="text"
              placeholder="任务标题"
              value={newTask.title}
              onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-3"
            />
            <textarea
              placeholder="任务描述（可选）"
              value={newTask.description}
              onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-3"
              rows={3}
            />
            <div className="flex gap-3 mb-3">
              <select
                value={newTask.category_id || ''}
                onChange={(e) => setNewTask({ ...newTask, category_id: e.target.value ? Number(e.target.value) : null })}
                className="px-4 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">选择分类</option>
                {categories.map((cat: any) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
              <select
                value={newTask.project_id || ''}
                onChange={(e) => setNewTask({ ...newTask, project_id: e.target.value ? Number(e.target.value) : null })}
                className="px-4 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">选择项目</option>
                {projects.map((proj: any) => (
                  <option key={proj.id} value={proj.id}>{proj.name}</option>
                ))}
              </select>
              <input
                type="number"
                placeholder="预估番茄数"
                value={newTask.estimated_pomodoros}
                onChange={(e) => setNewTask({ ...newTask, estimated_pomodoros: Number(e.target.value) })}
                className="px-4 py-2 border border-gray-300 rounded-lg w-32"
                min="1"
              />
            </div>
            <div className="flex gap-3 mb-3">
              <label className="flex items-center gap-2 text-sm text-gray-600">
                DDL：
                <input
                  type="date"
                  value={newTask.deadline}
                  onChange={(e) => setNewTask({ ...newTask, deadline: e.target.value })}
                  className="px-3 py-2 border border-gray-300 rounded-lg"
                />
              </label>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleAddTask}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                保存
              </button>
              <button
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                取消
              </button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {tasks.map((task: any) => {
            const dlStatus = getDeadlineStatus(task.deadline);
            return (
              <div key={task.id} className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 group">
                <div
                  className="w-1 h-12 rounded-full"
                  style={{ backgroundColor: getCategoryColor(task.category_id) }}
                />
                <div className="flex-1 min-w-0">
                  {editingId === task.id ? (
                    <input
                      type="text"
                      defaultValue={task.title}
                      autoFocus
                      onBlur={(e) => handleUpdateTitle(task.id, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleUpdateTitle(task.id, (e.target as HTMLInputElement).value);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      className="w-full px-2 py-1 border border-blue-300 rounded text-gray-800"
                    />
                  ) : (
                    <div
                      className="font-medium text-gray-800 cursor-pointer hover:text-blue-600"
                      onDoubleClick={() => setEditingId(task.id)}
                    >
                      {task.title}
                    </div>
                  )}
                  {task.description && <div className="text-sm text-gray-500 mt-1">{task.description}</div>}
                  {dlStatus && (
                    <span className={`inline-block text-xs px-2 py-0.5 rounded mt-1 ${dlStatus.color}`}>
                      {dlStatus.text}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 text-sm">
                  <button
                    onClick={() => handleUpdatePomodoros(task.id, -1)}
                    className="w-6 h-6 flex items-center justify-center bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
                  >
                    -
                  </button>
                  <span className="w-8 text-center text-gray-700">{task.estimated_pomodoros} 🍅</span>
                  <button
                    onClick={() => handleUpdatePomodoros(task.id, 1)}
                    className="w-6 h-6 flex items-center justify-center bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
                  >
                    +
                  </button>
                </div>
                <button
                  onClick={() => handleAddToToday(task)}
                  className="px-3 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 text-sm"
                >
                  加入今日
                </button>
                <button
                  onClick={() => handleDeleteTask(task.id)}
                  className="opacity-0 group-hover:opacity-100 px-2 py-1 text-red-500 hover:bg-red-50 rounded text-sm transition-opacity"
                >
                  删除
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
