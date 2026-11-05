import { useState, useEffect } from 'react';

type TaskFilter = 'active' | 'done' | 'archived';

export default function TaskList() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [dailyTasks, setDailyTasks] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [taskFilter, setTaskFilter] = useState<TaskFilter>('active');
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

  useEffect(() => {
    loadTasksByFilter();
  }, [taskFilter]);

  const loadTasksByFilter = async () => {
    let data: any[];
    if (taskFilter === 'active') {
      data = await window.api.getTasks({ isDone: false, isArchived: false });
    } else if (taskFilter === 'done') {
      data = await window.api.getTasks({ isDone: true, isArchived: false });
    } else {
      data = await window.api.getTasks({ isArchived: true });
    }
    setTasks(data);
  };

  const loadData = async () => {
    const [categoriesData, projectsData] = await Promise.all([
      window.api.getCategories(),
      window.api.getProjects(true),
    ]);
    setCategories(categoriesData);
    setProjects(projectsData);
    await loadTasksByFilter();
  };

  const loadDailyTasks = async () => {
    await window.api.syncRecurringTasks(selectedDate);
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

  const handleCompleteTask = async (id: number) => {
    await window.api.updateTask(id, { is_done: true });
    await loadTasksByFilter();
  };

  const handleArchiveTask = async (id: number) => {
    await window.api.updateTask(id, { is_archived: true });
    await loadTasksByFilter();
  };

  const handleToggleRecurring = async (task: any) => {
    await window.api.updateTask(task.id, { is_recurring: !task.is_recurring });
    await loadTasksByFilter();
  };

  const handleRestoreTask = async (id: number) => {
    await window.api.restoreTask(id);
    await loadTasksByFilter();
  };

  const handlePermanentDelete = async (id: number) => {
    if (!confirm('确定要永久删除这个任务吗？此操作不可恢复。')) return;
    await window.api.permanentDeleteTask(id);
    await loadTasksByFilter();
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
          <div className="flex items-center gap-4">
            <h3 className="text-lg font-semibold text-gray-700">任务池</h3>
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setTaskFilter('active')}
                className={`px-3 py-1 rounded-md text-sm transition-colors ${
                  taskFilter === 'active' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                进行中
              </button>
              <button
                onClick={() => setTaskFilter('done')}
                className={`px-3 py-1 rounded-md text-sm transition-colors ${
                  taskFilter === 'done' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                已完成
              </button>
              <button
                onClick={() => setTaskFilter('archived')}
                className={`px-3 py-1 rounded-md text-sm transition-colors ${
                  taskFilter === 'archived' ? 'bg-white text-gray-600 shadow-sm' : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                已废弃
              </button>
            </div>
          </div>
          {taskFilter === 'active' && (
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              + 新建任务
            </button>
          )}
        </div>

        {showAddForm && taskFilter === 'active' && (
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
                  {dlStatus && taskFilter === 'active' && (
                    <span className={`inline-block text-xs px-2 py-0.5 rounded mt-1 ${dlStatus.color}`}>
                      {dlStatus.text}
                    </span>
                  )}
                  {taskFilter === 'done' && task.completed_at && (
                    <div className="text-xs text-green-600 mt-1">
                      完成于 {new Date(task.completed_at).toLocaleString('zh-CN')}
                    </div>
                  )}
                </div>
                {taskFilter === 'active' && (
                  <>
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
                      disabled={dailyTasks.some((dt: any) => dt.task_id === task.id)}
                      className={`px-3 py-1 rounded text-sm ${
                        dailyTasks.some((dt: any) => dt.task_id === task.id)
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-green-100 text-green-700 hover:bg-green-200'
                      }`}
                    >
                      {dailyTasks.some((dt: any) => dt.task_id === task.id) ? '已加入' : '加入今日'}
                    </button>
                    <button
                      onClick={() => handleToggleRecurring(task)}
                      className={`px-3 py-1 rounded text-sm ${
                        task.is_recurring
                          ? 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                      title={task.is_recurring ? '已开启每日重复' : '开启每日重复'}
                    >
                      {task.is_recurring ? '🔁 每日' : '每日'}
                    </button>
                    <button
                      onClick={() => handleCompleteTask(task.id)}
                      className="px-3 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 text-sm"
                      title="标记为已完成"
                    >
                      完成
                    </button>
                    <button
                      onClick={() => handleArchiveTask(task.id)}
                      className="px-3 py-1 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 text-sm"
                      title="废弃此任务"
                    >
                      废弃
                    </button>
                  </>
                )}
                {taskFilter === 'done' && (
                  <button
                    onClick={() => handleArchiveTask(task.id)}
                    className="px-3 py-1 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 text-sm"
                    title="废弃此任务"
                  >
                    废弃
                  </button>
                )}
                {taskFilter === 'archived' && (
                  <>
                    <button
                      onClick={() => handleRestoreTask(task.id)}
                      className="px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-sm"
                    >
                      恢复
                    </button>
                    <button
                      onClick={() => handlePermanentDelete(task.id)}
                      className="px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 text-sm"
                    >
                      永久删除
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {tasks.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            {taskFilter === 'active' && '没有进行中的任务'}
            {taskFilter === 'done' && '没有已完成的任务'}
            {taskFilter === 'archived' && '没有已废弃的任务'}
          </div>
        )}
      </div>
    </div>
  );
}
