import { useState, useCallback, useEffect } from 'react';
import { apiFetch } from '../lib/api';

export type Message = {
  id: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
};

export type PendingAction = {
  id?: number;
  actionType?: string;
  type?: string;
  payload?: any;
  text?: string;
};

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchHistory = useCallback(async () => {
    try {
      const data = await apiFetch<Message[]>('/api/chat-history');
      setMessages(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Failed to load chat history:', err.message);
    }
  }, []);

  const fetchPendingActions = useCallback(async () => {
    try {
      const data = await apiFetch<PendingAction[]>('/api/actions');
      setPendingActions(Array.isArray(data) ? data.filter((item: any) => item.status === 'pending') : []);
    } catch (err: any) {
      console.error('Failed to load pending actions:', err.message);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
    fetchPendingActions();
  }, [fetchHistory, fetchPendingActions]);

  const sendMessage = useCallback(async (text: string) => {
    setIsLoading(true);
    const tempId = Date.now();
    setMessages((prev) => [...prev, { id: tempId, role: 'user', content: text, createdAt: new Date().toISOString() }]);

    try {
      const data = await apiFetch<any>('/api/chat', {
        method: 'POST',
        body: JSON.stringify({ message: text }),
      });
      setMessages((prev) => [...prev, { id: Date.now() + 1, role: 'assistant', content: data.text || 'No reply.', createdAt: new Date().toISOString() }]);
      if (data.pendingActions?.length) await fetchPendingActions();
      return data;
    } catch (e: any) {
      setMessages((prev) => [...prev, { id: Date.now() + 1, role: 'assistant', content: `SYSTEM ERROR: ${e.message}`, createdAt: new Date().toISOString() }]);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [fetchPendingActions]);

  const clearHistory = useCallback(async () => {
    await apiFetch('/api/chat-history/clear', { method: 'DELETE' });
    setMessages([]);
  }, []);

  const confirmAction = useCallback(async (id: number) => {
    const result = await apiFetch<any>(`/api/actions/${id}/confirm`, { method: 'POST' });
    await fetchPendingActions();
    setMessages((prev) => [...prev, { id: Date.now(), role: 'assistant', content: result.message || 'Action confirmed.', createdAt: new Date().toISOString() }]);
  }, [fetchPendingActions]);

  const cancelAction = useCallback(async (id: number) => {
    await apiFetch(`/api/actions/${id}/cancel`, { method: 'POST' });
    await fetchPendingActions();
  }, [fetchPendingActions]);

  return { messages, pendingActions, sendMessage, clearHistory, confirmAction, cancelAction, fetchHistory, fetchPendingActions, isLoading };
}
