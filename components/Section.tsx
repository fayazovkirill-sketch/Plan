import React, { useState } from 'react';
import { SectionConfig, Task, SectionId } from '../types';
import { TaskItem } from './TaskItem';
import { ChevronDown, Plus } from 'lucide-react';
import { triggerHaptic } from '../services/haptics';
import { useDroppable } from '@dnd-kit/core';

interface Props {
  config: SectionConfig;
  tasks: Task[];
  onAddTask: (sectionId: SectionId, title: string) => void;
  onUpdateTask: (task: Task) => void;
  onCompleteTask: (task: Task) => void;
  onDeleteTask: (taskId: string) => void;
}

export const Section: React.FC<Props> = ({ 
  config, 
  tasks, 
  onAddTask, 
  onUpdateTask, 
  onCompleteTask, 
  onDeleteTask, 
}) => {
  const [isOpen, setIsOpen] = useState(config.id === SectionId.TODAY); // Default open Today
  const [newTaskTitle, setNewTaskTitle] = useState('');

  const { setNodeRef, isOver } = useDroppable({
    id: config.id,
  });

  const count = tasks.length;
  const isFull = config.limit !== Infinity && count >= config.limit;

  const handleToggle = () => {
    setIsOpen(!isOpen);
    triggerHaptic('light');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    
    if (isFull) {
        triggerHaptic('error');
        alert(`Лимит для "${config.title}" исчерпан. Завершите что-то.`);
        return;
    }

    onAddTask(config.id, newTaskTitle);
    setNewTaskTitle('');
    triggerHaptic('success');
  };

  // Rule "0": No leading zeros.
  const limitDisplay = config.limit === Infinity ? '∞' : config.limit;

  // Aesthetic Logic
  const isToday = config.id === SectionId.TODAY;
  
  let containerClasses = "mb-6 rounded-2xl transition-all duration-300 bg-white overflow-hidden ";
  
  if (isOver) {
      // Drag over state: Accent color border
      containerClasses += "border-2 border-indigo-400 bg-indigo-50/30 shadow-lg scale-[1.01]";
  } else if (isToday) {
      // Today state: Highlighted border/shadow
      containerClasses += "border border-gray-300 shadow-apple ring-1 ring-black/5";
  } else {
      // Standard state: Subtle border
      containerClasses += "border border-gray-200 shadow-sm hover:shadow-md";
  }

  return (
    <div 
        ref={setNodeRef} 
        className={containerClasses}
    >
      {/* Header */}
      <div 
        onClick={handleToggle}
        className={`flex items-center justify-between py-4 px-5 cursor-pointer select-none group transition-colors ${isToday ? 'bg-gray-50/50' : ''}`}
      >
        <div className="flex items-center gap-3">
            <h2 className={`text-lg font-bold tracking-tight ${isOver ? 'text-indigo-700' : 'text-gray-900'}`}>
                {config.title}
            </h2>
            <ChevronDown 
                size={18} 
                className={`text-gray-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
            />
        </div>
        <div className={`text-sm font-semibold px-3 py-1 rounded-full transition-colors ${isFull ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-gray-100 text-gray-500'}`}>
            {count}<span className="text-gray-300 text-xs mx-0.5">/</span>{limitDisplay}
        </div>
      </div>

      {/* Body */}
      {isOpen && (
        <div className="animate-[slideDown_0.2s_ease-out]">
            <div className="space-y-3 px-5 pb-5 pt-1">
                {tasks.map(task => (
                    <TaskItem 
                        key={task.id} 
                        task={task} 
                        onUpdate={onUpdateTask}
                        onComplete={onCompleteTask}
                        onDelete={onDeleteTask}
                        isToday={config.id === SectionId.TODAY}
                    />
                ))}

                {/* Add Task Input */}
                {config.id !== SectionId.DONE && (
                    <form onSubmit={handleSubmit} className="mt-4">
                        <div className={`relative flex items-center bg-gray-50 rounded-xl border transition-all duration-200 ${isFull ? 'border-gray-100 opacity-60 cursor-not-allowed' : 'border-gray-200 hover:border-gray-300 hover:bg-white focus-within:border-black/20 focus-within:bg-white focus-within:shadow-sm'}`}>
                            <div className="pl-3 text-gray-400">
                                <Plus size={18} />
                            </div>
                            <input
                                type="text"
                                disabled={isFull}
                                value={newTaskTitle}
                                onChange={(e) => setNewTaskTitle(e.target.value)}
                                placeholder={isFull ? "Лимит исчерпан" : "Добавить задачу..."}
                                className="w-full p-3 bg-transparent focus:outline-none text-sm font-medium text-gray-800 disabled:cursor-not-allowed placeholder:text-gray-400"
                            />
                        </div>
                    </form>
                )}
                
                {tasks.length === 0 && config.id !== SectionId.DONE && (
                    <div className="text-center py-6 text-gray-300 text-xs font-medium tracking-wide uppercase">
                        Список пуст
                    </div>
                )}
            </div>
        </div>
      )}
    </div>
  );
};