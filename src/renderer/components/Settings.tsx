import { useState, useEffect } from 'react';

export default function Settings() {
  const [settings, setSettings] = useState<any>(null);

  useEffect(() => {
    window.api.getSettings().then(setSettings);
  }, []);

  const updateSetting = async (key: string, value: string | number | boolean) => {
    const strValue = typeof value === 'boolean' ? (value ? '1' : '0') : String(value);
    await window.api.updateSetting(key, strValue);
    setSettings((prev: any) => ({
      ...prev,
      [key]: typeof value === 'boolean' ? value : (typeof prev[key] === 'number' ? Number(value) : value),
    }));
  };

  if (!settings) return <div className="p-8 text-center text-gray-500">加载中...</div>;

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">设置</h2>

      {/* Timer Settings */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-700 mb-4">番茄钟</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-gray-600">工作时长（分钟）</label>
            <input
              type="number"
              value={settings.pomodoro_minutes}
              onChange={(e) => updateSetting('pomodoro_minutes', Math.max(1, Number(e.target.value)))}
              className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-center"
              min="1"
              max="120"
            />
          </div>
          <div className="flex items-center justify-between">
            <label className="text-gray-600">短休息时长（分钟）</label>
            <input
              type="number"
              value={settings.break_minutes}
              onChange={(e) => updateSetting('break_minutes', Math.max(1, Number(e.target.value)))}
              className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-center"
              min="1"
              max="60"
            />
          </div>
          <div className="flex items-center justify-between">
            <label className="text-gray-600">长休息时长（分钟）</label>
            <input
              type="number"
              value={settings.long_break_minutes}
              onChange={(e) => updateSetting('long_break_minutes', Math.max(1, Number(e.target.value)))}
              className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-center"
              min="1"
              max="60"
            />
          </div>
          <div className="flex items-center justify-between">
            <label className="text-gray-600">长休息间隔（番茄数）</label>
            <input
              type="number"
              value={settings.pomodoros_until_long_break}
              onChange={(e) => updateSetting('pomodoros_until_long_break', Math.max(1, Number(e.target.value)))}
              className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-center"
              min="1"
              max="20"
            />
          </div>
        </div>
      </div>

      {/* Behavior Settings */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-700 mb-4">行为</h3>
        <div className="space-y-4">
          <ToggleRow
            label="提示音"
            description="番茄钟结束时播放提示音"
            checked={settings.play_alarm}
            onChange={(v) => updateSetting('play_alarm', v)}
          />
          <ToggleRow
            label="滴答声"
            description="番茄钟运行时播放滴答声"
            checked={settings.play_ticking}
            onChange={(v) => updateSetting('play_ticking', v)}
          />
          <ToggleRow
            label="自动开始休息"
            description="番茄钟结束后自动开始休息"
            checked={settings.auto_start_break}
            onChange={(v) => updateSetting('auto_start_break', v)}
          />
          <ToggleRow
            label="自动开始下一个番茄钟"
            description="休息结束后自动开始新的番茄钟"
            checked={settings.auto_start_pomodoro}
            onChange={(v) => updateSetting('auto_start_pomodoro', v)}
          />
          <ToggleRow
            label="最小化到系统托盘"
            description="关闭窗口时最小化到托盘而非退出"
            checked={settings.minimize_to_tray}
            onChange={(v) => updateSetting('minimize_to_tray', v)}
          />
        </div>
      </div>

      {/* About */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-700 mb-4">关于</h3>
        <div className="text-gray-600 space-y-2">
          <p>XorTime Clone v1.0.0</p>
          <p className="text-sm text-gray-400">灵感来源于 XorTime by Antonio Fischetti</p>
          <p className="text-sm text-gray-400">使用 Electron + React + SQLite 构建</p>
        </div>
      </div>
    </div>
  );
}

function ToggleRow({ label, description, checked, onChange }: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="text-gray-600">{label}</div>
        <div className="text-sm text-gray-400">{description}</div>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative w-12 h-6 rounded-full transition-colors ${checked ? 'bg-blue-600' : 'bg-gray-300'}`}
      >
        <div
          className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-6' : 'translate-x-0.5'}`}
        />
      </button>
    </div>
  );
}
