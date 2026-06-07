import { useState, useCallback, useEffect } from 'react';
import { apiFetch } from '../lib/api';

export type Task = {
  id: number;
  title: string;
  description: string | null;
  status: 'pending' | 'completed';
  priority: 'high' | 'medium' | 'low';
  category: string;
  dueDate: string | null;
  createdAt: string;
};

export type TaskInput = {
  title: string;
  description?: string;
  priority?: 'high' | 'medium' | 'low';
  category?: string;
  dueDate?: string;
};

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiFetch<Task[]>('/api/tasks');
      setTasks(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const addTask = useCallback(async (task: TaskInput) => {
    await apiFetch('/api/tasks', { method: 'POST', body: JSON.stringify(task) });
    await fetchTasks();
  }, [fetchTasks]);

  const updateTask = useCallback(async (id: number, patch: Partial<TaskInput> & { status?: 'pending' | 'completed' }) => {
    await apiFetch(`/api/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
    await fetchTasks();
  }, [fetchTasks]);

  const toggleTaskStatus = useCallback(async (id: number, currentStatus: 'pending' | 'completed') => {
    await updateTask(id, { status: currentStatus === 'pending' ? 'completed' : 'pending' });
  }, [updateTask]);

  const deleteTask = useCallback(async (id: number) => {
    await apiFetch(`/api/tasks/${id}`, { method: 'DELETE' });
    await fetchTasks();
  }, [fetchTasks]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  return { tasks, fetchTasks, addTask, updateTask, toggleTaskStatus, deleteTask, isLoading, error };
}
