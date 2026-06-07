import { Dashboard } from './client/components/Dashboard';
import { useMemories } from './client/hooks/useMemories';
import { useTasks } from './client/hooks/useTasks';

export default function App() {
  const taskApi = useTasks();
  const memoryApi = useMemories();

  const refreshAll = async () => {
    await Promise.all([taskApi.fetchTasks(), memoryApi.fetchMemories()]);
  };

  return (
    <div className="min-h-screen w-full bg-[#020812] text-cyan-50 selection:bg-cyan-400/25 selection:text-cyan-50">
      <Dashboard
        tasks={taskApi.tasks}
        memories={memoryApi.memories}
        taskLoading={taskApi.isLoading}
        memoryLoading={memoryApi.isLoading}
        memoryQuery={memoryApi.query}
        setMemoryQuery={memoryApi.setQuery}
        addTask={taskApi.addTask}
        updateTask={taskApi.updateTask}
        deleteTask={taskApi.deleteTask}
        toggleTaskStatus={taskApi.toggleTaskStatus}
        addMemory={memoryApi.addMemory}
        deleteMemory={memoryApi.deleteMemory}
        fetchMemories={memoryApi.fetchMemories}
        refreshAll={refreshAll}
      />
    </div>
  );
}
