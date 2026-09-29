import { useState, useEffect } from 'react';
import Timer from './components/Timer';
import TaskList from './components/TaskList';
import ProjectList from './components/ProjectList';
import Stats from './components/Stats';
import NextThings from './components/NextThings';
import Settings from './components/Settings';

type Tab = 'timer' | 'tasks' | 'projects' | 'stats' | 'next' | 'settings';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('timer');

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'timer', label: '番茄钟', icon: '🍅' },
    { id: 'tasks', label: '任务', icon: '✓' },
    { id: 'projects', label: '项目', icon: '📁' },
    { id: 'next', label: '收集箱', icon: '💡' },
    { id: 'stats', label: '统计', icon: '📊' },
    { id: 'settings', label: '设置', icon: '⚙' },
  ];

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-gray-800">XorTime</h1>
          <p className="text-sm text-gray-500 mt-1">番茄工作法</p>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                activeTab === tab.id
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <span className="text-xl">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {activeTab === 'timer' && <Timer />}
        {activeTab === 'tasks' && <TaskList />}
        {activeTab === 'projects' && <ProjectList />}
        {activeTab === 'next' && <NextThings />}
        {activeTab === 'stats' && <Stats />}
        {activeTab === 'settings' && <Settings />}
      </main>
    </div>
  );
}

export default App;
