import { useState, useEffect } from 'react';

export default function NextThings() {
  const [things, setThings] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [newThing, setNewThing] = useState({
    title: '',
    description: '',
    category_id: null as number | null,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [thingsData, categoriesData] = await Promise.all([
      window.api.getNextThings(),
      window.api.getCategories(),
    ]);
    setThings(thingsData);
    setCategories(categoriesData);
  };

  const handleAdd = async () => {
    if (!newThing.title.trim()) return;
    await window.api.createNextThing(newThing);
    setNewThing({ title: '', description: '', category_id: null });
    setShowAddForm(false);
    await loadData();
  };

  const handleDelete = async (id: number) => {
    await window.api.deleteNextThing(id);
    await loadData();
  };

  const handleUpdateTitle = async (id: number, title: string) => {
    await window.api.updateNextThing(id, { title });
    setEditingId(null);
    await loadData();
  };

  const getCategoryColor = (categoryId: number | null) => {
    const cat = categories.find(c => c.id === categoryId);
    return cat?.color || '#9ca3af';
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">收集箱</h2>
          <p className="text-sm text-gray-500 mt-1">随时记录灵感和想法，稍后整理到任务中</p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          + 新想法
        </button>
      </div>

      {showAddForm && (
        <div className="mb-6 p-6 bg-blue-50 rounded-xl">
          <input
            type="text"
            placeholder="想法标题"
            value={newThing.title}
            onChange={(e) => setNewThing({ ...newThing, title: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-3"
            autoFocus
          />
          <textarea
            placeholder="详细描述（可选）"
            value={newThing.description}
            onChange={(e) => setNewThing({ ...newThing, description: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-3"
            rows={3}
          />
          <select
            value={newThing.category_id || ''}
            onChange={(e) => setNewThing({ ...newThing, category_id: e.target.value ? Number(e.target.value) : null })}
            className="px-4 py-2 border border-gray-300 rounded-lg mb-3"
          >
            <option value="">选择分类（可选）</option>
            {categories.map((cat: any) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              添加
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

      <div className="space-y-3">
        {things.map((thing: any) => (
          <div
            key={thing.id}
            className="bg-white rounded-xl shadow-sm p-5 flex items-start gap-4 group"
          >
            <div
              className="w-2 h-2 rounded-full mt-2 flex-shrink-0"
              style={{ backgroundColor: getCategoryColor(thing.category_id) }}
            />
            <div className="flex-1 min-w-0">
              {editingId === thing.id ? (
                <input
                  type="text"
                  defaultValue={thing.title}
                  autoFocus
                  onBlur={(e) => handleUpdateTitle(thing.id, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleUpdateTitle(thing.id, (e.target as HTMLInputElement).value);
                    }
                    if (e.key === 'Escape') {
                      setEditingId(null);
                    }
                  }}
                  className="w-full px-2 py-1 border border-blue-300 rounded text-gray-800"
                />
              ) : (
                <div
                  className="font-medium text-gray-800 cursor-pointer hover:text-blue-600"
                  onDoubleClick={() => setEditingId(thing.id)}
                >
                  {thing.title}
                </div>
              )}
              {thing.description && (
                <p className="text-sm text-gray-500 mt-1 whitespace-pre-wrap">{thing.description}</p>
              )}
              <div className="text-xs text-gray-400 mt-2">
                {new Date(thing.created_at).toLocaleString('zh-CN')}
              </div>
            </div>
            <button
              onClick={() => handleDelete(thing.id)}
              className="opacity-0 group-hover:opacity-100 px-2 py-1 text-red-500 hover:bg-red-50 rounded text-sm transition-opacity"
            >
              删除
            </button>
          </div>
        ))}
      </div>

      {things.length === 0 && !showAddForm && (
        <div className="text-center py-12 text-gray-500">
          收集箱是空的，有什么新想法就记下来吧
        </div>
      )}
    </div>
  );
}
