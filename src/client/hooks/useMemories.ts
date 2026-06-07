import { useState, useCallback, useEffect } from 'react';
import { apiFetch } from '../lib/api';

export type Memory = {
  id: number;
  content: string;
  source: string;
  createdAt: string;
};

export function useMemories() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [query, setQuery] = useState('');

  const fetchMemories = useCallback(async (q = query) => {
    setIsLoading(true);
    try {
      const data = await apiFetch<Memory[]>(q ? `/api/memories?q=${encodeURIComponent(q)}` : '/api/memories');
      setMemories(Array.isArray(data) ? data : []);
    } finally {
      setIsLoading(false);
    }
  }, [query]);

  const addMemory = useCallback(async (content: string) => {
    await apiFetch('/api/memories', { method: 'POST', body: JSON.stringify({ content }) });
    await fetchMemories();
  }, [fetchMemories]);

  const deleteMemory = useCallback(async (id: number) => {
    await apiFetch(`/api/memories/${id}`, { method: 'DELETE' });
    await fetchMemories();
  }, [fetchMemories]);

  useEffect(() => {
    fetchMemories('');
  }, []);

  return { memories, query, setQuery, fetchMemories, addMemory, deleteMemory, isLoading };
}
