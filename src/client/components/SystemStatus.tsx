import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, Cpu, HardDrive, ShieldAlert } from 'lucide-react';

type UsageSample = {
  cpu: number;
  memory: number;
  timeLabel: string;
};

type LiveStats = {
  cpu: number;
  memory: number;
  totalMemoryGB: string;
  usedMemoryGB: string;
  cpuCores: number;
  uptime: number;
};

function formatUptime(seconds: number) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m`;
}

export function SystemStatus() {
  const [stats, setStats] = useState<LiveStats | null>(null);
  const [history, setHistory] = useState<UsageSample[]>([]);
  const [activeMetric, setActiveMetric] = useState<'cpu' | 'memory'>('cpu');
  const [hovered, setHovered] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/system/usage');
      if (!res.ok) throw new Error(`System endpoint returned ${res.status}`);
      const data = await res.json();
      setStats(data);
      setError(null);
      const now = new Date();
      const timeLabel = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setHistory((prev) => [...prev, { cpu: data.cpu, memory: data.memory, timeLabel }].slice(-18));
    } catch (e: any) {
      setError(e.message || 'Unable to read local telemetry');
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const timer = setInterval(fetchStats, 2000);
    return () => clearInterval(timer);
  }, [fetchStats]);

  const chart = useMemo(() => {
    const width = 520;
    const height = 150;
    if (history.length < 2) return { width, height, line: '', area: '', points: [] as any[] };
    const points = history.map((sample, index) => {
      const x = 18 + (index / (history.length - 1)) * (width - 36);
      const value = sample[activeMetric];
      const y = height - 18 - (value / 100) * (height - 36);
      return { x, y, value, label: sample.timeLabel };
    });
    const line = points.reduce((path, point, index) => index === 0 ? `M ${point.x} ${point.y}` : `${path} L ${point.x} ${point.y}`, '');
    const area = `${line} L ${points[points.length - 1].x} ${height - 18} L ${points[0].x} ${height - 18} Z`;
    return { width, height, line, area, points };
  }, [history, activeMetric]);

  const health = !stats ? 'SYNCING' : Math.max(stats.cpu, stats.memory) > 80 ? 'ELEVATED' : 'NOMINAL';

  return (
    <section className="rounded-[2rem] border border-white/10 bg-black/20 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-xl md:p-6">
      <div className="mb-5 flex items-center justify-between border-b border-white/10 pb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-blue-400/20 bg-blue-500/10 text-blue-300">
            <Activity size={18} />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">Live Diagnostics</h2>
            <p className="mt-1 text-sm text-zinc-500">Local server resource telemetry</p>
          </div>
        </div>
        <span className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${health === 'NOMINAL' ? 'border-emerald-400/25 bg-emerald-500/10 text-emerald-200' : health === 'ELEVATED' ? 'border-amber-400/25 bg-amber-500/10 text-amber-200' : 'border-blue-400/25 bg-blue-500/10 text-blue-200'}`}>{health}</span>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-2xl border border-rose-400/20 bg-rose-500/10 p-3 text-sm text-rose-200">
          <ShieldAlert size={16} /> {error}
        </div>
      )}

      <div className="mb-4 grid grid-cols-2 gap-3">
        <button onClick={() => setActiveMetric('cpu')} className={`rounded-2xl border p-4 text-left transition ${activeMetric === 'cpu' ? 'border-blue-400/40 bg-blue-500/15' : 'border-white/10 bg-white/[0.03]'}`}>
          <div className="mb-3 flex items-center gap-2 text-sm text-zinc-400"><Cpu size={16} /> CPU</div>
          <p className="text-2xl font-semibold text-white">{stats ? `${stats.cpu}%` : '--'}</p>
          <p className="mt-1 text-xs text-zinc-600">{stats ? `${stats.cpuCores} cores` : 'syncing'}</p>
        </button>
        <button onClick={() => setActiveMetric('memory')} className={`rounded-2xl border p-4 text-left transition ${activeMetric === 'memory' ? 'border-blue-400/40 bg-blue-500/15' : 'border-white/10 bg-white/[0.03]'}`}>
          <div className="mb-3 flex items-center gap-2 text-sm text-zinc-400"><HardDrive size={16} /> Memory</div>
          <p className="text-2xl font-semibold text-white">{stats ? `${stats.memory}%` : '--'}</p>
          <p className="mt-1 text-xs text-zinc-600">{stats ? `${stats.usedMemoryGB}G / ${stats.totalMemoryGB}G` : 'syncing'}</p>
        </button>
      </div>

      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-black/30 p-3">
        {history.length < 2 ? (
          <div className="flex h-40 items-center justify-center text-sm text-zinc-500">Synchronizing telemetry...</div>
        ) : (
          <svg viewBox={`0 0 ${chart.width} ${chart.height}`} className="h-44 w-full overflow-visible">
            <defs>
              <linearGradient id="diagnostic-area" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.32" />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
              </linearGradient>
            </defs>
            {[0, 1, 2, 3].map((i) => <line key={i} x1="18" x2={chart.width - 18} y1={18 + i * 36} y2={18 + i * 36} stroke="rgba(255,255,255,.08)" />)}
            <path d={chart.area} fill="url(#diagnostic-area)" />
            <path d={chart.line} fill="none" stroke="#60a5fa" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            {chart.points.map((point, idx) => (
              <g key={idx}>
                <circle cx={point.x} cy={point.y} r="10" fill="transparent" onMouseEnter={() => setHovered(idx)} onMouseLeave={() => setHovered(null)} />
                {(hovered === idx || idx === chart.points.length - 1) && <circle cx={point.x} cy={point.y} r="4" fill="#bfdbfe" stroke="#2563eb" strokeWidth="2" />}
              </g>
            ))}
          </svg>
        )}
        {hovered !== null && chart.points[hovered] && (
          <div className="absolute right-4 top-4 rounded-xl border border-blue-400/20 bg-blue-500/10 px-3 py-2 font-mono text-xs text-blue-100">
            {chart.points[hovered].label} · {chart.points[hovered].value}%
          </div>
        )}
      </div>

      {stats && <p className="mt-4 text-xs text-zinc-600">Server uptime: {formatUptime(stats.uptime)}</p>}
    </section>
  );
}
