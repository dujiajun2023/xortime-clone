import { useState, useEffect } from 'react';

export default function ProjectList() {
  const [projects, setProjects] = useState<any[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ name: '', description: '' });
  const [newProject, setNewProject] = useState({ name: '', description: '' });
  const [taskCounts, setTaskCounts] = useState<Record<number, number>>({});

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    const data = await window.api.getProjects();
    setProjects(data);

    // Load task counts for each project
    const counts: Record<number, number> = {};
    for (const project of data) {
      const tasks = await window.api.getTasks({ projectId: project.id, isDone: false, isArchived: false });
      counts[project.id] = tasks.length;
    }
    setTaskCounts(counts);
  };

  const handleCreateProject = async () => {
    if (!newProject.name.trim()) return;

    await window.api.createProject({
      ...newProject,
      is_active: true,
    });

    setNewProject({ name: '', description: '' });
    setShowAddForm(false);
    await loadProjects();
  };

  const handleStartEdit = (project: any) => {
    setEditingId(project.id);
    setEditForm({ name: project.name, description: project.description || '' });
  };

  const handleSaveEdit = async (id: number) => {
    if (!editForm.name.trim()) return;
    await window.api.updateProject(id, editForm);
    setEditingId(null);
    await loadProjects();
  };

  const handleDeleteProject = async (id: number) => {
    if (!confirm('确定要删除这个项目吗？项目下的任务不会被删除。')) return;
    await window.api.deleteProject(id);
    await loadProjects();
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">项目管理</h2>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          + 新建项目
        </button>
      </div>

      {showAddForm && (
        <div className="mb-6 p-6 bg-blue-50 rounded-xl">
          <input
            type="text"
            placeholder="项目名称"
            value={newProject.name}
            onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-3"
          />
          <textarea
            placeholder="项目描述（可选）"
            value={newProject.description}
            onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-3"
            rows={3}
          />
          <div className="flex gap-2">
            <button
              onClick={handleCreateProject}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              创建
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map((project: any) => (
          <div
            key={project.id}
            className={`bg-white rounded-xl shadow-sm p-6 border-l-4 ${
              project.is_active ? 'border-l-blue-500' : 'border-l-gray-400'
            }`}
          >
            {editingId === project.id ? (
              <>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-3"
                  autoFocus
                />
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-3"
                  rows={3}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSaveEdit(project.id)}
                    className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                  >
                    保存
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm"
                  >
                    取消
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg font-semibold text-gray-800">{project.name}</h3>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    project.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {project.is_active ? '进行中' : '已关闭'}
                  </span>
                </div>

                {project.description && (
                  <p className="text-gray-600 text-sm mb-4 line-clamp-3">{project.description}</p>
                )}

                <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                  <span>待办任务：{taskCounts[project.id] || 0}</span>
                  <span>创建于 {new Date(project.created_at).toLocaleDateString('zh-CN')}</span>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleStartEdit(project)}
                    className="flex-1 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 text-sm"
                  >
                    编辑
                  </button>
                  <button
                    onClick={() => handleDeleteProject(project.id)}
                    className="px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 text-sm"
                  >
                    删除
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {projects.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          还没有项目，点击上方按钮创建第一个项目
        </div>
      )}
    </div>
  );
}
