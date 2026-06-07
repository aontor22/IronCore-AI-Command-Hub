import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Archive,
  Bell,
  Bot,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock3,
  Code2,
  Cpu,
  Database,
  FileText,
  FolderOpen,
  Gauge,
  Globe2,
  HardDrive,
  Home,
  Layers3,
  ListChecks,
  MemoryStick,
  Mic,
  Paperclip,
  Plus,
  Radio,
  RefreshCw,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Trash2,
  UploadCloud,
  Volume2,
  Wand2,
  Wifi,
  X,
} from 'lucide-react';
import { Memory } from '../hooks/useMemories';
import { Task, TaskInput } from '../hooks/useTasks';
import { useChat } from '../hooks/useChat';
import { apiFetch, compactDate } from '../lib/api';

type DashboardProps = {
  tasks: Task[];
  memories: Memory[];
  taskLoading: boolean;
  memoryLoading: boolean;
  memoryQuery: string;
  setMemoryQuery: (value: string) => void;
  addTask: (task: TaskInput) => Promise<void>;
  updateTask: (id: number, patch: Partial<TaskInput> & { status?: 'pending' | 'completed' }) => Promise<void>;
  deleteTask: (id: number) => Promise<void>;
  toggleTaskStatus: (id: number, currentStatus: 'pending' | 'completed') => Promise<void>;
  addMemory: (content: string) => Promise<void>;
  deleteMemory: (id: number) => Promise<void>;
  fetchMemories: (query?: string) => Promise<void>;
  refreshAll: () => Promise<void>;
};

type Tab = 'dashboard' | 'chat' | 'tasks' | 'memory' | 'files' | 'extensions' | 'settings';

type Health = {
  ok: boolean;
  status: string;
  dbOk: boolean;
  model: string;
  hasGeminiKey: boolean;
  hasBraveKey: boolean;
  timestamp: string;
};

type UploadedFile = {
  id: number;
  name: string;
  mimeType: string;
  summary: string | null;
  createdAt: string;
};

const navItems: Array<{ id: Tab; label: string; icon: any }> = [
  { id: 'dashboard', label: 'Dashboard', icon: Home },
  { id: 'chat', label: 'Chat', icon: Bot },
  { id: 'tasks', label: 'Tasks', icon: ListChecks },
  { id: 'memory', label: 'Memory', icon: MemoryStick },
  { id: 'files', label: 'Files', icon: FolderOpen },
  { id: 'extensions', label: 'Extensions', icon: Layers3 },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const quickActions = [
  { label: 'Deep Research', icon: Search, prompt: 'Do a deep research plan for my current project and list the exact next steps.' },
  { label: 'Summarize', icon: FileText, prompt: 'Summarize the latest work context and show the key points.' },
  { label: 'Create Task', icon: Plus, prompt: 'Create a high priority task to review the IronCore assistant UI tomorrow.' },
  { label: 'Code Assist', icon: Code2, prompt: 'Act as my coding assistant and inspect the current implementation conceptually.' },
  { label: 'Automate', icon: Wand2, prompt: 'Suggest 5 safe automations I can add to this assistant.' },
];

function cx(...classes: Array<string | false | undefined | null>) {
  return classes.filter(Boolean).join(' ');
}

function speak(text: string) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text.replace(/[*_`>#]/g, '').slice(0, 900));
  utterance.rate = 0.94;
  utterance.pitch = 0.92;
  window.speechSynthesis.speak(utterance);
}

function HudPanel({ children, title, count, action, className = '' }: { children: ReactNode; title?: string; count?: string | number; action?: ReactNode; className?: string }) {
  return (
    <section className={cx('hud-panel group relative overflow-hidden rounded-[1.35rem] p-4', className)}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-3 border-b border-cyan-300/10 pb-3">
          <div className="flex items-center gap-2">
            {title && <h3 className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-cyan-200">{title}</h3>}
            {count !== undefined && <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2 py-0.5 font-mono text-[10px] text-cyan-200">{count}</span>}
          </div>
          {action ?? <span className="font-mono text-cyan-300/60">•••</span>}
        </div>
      )}
      {children}
    </section>
  );
}

function MiniMeter({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.16em] text-cyan-100/70">
        <span>{label}</span>
        <span className="text-cyan-200">{value}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-cyan-950/80">
        <div className="h-full rounded-full bg-cyan-300 shadow-[0_0_14px_rgba(34,211,238,.8)]" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      </div>
    </div>
  );
}

function RadialGauge({ label, value, size = 76 }: { label: string; value: number; size?: number }) {
  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(100, Math.max(0, value)) / 100) * circumference;
  return (
    <div className="flex flex-col items-center justify-center gap-2 text-center">
      <svg width={size} height={size} viewBox="0 0 80 80" className="drop-shadow-[0_0_14px_rgba(34,211,238,.55)]">
        <circle cx="40" cy="40" r={radius} fill="rgba(8,28,48,.65)" stroke="rgba(34,211,238,.16)" strokeWidth="7" />
        <circle cx="40" cy="40" r={radius} fill="none" stroke="rgba(34,211,238,.88)" strokeWidth="7" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" transform="rotate(-90 40 40)" />
        <circle cx="40" cy="40" r="23" fill="rgba(2,8,18,.72)" stroke="rgba(125,249,255,.28)" />
        <text x="40" y="38" textAnchor="middle" className="fill-cyan-100 font-mono text-[13px] font-bold">{value}</text>
        <text x="40" y="51" textAnchor="middle" className="fill-cyan-300/80 font-mono text-[6px] uppercase">{label}</text>
      </svg>
    </div>
  );
}

function Sidebar({ active, setActive, health, pendingTasks }: { active: Tab; setActive: (tab: Tab) => void; health: Health | null; pendingTasks: number }) {
  return (
    <aside className="hidden h-screen w-[268px] shrink-0 border-r border-cyan-300/12 bg-[#030b16]/88 p-4 shadow-[inset_-1px_0_0_rgba(34,211,238,.08)] backdrop-blur-2xl lg:flex lg:flex-col">
      <div className="mb-7 flex items-center gap-3 rounded-2xl border border-cyan-300/16 bg-cyan-300/[0.04] p-3">
        <div className="hex-badge flex h-12 w-12 items-center justify-center text-cyan-100">
          <ShieldCheck size={25} />
        </div>
        <div>
          <h1 className="font-mono text-xl font-bold tracking-[0.08em] text-cyan-50">IRONCORE</h1>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-cyan-300/80">Assistant Core</p>
        </div>
      </div>

      <nav className="grid gap-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const selected = active === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActive(item.id)}
              className={cx(
                'group flex items-center gap-3 rounded-2xl border px-3 py-3 text-left text-sm transition duration-200',
                selected
                  ? 'border-cyan-300/40 bg-cyan-300/12 text-cyan-50 shadow-[0_0_26px_rgba(34,211,238,.22)]'
                  : 'border-transparent text-cyan-100/62 hover:border-cyan-300/18 hover:bg-cyan-300/[0.05] hover:text-cyan-50'
              )}
            >
              <span className={cx('flex h-9 w-9 items-center justify-center rounded-xl border transition', selected ? 'border-cyan-300/40 bg-cyan-300/16 text-cyan-100' : 'border-cyan-300/10 bg-cyan-950/35 text-cyan-300/70')}>
                <Icon size={18} />
              </span>
              <span className="font-medium">{item.label}</span>
              {item.id === 'tasks' && pendingTasks > 0 && <span className="ml-auto rounded-full bg-cyan-300 px-2 py-0.5 font-mono text-[10px] font-bold text-slate-950">{pendingTasks}</span>}
            </button>
          );
        })}
      </nav>

      <div className="mt-auto grid gap-4">
        <HudPanel title="Core Status">
          <div className="mx-auto mb-4 flex justify-center">
            <div className="status-orb flex h-36 w-36 items-center justify-center rounded-full text-center">
              <div>
                <p className="text-3xl font-semibold text-cyan-50">100%</p>
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-cyan-300">Optimal</p>
              </div>
            </div>
          </div>
          <div className="grid gap-3">
            <MiniMeter label="CPU" value={24} />
            <MiniMeter label="Memory" value={53} />
            <MiniMeter label="Network" value={68} />
          </div>
        </HudPanel>
        <div className="flex items-center justify-between rounded-2xl border border-cyan-300/12 bg-cyan-300/[0.04] px-4 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-cyan-200/80">
          <span className="flex items-center gap-2"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-300" /> Synced</span>
          <span>{health?.hasGeminiKey ? 'AI Linked' : 'API Needed'}</span>
        </div>
      </div>
    </aside>
  );
}

function TopBar({ health, refreshAll }: { health: Health | null; refreshAll: () => Promise<void> }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="sticky top-0 z-20 mb-5 border-b border-cyan-300/10 bg-[#020812]/72 px-4 py-3 backdrop-blur-xl lg:px-6">
      <div className="flex items-center justify-between gap-4">
        <div className="hidden items-center gap-3 rounded-full border border-cyan-300/12 bg-cyan-300/[0.04] px-4 py-2 font-mono text-[11px] uppercase tracking-[0.2em] text-cyan-200 md:flex">
          <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-300 shadow-[0_0_18px_rgba(34,211,238,.9)]" /> Core Online
        </div>
        <div className="mx-auto hidden min-w-[320px] items-center justify-center rounded-full border border-cyan-300/12 bg-cyan-950/20 px-8 py-2 font-mono text-[11px] uppercase tracking-[0.28em] text-cyan-200/80 xl:flex">
          Secure <span className="mx-4 text-cyan-500/60">•</span> Private <span className="mx-4 text-cyan-500/60">•</span> Adaptive
        </div>
        <div className="ml-auto flex items-center gap-3">
          <button onClick={refreshAll} className="hud-icon-button" title="Refresh data"><RefreshCw size={16} /></button>
          <div className="hidden text-right font-mono sm:block">
            <p className="text-lg font-bold tracking-wider text-cyan-100">{now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p>
            <p className="text-[10px] uppercase tracking-[0.18em] text-cyan-300/60">{now.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</p>
          </div>
          <span className={cx('rounded-full border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em]', health?.hasGeminiKey ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-200' : 'border-rose-300/20 bg-rose-300/10 text-rose-200')}>{health?.hasGeminiKey ? 'Gemini' : 'No Key'}</span>
          <button className="hud-icon-button"><Bell size={16} /></button>
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-cyan-300/18 bg-cyan-300/10 font-mono text-xs font-bold text-cyan-100">OR</div>
        </div>
      </div>
    </header>
  );
}

function CoreOrb({ active, pendingTasks, memoryCount, fileCount, onClick }: { active: Tab; pendingTasks: number; memoryCount: number; fileCount: number; onClick: () => void }) {
  return (
    <div className="relative mx-auto flex min-h-[440px] items-center justify-center py-4">
      <div className="absolute left-2 top-1/2 hidden -translate-y-1/2 lg:block"><RadialGauge label="Focus" value={74} size={86} /></div>
      <div className="absolute right-2 top-1/2 hidden -translate-y-1/2 lg:block"><RadialGauge label="Confidence" value={92} size={86} /></div>

      <button onClick={onClick} className="core-orb group relative flex h-[360px] w-[360px] items-center justify-center rounded-full md:h-[440px] md:w-[440px]" title="Cycle dashboard mode">
        <span className="core-ring ring-one" />
        <span className="core-ring ring-two" />
        <span className="core-ring ring-three" />
        <span className="core-ring ring-four" />
        <span className="core-scan" />
        <span className="absolute h-[44%] w-[44%] rounded-full border border-cyan-200/50 bg-[#02101f]/84 shadow-[0_0_60px_rgba(34,211,238,.34),inset_0_0_50px_rgba(34,211,238,.08)]" />
        <span className="relative z-10 text-center">
          <span className="block font-mono text-[11px] uppercase tracking-[0.26em] text-cyan-300/90">Assistant Core</span>
          <span className="mt-3 block text-4xl font-semibold tracking-[0.08em] text-cyan-50 md:text-5xl">IRONCORE</span>
          <span className="mx-auto mt-4 flex h-8 w-40 items-end justify-center gap-1 opacity-90">
            {Array.from({ length: 26 }).map((_, idx) => <span key={idx} className="wave-bar" style={{ animationDelay: `${idx * 42}ms`, height: `${9 + ((idx * 13) % 22)}px` }} />)}
          </span>
          <span className="mt-4 grid grid-cols-3 gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-cyan-200/70">
            <span>{pendingTasks} Tasks</span>
            <span>{memoryCount} Memories</span>
            <span>{fileCount} Files</span>
          </span>
          <span className="mt-4 block rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-cyan-200">Mode {active}</span>
        </span>
      </button>
    </div>
  );
}

function ActiveTasksPanel({ tasks, onNewTask, toggleTaskStatus }: { tasks: Task[]; onNewTask: () => void; toggleTaskStatus: DashboardProps['toggleTaskStatus'] }) {
  const top = tasks.filter((task) => task.status === 'pending').slice(0, 3);
  return (
    <HudPanel title="Active Tasks" count={top.length}>
      <div className="grid gap-3">
        {top.length === 0 && <p className="rounded-2xl border border-cyan-300/10 bg-cyan-300/[0.04] p-3 text-sm text-cyan-100/60">No active directives. Add one to initialize the queue.</p>}
        {top.map((task, index) => {
          const progress = task.priority === 'high' ? 75 : task.priority === 'medium' ? 52 : 34;
          return (
            <button key={task.id} onClick={() => toggleTaskStatus(task.id, task.status)} className="group/task text-left">
              <div className="mb-1 flex items-center justify-between gap-2 text-sm text-cyan-50">
                <span className="truncate">{task.title}</span>
                <span className="font-mono text-xs text-cyan-300">{progress}%</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-1.5 flex-1 rounded-full bg-cyan-950/80"><div className="h-full rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(34,211,238,.72)]" style={{ width: `${progress}%` }} /></div>
                <span className="font-mono text-[10px] uppercase text-cyan-300/55">ETA {12 + index * 8}m</span>
              </div>
            </button>
          );
        })}
      </div>
      <div className="mt-4 flex items-center justify-between font-mono text-[11px]">
        <button onClick={onNewTask} className="flex items-center gap-1.5 text-cyan-300 hover:text-cyan-100"><Plus size={13} /> New Task</button>
        <span className="text-cyan-300/55">View All</span>
      </div>
    </HudPanel>
  );
}

function ReminderPanel({ tasks }: { tasks: Task[] }) {
  const upcoming = tasks.filter((task) => task.status === 'pending').slice(0, 2);
  return (
    <HudPanel title="Upcoming Reminders" count={upcoming.length}>
      <div className="grid gap-3">
        {upcoming.length === 0 && <p className="text-sm text-cyan-100/55">No dated reminders are active.</p>}
        {upcoming.map((task, idx) => (
          <div key={task.id} className="flex items-center gap-3 rounded-2xl border border-cyan-300/10 bg-cyan-300/[0.035] p-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-300/10 text-cyan-200">{idx === 0 ? <CalendarClock size={17} /> : <Archive size={17} />}</span>
            <div className="min-w-0">
              <p className="truncate text-sm text-cyan-50">{task.title}</p>
              <p className="text-xs text-cyan-300/55">{compactDate(task.dueDate)}</p>
            </div>
          </div>
        ))}
      </div>
      <button className="mt-4 font-mono text-[11px] text-cyan-300 hover:text-cyan-100">View Calendar</button>
    </HudPanel>
  );
}

function MemorySnapshots({ memories }: { memories: Memory[] }) {
  return (
    <HudPanel title="Memory Snapshots" count={memories.length}>
      <div className="grid gap-3">
        {memories.slice(0, 3).map((memory) => (
          <div key={memory.id} className="flex gap-3 rounded-2xl border border-cyan-300/10 bg-cyan-300/[0.035] p-3">
            <Database size={15} className="mt-0.5 shrink-0 text-cyan-300" />
            <p className="line-clamp-2 text-sm leading-relaxed text-cyan-50/75">{memory.content}</p>
          </div>
        ))}
        {memories.length === 0 && <p className="text-sm text-cyan-100/55">Memory core is empty. Save a preference from chat.</p>}
      </div>
    </HudPanel>
  );
}

function SystemStatusPanel({ health }: { health: Health | null }) {
  return (
    <HudPanel title="System Status">
      <div className="grid grid-cols-4 gap-3">
        <RadialGauge label="CPU" value={24} size={68} />
        <RadialGauge label="RAM" value={53} size={68} />
        <RadialGauge label="Store" value={68} size={68} />
        <RadialGauge label="GPU" value={36} size={68} />
      </div>
      <div className="mt-4 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.16em] text-cyan-100/62">
        <span>System Health</span>
        <span className={health?.ok ? 'text-emerald-300' : 'text-rose-300'}>{health?.ok ? 'Optimal' : 'Limited'}</span>
      </div>
      <div className="mt-2 flex gap-1">
        {Array.from({ length: 34 }).map((_, idx) => <span key={idx} className="h-1 flex-1 rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(34,211,238,.65)]" style={{ opacity: 0.35 + (idx % 8) * 0.07 }} />)}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-cyan-100/65">
        <div><p className="font-mono text-[10px] uppercase tracking-[0.16em] text-cyan-300/55">Model</p><p className="mt-1 truncate text-cyan-50">{health?.model || 'syncing'}</p></div>
        <div><p className="font-mono text-[10px] uppercase tracking-[0.16em] text-cyan-300/55">Database</p><p className="mt-1 text-cyan-50">{health?.dbOk ? 'Online' : 'Checking'}</p></div>
      </div>
    </HudPanel>
  );
}

function RecentActivity({ messages, tasks, files }: { messages: Array<{ role: string; content: string; createdAt: string }>; tasks: Task[]; files: UploadedFile[] }) {
  const rows = useMemo(() => {
    const chatRows = messages.slice(-4).reverse().map((message) => ({ time: new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), text: `${message.role === 'user' ? 'Command' : 'Assistant'}: ${message.content.slice(0, 52)}` }));
    const taskRows = tasks.slice(0, 2).map((task) => ({ time: 'Task', text: task.title }));
    const fileRows = files.slice(0, 1).map((file) => ({ time: 'File', text: `Uploaded: ${file.name}` }));
    return [...chatRows, ...taskRows, ...fileRows].slice(0, 6);
  }, [messages, tasks, files]);
  return (
    <HudPanel title="Recent Activity" action={<span className="flex items-center gap-1 font-mono text-[10px] text-emerald-300">Live <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" /></span>}>
      <div className="grid gap-3">
        {rows.length === 0 && <p className="text-sm text-cyan-100/55">No activity yet. Send a command to begin.</p>}
        {rows.map((row, idx) => (
          <div key={`${row.time}-${idx}`} className="grid grid-cols-[60px_1fr_auto] items-center gap-3 text-sm">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-cyan-300/50">{row.time}</span>
            <span className="truncate text-cyan-50/75">{row.text}</span>
            <span className="text-cyan-300/35">••</span>
          </div>
        ))}
      </div>
    </HudPanel>
  );
}

function QuickActions({ onPrompt }: { onPrompt: (prompt: string) => Promise<void> }) {
  return (
    <HudPanel title="Quick Actions">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5 xl:grid-cols-5">
        {quickActions.map((action) => {
          const Icon = action.icon;
          return (
            <button key={action.label} onClick={() => onPrompt(action.prompt)} className="group rounded-2xl border border-cyan-300/12 bg-cyan-300/[0.04] p-3 text-center transition hover:border-cyan-300/35 hover:bg-cyan-300/10 hover:shadow-[0_0_22px_rgba(34,211,238,.16)]">
              <span className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-300/15 bg-cyan-950/60 text-cyan-200 group-hover:text-cyan-50"><Icon size={17} /></span>
              <span className="block text-[11px] font-medium text-cyan-100/75">{action.label}</span>
            </button>
          );
        })}
      </div>
    </HudPanel>
  );
}

function VoiceAssistantCard({ isListening, startVoice }: { isListening: boolean; startVoice: () => void }) {
  return (
    <HudPanel title="Voice Assistant">
      <div className="flex items-center gap-4">
        <div className="min-w-0 flex-1">
          <p className="mb-3 text-sm text-cyan-50/70">{isListening ? 'Listening...' : 'Standby. Tap the mic to speak.'}</p>
          <div className="flex h-12 items-center gap-1 overflow-hidden">
            {Array.from({ length: 44 }).map((_, idx) => <span key={idx} className="voice-wave" style={{ animationDelay: `${idx * 28}ms`, height: `${8 + ((idx * 9) % 36)}px` }} />)}
          </div>
        </div>
        <button onClick={startVoice} className={cx('flex h-16 w-16 shrink-0 items-center justify-center rounded-full border transition', isListening ? 'border-cyan-200 bg-cyan-300 text-slate-950 shadow-[0_0_45px_rgba(34,211,238,.65)]' : 'border-cyan-300/30 bg-cyan-300/10 text-cyan-100 hover:bg-cyan-300/18')}>
          <Mic size={26} />
        </button>
      </div>
    </HudPanel>
  );
}

function FilesBrowserContext({ files }: { files: UploadedFile[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <HudPanel title="Files" count={files.length}>
        <div className="grid gap-2">
          {files.slice(0, 4).map((file) => <div key={file.id} className="flex items-center justify-between gap-2 text-sm"><span className="truncate text-cyan-50/75">{file.name}</span><span className="font-mono text-[10px] text-cyan-300/55">TXT</span></div>)}
          {files.length === 0 && <p className="text-sm text-cyan-100/55">No files uploaded.</p>}
        </div>
        <p className="mt-3 font-mono text-[11px] text-cyan-300">View All Files</p>
      </HudPanel>
      <HudPanel title="Browser Context" count="3">
        <div className="grid gap-3 text-sm">
          <p><span className="rounded bg-orange-400 px-1.5 py-0.5 text-slate-950">P</span> <span className="ml-2 text-cyan-50/75">Product Hunt</span></p>
          <p><span className="rounded bg-white px-1.5 py-0.5 text-slate-950">N</span> <span className="ml-2 text-cyan-50/75">Notion Roadmap</span></p>
          <p><span className="rounded bg-cyan-300 px-1.5 py-0.5 text-slate-950">G</span> <span className="ml-2 text-cyan-50/75">GitHub Repo</span></p>
        </div>
        <p className="mt-3 font-mono text-[11px] text-cyan-300">Open New Tab</p>
      </HudPanel>
      <HudPanel title="Extensions" count="4">
        <div className="grid gap-2 text-sm text-cyan-50/75">
          {['Web Search', 'Code Interpreter', 'PDF Reader', 'Image Generator'].map((item) => <p key={item} className="flex items-center justify-between"><span>{item}</span><span className="font-mono text-[10px] text-emerald-300">Enabled</span></p>)}
        </div>
        <p className="mt-3 font-mono text-[11px] text-cyan-300">Manage Extensions</p>
      </HudPanel>
    </div>
  );
}

function ChatDock({ onSubmit, isLoading, onVoice, onSpeak, isListening }: { onSubmit: (text: string) => Promise<void>; isLoading: boolean; onVoice: () => void; onSpeak: () => void; isListening: boolean }) {
  const [input, setInput] = useState('');
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || isLoading) return;
    setInput('');
    await onSubmit(text);
  };

  return (
    <div className="hud-panel sticky bottom-4 z-30 mx-auto mt-4 flex max-w-5xl items-center gap-3 rounded-[1.6rem] p-3 shadow-[0_0_45px_rgba(34,211,238,.24)]">
      <div className="hidden items-center gap-3 pl-2 pr-3 md:flex">
        <div className="hex-badge flex h-11 w-11 items-center justify-center text-cyan-50"><Bot size={22} /></div>
        <div>
          <p className="font-medium text-cyan-50">Good morning, Orion.</p>
          <p className="text-xs text-cyan-300/62">How can I assist you today?</p>
        </div>
      </div>
      <form onSubmit={submit} className="flex min-w-0 flex-1 items-center gap-2 rounded-[1.25rem] border border-cyan-300/15 bg-slate-950/46 p-2">
        <button type="button" className="hud-icon-button"><Paperclip size={17} /></button>
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Type your message..." className="min-w-0 flex-1 bg-transparent px-2 text-sm text-cyan-50 outline-none placeholder:text-cyan-200/35" />
        <button type="button" onClick={onVoice} className={cx('hud-icon-button', isListening && 'border-cyan-200 bg-cyan-300 text-slate-950')}><Mic size={17} /></button>
        <button type="button" onClick={onSpeak} className="hud-icon-button"><Volume2 size={17} /></button>
        <button type="submit" disabled={isLoading || !input.trim()} className="flex h-11 w-12 items-center justify-center rounded-2xl border border-cyan-200/30 bg-cyan-300/18 text-cyan-50 shadow-[0_0_24px_rgba(34,211,238,.28)] transition hover:bg-cyan-300/28 disabled:opacity-45"><Send size={18} /></button>
      </form>
    </div>
  );
}

function TaskForm({ onAdd }: { onAdd: (task: TaskInput) => Promise<void> }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [category, setCategory] = useState('project');
  const [dueDate, setDueDate] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);
    try {
      await onAdd({ title, description, priority, category, dueDate: dueDate ? new Date(dueDate).toISOString() : undefined });
      setTitle('');
      setDescription('');
      setDueDate('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-3 rounded-3xl border border-cyan-300/12 bg-cyan-300/[0.035] p-4 md:grid-cols-12">
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="New directive title" className="hud-input md:col-span-4" />
      <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" className="hud-input md:col-span-3" />
      <select value={priority} onChange={(e) => setPriority(e.target.value as any)} className="hud-input md:col-span-1">
        <option value="high">High</option>
        <option value="medium">Medium</option>
        <option value="low">Low</option>
      </select>
      <select value={category} onChange={(e) => setCategory(e.target.value)} className="hud-input md:col-span-1">
        <option value="project">Project</option>
        <option value="work">Work</option>
        <option value="study">Study</option>
        <option value="personal">Personal</option>
      </select>
      <input value={dueDate} onChange={(e) => setDueDate(e.target.value)} type="datetime-local" className="hud-input md:col-span-2" />
      <button disabled={loading || !title.trim()} className="rounded-2xl border border-cyan-300/20 bg-cyan-300/16 px-4 py-3 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-300/25 disabled:opacity-40 md:col-span-1">{loading ? '...' : '+'}</button>
    </form>
  );
}

function TaskOperations({ tasks, addTask, toggleTaskStatus, deleteTask, loading }: { tasks: Task[]; addTask: DashboardProps['addTask']; toggleTaskStatus: DashboardProps['toggleTaskStatus']; deleteTask: DashboardProps['deleteTask']; loading: boolean }) {
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const visible = tasks.filter((task) => filter === 'all' || task.status === filter);
  return (
    <Workspace title="Task Operations" subtitle="Full directive control with completion, priority and due dates.">
      <TaskForm onAdd={addTask} />
      <div className="mt-5 flex flex-wrap gap-2">
        {(['all', 'pending', 'completed'] as const).map((item) => <button key={item} onClick={() => setFilter(item)} className={cx('rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-[0.14em]', filter === item ? 'border-cyan-300/40 bg-cyan-300/14 text-cyan-100' : 'border-cyan-300/12 bg-cyan-300/[0.035] text-cyan-100/55')}>{item}</button>)}
      </div>
      {loading && <p className="mt-4 text-sm text-cyan-100/55">Synchronizing task matrix...</p>}
      <div className="mt-5 grid gap-3">
        {visible.map((task) => (
          <div key={task.id} className="rounded-3xl border border-cyan-300/12 bg-cyan-300/[0.035] p-4 transition hover:border-cyan-300/30">
            <div className="flex items-start gap-4">
              <button onClick={() => toggleTaskStatus(task.id, task.status)} className="mt-1 text-cyan-300/60 hover:text-cyan-100">{task.status === 'completed' ? <CheckCircle2 size={22} /> : <Circle size={22} />}</button>
              <div className="min-w-0 flex-1">
                <h3 className={cx('font-semibold', task.status === 'completed' ? 'text-cyan-100/35 line-through' : 'text-cyan-50')}>{task.title}</h3>
                {task.description && <p className="mt-1 text-sm text-cyan-100/55">{task.description}</p>}
                <div className="mt-3 flex flex-wrap gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-cyan-200/65"><span>{task.priority}</span><span>{task.category}</span><span>{compactDate(task.dueDate)}</span></div>
              </div>
              <button onClick={() => deleteTask(task.id)} className="hud-icon-button hover:border-rose-300/35 hover:text-rose-200"><Trash2 size={16} /></button>
            </div>
          </div>
        ))}
        {visible.length === 0 && <div className="rounded-3xl border border-dashed border-cyan-300/14 p-10 text-center text-sm text-cyan-100/50">No directives found.</div>}
      </div>
    </Workspace>
  );
}

function MemoryOperations({ memories, query, setQuery, addMemory, deleteMemory, fetchMemories, loading }: { memories: Memory[]; query: string; setQuery: (value: string) => void; addMemory: (content: string) => Promise<void>; deleteMemory: (id: number) => Promise<void>; fetchMemories: (query?: string) => Promise<void>; loading: boolean }) {
  const [content, setContent] = useState('');
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    await addMemory(content);
    setContent('');
  };
  return (
    <Workspace title="Memory Core" subtitle="Store stable preferences, project facts and reusable context.">
      <form onSubmit={submit} className="grid gap-3 md:grid-cols-[1fr_auto]">
        <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Save a memory, preference, or project fact..." className="hud-input min-h-[96px] resize-none" />
        <button className="rounded-2xl border border-cyan-300/20 bg-cyan-300/16 px-5 py-3 text-sm font-semibold text-cyan-50 hover:bg-cyan-300/25">Save Memory</button>
      </form>
      <div className="mt-5 flex gap-3">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search memory..." className="hud-input" />
        <button onClick={() => fetchMemories(query)} className="hud-icon-button h-12 w-12"><Search size={17} /></button>
      </div>
      {loading && <p className="mt-4 text-sm text-cyan-100/55">Querying memory core...</p>}
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {memories.map((memory) => (
          <div key={memory.id} className="rounded-3xl border border-cyan-300/12 bg-cyan-300/[0.035] p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm leading-relaxed text-cyan-50/75">{memory.content}</p>
              <button onClick={() => deleteMemory(memory.id)} className="text-cyan-300/45 hover:text-rose-200"><Trash2 size={15} /></button>
            </div>
            <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-cyan-300/45">{new Date(memory.createdAt).toLocaleString()}</p>
          </div>
        ))}
        {memories.length === 0 && <div className="rounded-3xl border border-dashed border-cyan-300/14 p-10 text-center text-sm text-cyan-100/50 md:col-span-2">No memories saved.</div>}
      </div>
    </Workspace>
  );
}

function FileOperations({ files, fetchFiles }: { files: UploadedFile[]; fetchFiles: () => Promise<void> }) {
  const [name, setName] = useState('notes.txt');
  const [content, setContent] = useState('');
  const [loadingId, setLoadingId] = useState<number | null>(null);

  const upload = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !content.trim()) return;
    await apiFetch('/api/upload', { method: 'POST', body: JSON.stringify({ name, content, mimeType: 'text/plain' }) });
    setContent('');
    await fetchFiles();
  };

  const summarize = async (id: number) => {
    setLoadingId(id);
    try {
      await apiFetch('/api/summarize-file', { method: 'POST', body: JSON.stringify({ id }) });
      await fetchFiles();
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <Workspace title="File Intelligence" subtitle="Upload text, summarize it and keep the results inside the local database.">
      <form onSubmit={upload} className="grid gap-3 rounded-3xl border border-cyan-300/12 bg-cyan-300/[0.035] p-4">
        <input value={name} onChange={(e) => setName(e.target.value)} className="hud-input" />
        <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Paste file text here..." className="hud-input min-h-[150px] resize-y" />
        <button className="inline-flex items-center justify-center gap-2 rounded-2xl border border-cyan-300/20 bg-cyan-300/16 px-5 py-3 text-sm font-semibold text-cyan-50 hover:bg-cyan-300/25"><UploadCloud size={16} /> Upload Text File</button>
      </form>
      <div className="mt-5 grid gap-3">
        {files.map((file) => (
          <div key={file.id} className="rounded-3xl border border-cyan-300/12 bg-cyan-300/[0.035] p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0"><p className="truncate font-semibold text-cyan-50">{file.name}</p><p className="font-mono text-[10px] uppercase tracking-[0.14em] text-cyan-300/45">{new Date(file.createdAt).toLocaleString()}</p></div>
              <button onClick={() => summarize(file.id)} disabled={loadingId === file.id} className="rounded-2xl border border-cyan-300/20 bg-cyan-300/12 px-4 py-2 text-sm text-cyan-100 hover:bg-cyan-300/20 disabled:opacity-50">{loadingId === file.id ? 'Summarizing...' : 'Summarize'}</button>
            </div>
            {file.summary && <p className="mt-4 whitespace-pre-wrap rounded-2xl border border-cyan-300/10 bg-slate-950/40 p-4 text-sm leading-relaxed text-cyan-50/70">{file.summary}</p>}
          </div>
        ))}
      </div>
    </Workspace>
  );
}

function ExtensionOperations() {
  return (
    <Workspace title="Extension Bridge" subtitle="Manifest V3 ready endpoints for browser context and commands.">
      <div className="grid gap-4 md:grid-cols-2">
        <HudPanel title="Context Endpoint"><p className="text-sm text-cyan-100/62">Collect page title, URL, selected text and page snippet.</p><pre className="mt-4 overflow-auto rounded-2xl bg-slate-950/60 p-4 text-xs text-cyan-100">POST /api/extension/context</pre></HudPanel>
        <HudPanel title="Command Endpoint"><p className="text-sm text-cyan-100/62">Ask IronCore questions about the active browser page.</p><pre className="mt-4 overflow-auto rounded-2xl bg-slate-950/60 p-4 text-xs text-cyan-100">POST /api/extension/command</pre></HudPanel>
      </div>
      <pre className="mt-5 overflow-auto rounded-3xl border border-cyan-300/12 bg-slate-950/55 p-5 text-xs leading-relaxed text-cyan-100/75">{`{
  "userCommand": "Summarize this page",
  "pageTitle": "Example Page",
  "pageUrl": "https://example.com",
  "selectedText": "optional selected text",
  "pageText": "visible page text snippet"
}`}</pre>
    </Workspace>
  );
}

function SettingsOperations({ health, refresh }: { health: Health | null; refresh: () => Promise<void> }) {
  return (
    <Workspace title="System Settings" subtitle="Safe local status, model configuration and integration checks." action={<button onClick={refresh} className="rounded-2xl border border-cyan-300/16 bg-cyan-300/[0.06] px-4 py-2 text-sm text-cyan-100"><RefreshCw size={15} className="mr-2 inline" />Refresh</button>}>
      <div className="grid gap-4 md:grid-cols-2">
        <HudPanel title="Gemini API"><p className={cx('text-2xl font-semibold', health?.hasGeminiKey ? 'text-emerald-300' : 'text-rose-300')}>{health?.hasGeminiKey ? 'Configured' : 'Missing API key'}</p><p className="mt-2 text-sm text-cyan-100/55">Model: {health?.model || 'unknown'}</p></HudPanel>
        <HudPanel title="Web Search"><p className={cx('text-2xl font-semibold', health?.hasBraveKey ? 'text-emerald-300' : 'text-amber-300')}>{health?.hasBraveKey ? 'Brave configured' : 'Optional key missing'}</p><p className="mt-2 text-sm text-cyan-100/55">Add BRAVE_SEARCH_API_KEY for live search.</p></HudPanel>
        <HudPanel title="Safety Model" className="md:col-span-2"><div className="grid gap-2 text-sm text-cyan-100/62 md:grid-cols-2"><p>• Email and calendar actions require confirmation</p><p>• API keys stay server-side</p><p>• Extension calls use backend /api only</p><p>• Local database can be reset safely in dev</p></div></HudPanel>
      </div>
    </Workspace>
  );
}

function ChatWorkspace({ messages, pendingActions, onSubmit, confirmAction, cancelAction, clearHistory, isLoading }: { messages: any[]; pendingActions: any[]; onSubmit: (text: string) => Promise<void>; confirmAction: (id: number) => Promise<void>; cancelAction: (id: number) => Promise<void>; clearHistory: () => Promise<void>; isLoading: boolean }) {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, pendingActions, isLoading]);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    const text = input.trim();
    setInput('');
    await onSubmit(text);
  };
  return (
    <Workspace title="Chat Console" subtitle="Full conversation stream, pending confirmations and command input." action={<button onClick={clearHistory} className="rounded-2xl border border-cyan-300/16 bg-cyan-300/[0.05] px-4 py-2 text-sm text-cyan-100/70">Clear</button>}>
      <div className="grid max-h-[58vh] gap-3 overflow-y-auto pr-1">
        {messages.map((message) => (
          <div key={message.id} className={cx('max-w-[86%] rounded-3xl border p-4 text-sm leading-relaxed', message.role === 'user' ? 'ml-auto border-cyan-300/22 bg-cyan-300/12 text-cyan-50' : 'border-cyan-300/12 bg-cyan-300/[0.035] text-cyan-50/75')}>
            <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-cyan-300/55">{message.role}</p>
            <p className="whitespace-pre-wrap">{message.content}</p>
          </div>
        ))}
        {isLoading && <div className="rounded-3xl border border-cyan-300/12 bg-cyan-300/[0.035] p-4 text-sm text-cyan-100/60">IronCore is processing...</div>}
        <div ref={bottomRef} />
      </div>
      {pendingActions.length > 0 && <div className="mt-4 grid gap-3">{pendingActions.map((action) => <div key={action.id} className="rounded-3xl border border-amber-300/20 bg-amber-300/10 p-4"><p className="text-sm text-amber-100">{action.text || action.type || 'Pending confirmation'}</p><div className="mt-3 flex gap-2"><button onClick={() => action.id && confirmAction(action.id)} className="rounded-xl bg-emerald-400 px-3 py-2 text-xs font-bold text-slate-950">Confirm</button><button onClick={() => action.id && cancelAction(action.id)} className="rounded-xl bg-rose-400 px-3 py-2 text-xs font-bold text-slate-950">Cancel</button></div></div>)}</div>}
      <form onSubmit={submit} className="mt-5 flex gap-2 rounded-3xl border border-cyan-300/14 bg-slate-950/45 p-2"><input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask IronCore..." className="min-w-0 flex-1 bg-transparent px-3 text-sm text-cyan-50 outline-none" /><button className="rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-bold text-slate-950">Send</button></form>
    </Workspace>
  );
}

function Workspace({ title, subtitle, children, action }: { title: string; subtitle: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="mx-auto max-w-6xl rounded-[2rem] border border-cyan-300/12 bg-[#061423]/78 p-5 shadow-[0_0_55px_rgba(34,211,238,.08),inset_0_1px_0_rgba(255,255,255,.05)] backdrop-blur-2xl md:p-6">
      <div className="mb-6 flex flex-col gap-3 border-b border-cyan-300/10 pb-5 md:flex-row md:items-center md:justify-between">
        <div><h2 className="font-mono text-2xl font-bold uppercase tracking-[0.12em] text-cyan-50">{title}</h2><p className="mt-2 text-sm text-cyan-100/55">{subtitle}</p></div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Dashboard(props: DashboardProps) {
  const [active, setActive] = useState<Tab>('dashboard');
  const [health, setHealth] = useState<Health | null>(null);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const { messages, pendingActions, sendMessage, confirmAction, cancelAction, clearHistory, isLoading } = useChat();

  const pendingTasks = props.tasks.filter((task) => task.status === 'pending').length;
  const completedTasks = props.tasks.filter((task) => task.status === 'completed').length;
  const latestAssistantText = useMemo(() => [...messages].reverse().find((message) => message.role === 'assistant')?.content || '', [messages]);

  const fetchHealth = async () => {
    const data = await apiFetch<Health>('/api/health');
    setHealth(data);
  };

  const fetchFiles = async () => {
    const data = await apiFetch<UploadedFile[]>('/api/files');
    setFiles(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    fetchHealth().catch(console.error);
    fetchFiles().catch(console.error);
  }, []);

  const sendCommand = async (text: string) => {
    await sendMessage(text);
    await Promise.all([props.refreshAll(), fetchFiles()]);
  };

  const cycleMode = () => {
    const ids = navItems.map((item) => item.id);
    const nextIndex = (ids.indexOf(active) + 1) % ids.length;
    setActive(ids[nextIndex]);
  };

  const toggleVoice = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognition.onresult = async (event: any) => {
      const transcript = event.results?.[0]?.[0]?.transcript;
      if (transcript) await sendCommand(transcript);
    };
    recognition.start();
  };

  const renderWorkspace = () => {
    if (active === 'chat') return <ChatWorkspace messages={messages} pendingActions={pendingActions} onSubmit={sendCommand} confirmAction={confirmAction} cancelAction={cancelAction} clearHistory={clearHistory} isLoading={isLoading} />;
    if (active === 'tasks') return <TaskOperations tasks={props.tasks} addTask={props.addTask} toggleTaskStatus={props.toggleTaskStatus} deleteTask={props.deleteTask} loading={props.taskLoading} />;
    if (active === 'memory') return <MemoryOperations memories={props.memories} query={props.memoryQuery} setQuery={props.setMemoryQuery} addMemory={props.addMemory} deleteMemory={props.deleteMemory} fetchMemories={props.fetchMemories} loading={props.memoryLoading} />;
    if (active === 'files') return <FileOperations files={files} fetchFiles={fetchFiles} />;
    if (active === 'extensions') return <ExtensionOperations />;
    if (active === 'settings') return <SettingsOperations health={health} refresh={fetchHealth} />;
    return null;
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#020812]">
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(circle_at_50%_15%,rgba(34,211,238,.13),transparent_30%),radial-gradient(circle_at_20%_25%,rgba(14,165,233,.12),transparent_26%),radial-gradient(circle_at_85%_85%,rgba(8,145,178,.12),transparent_28%)]" />
      <div className="pointer-events-none fixed inset-0 z-0 opacity-[0.18] [background-image:linear-gradient(rgba(125,249,255,.12)_1px,transparent_1px),linear-gradient(90deg,rgba(125,249,255,.12)_1px,transparent_1px)] [background-size:44px_44px]" />
      <div className="scanline-overlay pointer-events-none fixed inset-0 z-0" />

      <div className="relative z-10 flex min-h-screen">
        <Sidebar active={active} setActive={setActive} health={health} pendingTasks={pendingTasks} />
        <main className="min-w-0 flex-1">
          <TopBar health={health} refreshAll={props.refreshAll} />
          <div className="px-4 pb-8 lg:px-6">
            <div className="mb-4 flex gap-2 overflow-x-auto pb-2 lg:hidden">
              {navItems.map((item) => {
                const Icon = item.icon;
                return <button key={item.id} onClick={() => setActive(item.id)} className={cx('flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-xs', active === item.id ? 'border-cyan-300/45 bg-cyan-300/15 text-cyan-50' : 'border-cyan-300/12 bg-cyan-300/[0.04] text-cyan-100/60')}><Icon size={14} />{item.label}</button>;
              })}
            </div>

            {active === 'dashboard' ? (
              <div className="mx-auto grid max-w-[1560px] gap-4 xl:grid-cols-[minmax(250px,300px)_minmax(420px,1fr)_minmax(330px,390px)]">
                <div className="grid content-start gap-4">
                  <ActiveTasksPanel tasks={props.tasks} onNewTask={() => setActive('tasks')} toggleTaskStatus={props.toggleTaskStatus} />
                  <ReminderPanel tasks={props.tasks} />
                  <MemorySnapshots memories={props.memories} />
                </div>

                <div className="grid gap-4">
                  <CoreOrb active={active} pendingTasks={pendingTasks} memoryCount={props.memories.length} fileCount={files.length} onClick={cycleMode} />
                  <FilesBrowserContext files={files} />
                </div>

                <div className="grid content-start gap-4">
                  <SystemStatusPanel health={health} />
                  <RecentActivity messages={messages} tasks={props.tasks} files={files} />
                  <QuickActions onPrompt={sendCommand} />
                  <VoiceAssistantCard isListening={isListening} startVoice={toggleVoice} />
                  <HudPanel title="Mission Metrics">
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div><p className="text-2xl font-bold text-cyan-50">{pendingTasks}</p><p className="font-mono text-[9px] uppercase tracking-widest text-cyan-300/55">Pending</p></div>
                      <div><p className="text-2xl font-bold text-cyan-50">{completedTasks}</p><p className="font-mono text-[9px] uppercase tracking-widest text-cyan-300/55">Complete</p></div>
                      <div><p className="text-2xl font-bold text-cyan-50">{props.memories.length}</p><p className="font-mono text-[9px] uppercase tracking-widest text-cyan-300/55">Memory</p></div>
                    </div>
                  </HudPanel>
                </div>
              </div>
            ) : renderWorkspace()}

            {pendingActions.length > 0 && active === 'dashboard' && (
              <div className="mx-auto mt-4 grid max-w-5xl gap-3">
                {pendingActions.map((action) => (
                  <div key={action.id} className="flex flex-col gap-3 rounded-3xl border border-amber-300/25 bg-amber-300/10 p-4 text-amber-50 md:flex-row md:items-center md:justify-between">
                    <p className="text-sm">{action.text || action.type || 'Sensitive action requires confirmation.'}</p>
                    <div className="flex gap-2">
                      <button onClick={() => action.id && confirmAction(action.id)} className="rounded-xl bg-emerald-400 px-3 py-2 text-xs font-bold text-slate-950">Confirm</button>
                      <button onClick={() => action.id && cancelAction(action.id)} className="rounded-xl bg-rose-400 px-3 py-2 text-xs font-bold text-slate-950">Cancel</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <ChatDock onSubmit={sendCommand} isLoading={isLoading} onVoice={toggleVoice} isListening={isListening} onSpeak={() => latestAssistantText && speak(latestAssistantText)} />
          </div>
        </main>
      </div>
    </div>
  );
}
