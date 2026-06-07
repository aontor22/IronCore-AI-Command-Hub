import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Bot, Check, Copy, Mic, MicOff, Send, Sparkles, Trash2, Volume2, X } from 'lucide-react';
import { useChat } from '../hooks/useChat';

type ChatPanelProps = {
  refreshAll: () => void;
};

const quickPrompts = [
  'Create a high priority task to test the assistant tomorrow',
  'Save memory that I prefer concise technical answers',
  'Show my latest memories',
  'Draft an email to a client with a short project update',
];

function speak(text: string) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text.replace(/[*_`>#]/g, '').slice(0, 900));
  utterance.rate = 0.95;
  utterance.pitch = 0.95;
  window.speechSynthesis.speak(utterance);
}

function renderMessage(text: string) {
  return text.split('\n').filter(Boolean).map((line, idx) => {
    const isNotice = line.startsWith('▸') || line.toLowerCase().includes('task created') || line.toLowerCase().includes('memory saved');
    const isError = line.toLowerCase().includes('error') || line.toLowerCase().includes('missing');
    return (
      <p
        key={`${line}-${idx}`}
        className={`mb-1.5 whitespace-pre-wrap text-sm leading-relaxed ${
          isNotice ? 'rounded border-l-2 border-blue-400/70 bg-blue-500/10 px-2 py-1 font-mono text-[12px] text-blue-200' : ''
        } ${isError ? 'text-rose-300' : ''}`}
      >
        {line.replace(/^▸\s?/, '')}
      </p>
    );
  });
}

export function ChatPanel({ refreshAll }: ChatPanelProps) {
  const { messages, pendingActions, sendMessage, clearHistory, confirmAction, cancelAction, isLoading } = useChat();
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [clearConfirm, setClearConfirm] = useState(false);
  const recognitionRef = useRef<any>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const latestAssistantText = useMemo(() => [...messages].reverse().find((m) => m.role === 'assistant')?.content || '', [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, pendingActions]);

  const handleSubmit = async (e?: FormEvent, override?: string) => {
    e?.preventDefault();
    const text = (override ?? input).trim();
    if (!text || isLoading) return;
    setInput('');
    await sendMessage(text);
    await refreshAll();
  };

  const toggleVoice = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setInput((prev) => prev || 'Voice recognition is not supported in this browser.');
      return;
    }

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = 'en-US';
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((result: any) => result[0]?.transcript || '')
        .join('');
      setInput(transcript);
    };
    recognition.start();
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#070a10]/95">
      <header className="border-b border-white/10 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-400/30 bg-blue-500/10 shadow-[0_0_25px_rgba(59,130,246,0.18)]">
              <Bot size={18} className="text-blue-300" />
            </div>
            <div>
              <h2 className="font-mono text-xs font-bold uppercase tracking-[0.22em] text-zinc-200">IronCore Link</h2>
              <p className="mt-1 text-[11px] text-zinc-500">AI command channel</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => speak(latestAssistantText)} className="rounded-lg border border-white/10 bg-white/5 p-2 text-zinc-400 transition hover:text-blue-200" title="Read latest reply aloud">
              <Volume2 size={16} />
            </button>
            <button onClick={() => setClearConfirm(true)} className="rounded-lg border border-white/10 bg-white/5 p-2 text-zinc-400 transition hover:border-rose-400/40 hover:text-rose-300" title="Clear chat history">
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        {clearConfirm && (
          <div className="mt-4 rounded-xl border border-rose-400/20 bg-rose-500/10 p-3">
            <div className="flex items-start gap-2 text-rose-200">
              <AlertTriangle size={16} className="mt-0.5" />
              <div className="text-sm">Clear all local chat history?</div>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button onClick={() => setClearConfirm(false)} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-300">Cancel</button>
              <button onClick={async () => { await clearHistory(); setClearConfirm(false); }} className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white">Clear</button>
            </div>
          </div>
        )}
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-blue-400/20 bg-blue-500/10">
              <Sparkles className="text-blue-300" size={22} />
            </div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-300">Awaiting command</p>
            <p className="mt-2 max-w-xs text-sm text-zinc-500">Type, use voice, create tasks, save memory, draft emails, or summarize uploaded files.</p>
            <div className="mt-5 grid w-full gap-2">
              {quickPrompts.map((prompt) => (
                <button key={prompt} onClick={() => handleSubmit(undefined, prompt)} className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-left text-xs text-zinc-400 transition hover:border-blue-400/30 hover:text-blue-200">
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-5">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[92%] rounded-2xl px-4 py-3 shadow-lg ${
                msg.role === 'user'
                  ? 'rounded-tr-sm bg-blue-600 text-white'
                  : msg.content.includes('SYSTEM ERROR')
                    ? 'rounded-tl-sm border border-rose-400/20 bg-rose-500/10 text-rose-100'
                    : 'rounded-tl-sm border border-white/10 bg-white/[0.04] text-zinc-200'
              }`}>
                <div className="mb-2 flex items-center justify-between gap-4">
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/45">{msg.role === 'user' ? 'Operator' : 'Assistant'}</span>
                  <button onClick={() => navigator.clipboard?.writeText(msg.content)} className="opacity-0 transition group-hover:opacity-100 text-zinc-500 hover:text-white">
                    <Copy size={13} />
                  </button>
                </div>
                <div className="group">{renderMessage(msg.content)}</div>
              </div>
            </div>
          ))}

          {pendingActions.map((action) => (
            <div key={action.id} className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-100">
              <div className="flex items-start gap-3">
                <AlertTriangle size={17} className="mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">Confirmation required</p>
                  <p className="mt-1 text-xs text-amber-100/70">{action.actionType || action.type}</p>
                  <pre className="mt-2 max-h-28 overflow-auto rounded-lg bg-black/30 p-2 text-[11px] text-zinc-300">{JSON.stringify(action.payload, null, 2)}</pre>
                  <div className="mt-3 flex gap-2">
                    <button onClick={async () => { if (action.id) { await confirmAction(action.id); await refreshAll(); } }} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white">
                      <Check size={13} /> Confirm
                    </button>
                    <button onClick={async () => { if (action.id) await cancelAction(action.id); }} className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-3 py-1.5 text-xs text-zinc-200">
                      <X size={13} /> Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-tl-sm border border-white/10 bg-white/[0.04] px-4 py-3">
                <div className="flex items-center gap-2 text-xs text-blue-200">
                  <span className="h-2 w-2 animate-ping rounded-full bg-blue-400" /> Processing command
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      <footer className="border-t border-white/10 p-4">
        {isListening && (
          <div className="mb-3 flex items-center justify-between rounded-xl border border-blue-400/30 bg-blue-500/10 px-3 py-2 text-xs text-blue-200">
            <span>Listening through browser speech recognition</span>
            <div className="flex gap-0.5">
              {[3, 5, 2, 4, 3].map((h, i) => <span key={i} style={{ height: `${h * 4}px` }} className="w-1 animate-pulse rounded-full bg-blue-300" />)}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading}
            rows={2}
            placeholder="Type a command..."
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            className="min-h-[48px] flex-1 resize-none rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-blue-400/50"
          />
          <button type="button" onClick={toggleVoice} className={`rounded-2xl border p-3 transition ${isListening ? 'border-rose-400/40 bg-rose-500/10 text-rose-200' : 'border-white/10 bg-white/[0.04] text-zinc-300 hover:text-blue-200'}`}>
            {isListening ? <MicOff size={18} /> : <Mic size={18} />}
          </button>
          <button type="submit" disabled={!input.trim() || isLoading} className="rounded-2xl bg-blue-600 p-3 text-white shadow-[0_0_20px_rgba(37,99,235,0.35)] transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40">
            <Send size={18} />
          </button>
        </form>
      </footer>
    </div>
  );
}
