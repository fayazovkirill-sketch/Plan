import React, { useEffect, useState } from 'react';
import { SectionId, Task, SyncPayload } from './types';
import { SECTIONS, TRADING_TAGS, WEEK_MS } from './constants';
import { Section } from './components/Section';
import { TradingChecklist } from './components/TradingChecklist';
import { TaskItem } from './components/TaskItem';
import { saveTasks, loadTasks } from './services/db';
import { saveRemoteState, fetchRemoteState } from './services/sync';
import { triggerHaptic } from './services/haptics';
import { Lock, Cloud, Download, Upload, X, Loader2, CheckCircle } from 'lucide-react';
import { 
    DndContext, 
    DragEndEvent, 
    DragStartEvent, 
    DragOverlay, 
    useSensor, 
    useSensors, 
    TouchSensor, 
    MouseSensor 
} from '@dnd-kit/core';
import confetti from 'canvas-confetti';

interface AppSettings {
    title: string;
}

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [tradingTaskToComplete, setTradingTaskToComplete] = useState<Task | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [remainingHours, setRemainingHours] = useState<number | null>(null);
  
  // Sync State
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const [appSettings, setAppSettings] = useState<AppSettings>({
      title: "Дисциплина."
  });

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  );

  const getTimeRemaining = () => {
      const startStr = localStorage.getItem('focusStartTime');
      if (!startStr) return null;
      const start = parseInt(startStr, 10);
      const now = Date.now();
      const end = start + WEEK_MS;
      const diff = end - now;
      return { diff, start };
  };

  // 1. Initial Load
  useEffect(() => {
    const initApp = async () => {
      try {
        const stored = await loadTasks();
        const migrated = stored.map(t => ({
            ...t,
            lastTitleEditAt: (t.isFocus || t.lastTitleEditAt === undefined || t.lastTitleEditAt === t.createdAt) ? 0 : t.lastTitleEditAt
        }));
        
        const savedTitle = localStorage.getItem('app_title');
        if (savedTitle) setAppSettings(prev => ({ ...prev, title: savedTitle }));
        
        setTasks(migrated);
      } catch (err) {
        console.error("DB Load failed", err);
      } finally {
        setLoading(false);
      }
    };
    
    initApp();
  }, []);

  // 2. Timer Check
  useEffect(() => {
    const checkTimer = () => {
        const timeData = getTimeRemaining();
        if (timeData) {
            if (timeData.diff <= 0) {
                localStorage.removeItem('focusStartTime');
                localStorage.removeItem('app_title');
                setAppSettings(prev => ({ ...prev, title: '' }));
                setRemainingHours(null);
                triggerHaptic('success'); 
            } else {
                setRemainingHours(Math.ceil(timeData.diff / (1000 * 60 * 60)));
            }
        } else {
            setRemainingHours(null);
        }
    };
    checkTimer();
    const interval = setInterval(checkTimer, 60000);
    return () => clearInterval(interval);
  }, []);

  // 3. Save Local DB
  useEffect(() => {
    if (!loading) saveTasks(tasks);
  }, [tasks, loading]);

  // --- UI HANDLERS ---

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setAppSettings(prev => ({ ...prev, title: newValue }));
      localStorage.setItem('app_title', newValue);
  };

  const commitFocus = () => {
      const currentTitle = appSettings.title.trim();
      if (currentTitle.length > 0 && !localStorage.getItem('focusStartTime')) {
          localStorage.setItem('focusStartTime', Date.now().toString());
          setRemainingHours(168); 
          triggerHaptic('heavy');
      }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
  };

  const handleAddTask = (sectionId: SectionId, title: string) => {
    const sectionConfig = SECTIONS.find(s => s.id === sectionId);
    const count = tasks.filter(t => t.section === sectionId).length;
    if (sectionConfig && sectionConfig.limit !== Infinity && count >= sectionConfig.limit) return; 

    const tags = title.match(/#[a-zA-Zа-яА-Я0-9_]+/g) || [];
    const newTask: Task = {
      id: crypto.randomUUID(),
      title,
      section: sectionId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastTitleEditAt: 0, 
      isFocus: false,
      tags: tags,
      subtasks: [],
      dateAddedToToday: sectionId === SectionId.TODAY ? Date.now() : undefined
    };
    setTasks(prev => [...prev, newTask]);
  };

  const handleUpdateTask = (updatedTask: Task) => {
    setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
  };

  const handleDeleteTask = (taskId: string) => {
    triggerHaptic('medium');
    setTasks(prev => prev.filter(t => t.id !== taskId));
  };

  const handleMoveTask = (taskId: string, targetSection: SectionId) => {
     const sectionConfig = SECTIONS.find(s => s.id === targetSection);
     const count = tasks.filter(t => t.section === targetSection).length;
     if (sectionConfig && sectionConfig.limit !== Infinity && count >= sectionConfig.limit) {
         const currentTask = tasks.find(t => t.id === taskId);
         if (currentTask && currentTask.section !== targetSection) {
             alert(`Нельзя перенести. "${sectionConfig.title}" переполнен.`);
             triggerHaptic('error');
             return;
         }
     }
     if (targetSection === SectionId.DONE) {
         const task = tasks.find(t => t.id === taskId);
         if (task && task.section !== SectionId.DONE) triggerFireworks();
     }
     setTasks(prev => prev.map(t => {
         if (t.id !== taskId) return t;
         const isMovingToToday = targetSection === SectionId.TODAY;
         return {
             ...t,
             section: targetSection,
             updatedAt: Date.now(),
             dateAddedToToday: isMovingToToday ? Date.now() : t.dateAddedToToday,
             isFocus: !isMovingToToday ? false : t.isFocus
         };
     }));
     triggerHaptic('medium');
  };

  const attemptCompleteTask = (task: Task) => {
     if (task.section === SectionId.DONE) {
         handleMoveTask(task.id, SectionId.TODAY);
         return;
     }
     const isTrading = task.tags.some(t => TRADING_TAGS.includes(t.toLowerCase()));
     if (isTrading) setTradingTaskToComplete(task);
     else {
         handleMoveTask(task.id, SectionId.DONE);
         triggerHaptic('success');
     }
  };

  const confirmTradingCompletion = () => {
     if (tradingTaskToComplete) {
         handleMoveTask(tradingTaskToComplete.id, SectionId.DONE);
         setTradingTaskToComplete(null);
     }
  };

  const triggerFireworks = () => {
    const duration = 1500;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 100 };
    const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

    const interval: any = setInterval(function() {
      const timeLeft = animationEnd - Date.now();
      if (timeLeft <= 0) return clearInterval(interval);
      const particleCount = 50 * (timeLeft / duration);
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
    }, 250);
  };

  const handleDragStart = (event: DragStartEvent) => {
      setActiveId(event.active.id as string);
      triggerHaptic('heavy');
  };

  const handleDragEnd = (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);
      if (over && active.id !== over.id) {
          const targetSectionId = over.id as SectionId;
          if (Object.values(SectionId).includes(targetSectionId)) {
              handleMoveTask(active.id as string, targetSectionId);
          }
      }
  };

  // --- SYNC HANDLERS ---
  const handleOpenSync = () => {
      setIsSyncModalOpen(true);
      setSyncStatus('idle');
  };

  const handleUpload = async () => {
      setSyncLoading(true);
      setSyncStatus('idle');
      try {
          const payload: SyncPayload = {
              tasks,
              appTitle: appSettings.title,
              focusStartTime: localStorage.getItem('focusStartTime'),
              updatedAt: Date.now()
          };
          
          await saveRemoteState(payload);
          
          setSyncStatus('success');
          triggerHaptic('success');
          setTimeout(() => setIsSyncModalOpen(false), 1000);
      } catch (e: any) {
          alert(`Ошибка выгрузки: ${e.message}`);
          setSyncStatus('error');
          triggerHaptic('error');
      } finally {
          setSyncLoading(false);
      }
  };

  const handleDownload = async () => {
      setSyncLoading(true);
      setSyncStatus('idle');
      try {
          const data = await fetchRemoteState();
          
          setTasks(data.tasks);
          setAppSettings({ title: data.appTitle || "" });
          if (data.appTitle) localStorage.setItem('app_title', data.appTitle);
          
          if (data.focusStartTime) {
              localStorage.setItem('focusStartTime', data.focusStartTime);
          } else {
              localStorage.removeItem('focusStartTime');
          }
          
          // Recalculate timer immediately
          const startStr = data.focusStartTime;
          if (startStr) {
            const start = parseInt(startStr, 10);
            const end = start + WEEK_MS;
            const diff = end - Date.now();
            setRemainingHours(diff > 0 ? Math.ceil(diff / (1000 * 60 * 60)) : null);
          } else {
            setRemainingHours(null);
          }

          setSyncStatus('success');
          triggerHaptic('success');
          triggerFireworks(); 
          setTimeout(() => setIsSyncModalOpen(false), 1000);
      } catch (e: any) {
          alert(`Ошибка загрузки: ${e.message}`);
          setSyncStatus('error');
          triggerHaptic('error');
      } finally {
          setSyncLoading(false);
      }
  };

  const activeTask = activeId ? tasks.find(t => t.id === activeId) : null;
  const isLocked = remainingHours !== null;

  if (loading) return <div className="flex h-screen items-center justify-center text-gray-400">Загрузка...</div>;

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="min-h-screen pb-20 max-w-lg mx-auto bg-[#f5f5f7]">
        <header className="pt-12 pb-6 px-6 relative">
            {/* Sync Button */}
            <button 
                onClick={handleOpenSync}
                className="absolute top-6 right-6 p-2 rounded-full bg-white/50 hover:bg-white text-gray-400 hover:text-gray-900 transition-all shadow-sm border border-transparent hover:border-gray-200"
            >
                <Cloud size={20} />
            </button>

            <div className="relative pr-12">
                <input 
                    type="text"
                    value={appSettings.title}
                    onChange={handleTitleChange}
                    onBlur={commitFocus}
                    onKeyDown={handleKeyDown}
                    disabled={isLocked}
                    className={`w-full bg-transparent border-none p-0 text-3xl font-extrabold text-gray-900 tracking-tight focus:outline-none placeholder:text-gray-300 transition-all ${isLocked ? 'opacity-60 cursor-not-allowed text-gray-500' : ''}`}
                    placeholder="Слово недели..."
                />
                {isLocked && (
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 text-gray-400 animate-[fadeIn_0.3s_ease-out]"><Lock size={20} /></div>
                )}
            </div>
            
            <div className="flex items-center justify-between mt-1">
                <p className="text-gray-400 text-sm font-medium">Фокус на результате.</p>
                {remainingHours !== null && (
                    <p className="text-[11px] font-mono font-medium text-gray-400 bg-gray-100/50 px-2 py-0.5 rounded-md">До смены фокуса: {remainingHours} ч.</p>
                )}
            </div>
        </header>

        <main className="px-4">
            {SECTIONS.map(sectionConfig => (
                <Section 
                key={sectionConfig.id}
                config={sectionConfig}
                tasks={tasks.filter(t => t.section === sectionConfig.id)}
                onAddTask={handleAddTask}
                onUpdateTask={handleUpdateTask}
                onCompleteTask={attemptCompleteTask}
                onDeleteTask={handleDeleteTask}
                />
            ))}
        </main>

        <DragOverlay>
            {activeTask ? (
                <div style={{ opacity: 0.9 }}>
                    <TaskItem 
                        task={activeTask}
                        onComplete={() => {}}
                        onUpdate={() => {}}
                        onDelete={() => {}}
                        isToday={activeTask.section === SectionId.TODAY}
                        isOverlay={true}
                    />
                </div>
            ) : null}
        </DragOverlay>

        <TradingChecklist 
            isOpen={!!tradingTaskToComplete}
            onConfirm={confirmTradingCompletion}
            onCancel={() => setTradingTaskToComplete(null)}
        />
        
        {/* SYNC MODAL */}
        {isSyncModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-[fadeIn_0.2s_ease-out] relative">
                    <button 
                        onClick={() => setIsSyncModalOpen(false)} 
                        className="absolute top-4 right-4 text-gray-300 hover:text-gray-600"
                    >
                        <X size={20} />
                    </button>
                    
                    <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                        <Cloud size={24} className="text-gray-400" />
                        Синхронизация
                    </h3>

                    {syncLoading ? (
                        <div className="py-12 flex flex-col items-center justify-center text-gray-400">
                            <Loader2 size={32} className="animate-spin mb-2" />
                            <span className="text-sm">Обработка...</span>
                        </div>
                    ) : syncStatus === 'success' ? (
                        <div className="py-8 flex flex-col items-center justify-center text-green-600 animate-[fadeIn_0.2s_ease-out]">
                            <CheckCircle size={48} className="mb-3" />
                            <span className="font-semibold">Успешно!</span>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="p-3 bg-gray-50 text-gray-500 text-xs rounded-lg mb-4">
                                Данные сохраняются в ваше личное облачное хранилище (JSONBin).
                            </div>

                            <button 
                                onClick={handleUpload}
                                className="w-full flex items-center justify-center gap-3 p-4 bg-gray-100 hover:bg-gray-200 text-gray-900 rounded-xl transition-all active:scale-[0.98]"
                            >
                                <Upload size={20} />
                                <div className="text-left">
                                    <div className="font-semibold text-sm">Выгрузить в облако</div>
                                    <div className="text-[10px] text-gray-500">Сохранить текущие задачи туда</div>
                                </div>
                            </button>

                            <button 
                                onClick={handleDownload}
                                className="w-full flex items-center justify-center gap-3 p-4 bg-black text-white hover:bg-gray-800 rounded-xl transition-all active:scale-[0.98] shadow-lg"
                            >
                                <Download size={20} />
                                <div className="text-left">
                                    <div className="font-semibold text-sm">Загрузить из облака</div>
                                    <div className="text-[10px] text-gray-400">Заменить текущее на облачное</div>
                                </div>
                            </button>
                        </div>
                    )}
                </div>
            </div>
        )}

        <style>{`
            @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
            @keyframes slideDown { from { opacity: 0; height: 0; } to { opacity: 1; height: auto; } }
        `}</style>
        </div>
    </DndContext>
  );
}