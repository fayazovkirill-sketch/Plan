import React, { useState, useEffect } from 'react';
import { SectionId, Task, Subtask } from '../types';
import { STAGNATION_THRESHOLD_MS, TRADING_TAGS, FOCUS_EDIT_LOCK_MS } from '../constants';
import { triggerHaptic } from '../services/haptics';
import { Check, Star, Trash2, MoreHorizontal, ChevronDown, ChevronRight, Plus, Pencil, Calendar, Save, X, Lock, Unlock } from 'lucide-react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

interface Props {
  task: Task;
  onComplete: (task: Task) => void;
  onUpdate: (task: Task) => void;
  onDelete: (taskId: string) => void;
  isToday: boolean;
  isOverlay?: boolean; // If true, rendering as a drag overlay
}

// Utility to format date as D.M.YYYY
const formatDate = (timestamp: number): string => {
  const d = new Date(timestamp);
  return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
};

// Utility to get YYYY-MM-DD for input
const getInputValue = (timestamp?: number): string => {
  if (!timestamp) return '';
  const d = new Date(timestamp);
  const pad = (n: number) => n < 10 ? '0' + n : n;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const TaskItem: React.FC<Props> = ({ task, onComplete, onUpdate, onDelete, isToday, isOverlay }) => {
  const [showMenu, setShowMenu] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [newSubtask, setNewSubtask] = useState('');
  
  // Timer State
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Edit State
  const [editTitle, setEditTitle] = useState(task.title);
  const [editDate, setEditDate] = useState(getInputValue(task.dueDate));

  // Update timer every SECOND (1000ms) to show seconds ticking
  useEffect(() => {
    if (task.isFocus) {
      const interval = setInterval(() => setCurrentTime(Date.now()), 1000); 
      return () => clearInterval(interval);
    }
  }, [task.isFocus]);

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: { task },
    disabled: isEditing, // Disable drag while editing
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.3 : 1, // Fade original when dragging
  };

  // 1. Visual Pain: Overdue from Today
  const isStaleToday =
    task.section === SectionId.TODAY &&
    task.dateAddedToToday &&
    Date.now() > task.dateAddedToToday + 24 * 60 * 60 * 1000;

  // 2. Visual Pain: Stagnation (Fading)
  const isStagnant =
    task.section !== SectionId.DONE &&
    Date.now() - task.updatedAt > STAGNATION_THRESHOLD_MS;

  // 3. Visual Pain: Past Due Date
  const isPastDue = task.dueDate && Date.now() > task.dueDate && task.section !== SectionId.DONE;

  // 4. Focus Lock Logic
  // Timer only runs if lastTitleEditAt > 0. If 0, it means it's empty/draft.
  const isTimerRunning = (task.lastTitleEditAt || 0) > 0;
  const msSinceTitleEdit = currentTime - (task.lastTitleEditAt || 0);
  const isFocusLocked = task.isFocus && isTimerRunning && msSinceTitleEdit < FOCUS_EDIT_LOCK_MS;
  
  // Calculate remaining time
  let remainingString = "00:00:00";
  if (isFocusLocked) {
      const remaining = Math.max(0, FOCUS_EDIT_LOCK_MS - msSinceTitleEdit);
      
      const hours = Math.floor(remaining / (1000 * 60 * 60));
      const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((remaining % (1000 * 60)) / 1000);
      
      const h = hours.toString().padStart(2, '0');
      const m = minutes.toString().padStart(2, '0');
      const s = seconds.toString().padStart(2, '0');
      remainingString = `${h}:${m}:${s}`;
  }

  const handleToggleFocus = (e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic('medium');
    onUpdate({ ...task, isFocus: !task.isFocus });
  };

  const handleAddSubtask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubtask.trim()) return;
    const sub: Subtask = {
      id: crypto.randomUUID(),
      title: newSubtask.trim(),
      isCompleted: false,
    };
    onUpdate({
      ...task,
      subtasks: [...task.subtasks, sub],
      updatedAt: Date.now()
    });
    setNewSubtask('');
    triggerHaptic('light');
  };

  const toggleSubtask = (subId: string) => {
    triggerHaptic('light');
    const updatedSubtasks = task.subtasks.map(s => 
      s.id === subId ? { ...s, isCompleted: !s.isCompleted } : s
    );
    onUpdate({ ...task, subtasks: updatedSubtasks, updatedAt: Date.now() });
  };

  const enterEditMode = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    
    // Check Focus Lock
    if (isFocusLocked) {
        triggerHaptic('error');
        return;
    }

    setIsEditing(true);
    setEditTitle(task.title);
    setEditDate(getInputValue(task.dueDate));
    setShowMenu(false);
    triggerHaptic('light');
  };

  const saveEdit = (e?: React.FormEvent) => {
    e?.stopPropagation();
    e?.preventDefault();
    
    const newTitle = editTitle.trim();
    
    // Allow empty title ONLY for Focus task (as Draft mode). 
    // Normal tasks delete on empty save (usually), but here we prevent save if empty.
    if (!newTitle && !task.isFocus) return;

    let newDueDate: number | undefined = undefined;
    if (editDate) {
      const dateObj = new Date(editDate);
      dateObj.setHours(23, 59, 59, 999); 
      newDueDate = dateObj.getTime();
    }

    // Timer Logic:
    // If title is empty -> Timer OFF (lastTitleEditAt = 0)
    // If title has text -> Timer ON (lastTitleEditAt = Date.now())
    const isNowEmpty = newTitle.length === 0;
    
    onUpdate({
      ...task,
      title: newTitle,
      dueDate: newDueDate,
      lastTitleEditAt: isNowEmpty ? 0 : Date.now(),
      updatedAt: Date.now()
    });
    setIsEditing(false);
    triggerHaptic('success');
  };

  const cancelEdit = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setIsEditing(false);
    setEditTitle(task.title);
  };

  // Style Calculation
  let containerClass = "group relative bg-white rounded-xl p-3 shadow-sm border transition-all duration-300";
  
  if (isOverlay) {
    containerClass += " shadow-lifted scale-105 z-50 cursor-grabbing";
  } else {
    containerClass += " touch-manipulation"; 
  }
  
  if (isStaleToday || isPastDue) {
    containerClass += " border-red-500 bg-red-50/30"; 
  } else if (task.isFocus) {
    // Focus Styles
    if (isFocusLocked) {
        // Locked State: Amber warning tones
        containerClass += " border-amber-300 ring-1 ring-amber-100 shadow-md bg-amber-50/40";
    } else {
        // Unlocked and ready to edit: Green success tones
        containerClass += " border-green-400 ring-2 ring-green-100 shadow-[0_0_15px_rgba(74,222,128,0.15)] bg-white";
    }
  } else {
    containerClass += " border-transparent hover:border-gray-200";
  }

  if (isStagnant && !isOverlay) {
    containerClass += " opacity-60 hover:opacity-100 grayscale hover:grayscale-0";
  }

  // --- RENDER EDIT MODE ---
  if (isEditing && !isOverlay) {
      return (
        <div className="bg-white rounded-xl p-3 shadow-md border border-black/10 ring-2 ring-black/5">
            <form onSubmit={saveEdit} className="space-y-3">
                <input
                    autoFocus
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full text-base font-medium text-gray-900 focus:outline-none placeholder:text-gray-300"
                    placeholder="Фокус дня..."
                />
                
                <div className="flex items-center gap-2">
                    <Calendar size={16} className="text-gray-400" />
                    <input
                        type="date"
                        value={editDate}
                        onChange={(e) => setEditDate(e.target.value)}
                        className="text-sm bg-gray-50 rounded-lg px-2 py-1.5 text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-200"
                    />
                </div>

                <div className="flex justify-end gap-2 pt-1">
                    <button type="button" onClick={cancelEdit} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                        <X size={18} />
                    </button>
                    <button type="button" onClick={() => onDelete(task.id)} className="p-2 text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50 mr-auto">
                         <Trash2 size={18} />
                    </button>
                    <button type="submit" className="p-2 bg-black text-white rounded-lg shadow hover:bg-gray-800">
                        <Save size={18} />
                    </button>
                </div>
            </form>
        </div>
      );
  }

  // --- RENDER VIEW MODE ---
  return (
    <div 
        ref={setNodeRef} 
        style={style} 
        {...listeners} 
        {...attributes}
        onClick={(e) => {
            if (!showMenu && !isOverlay) enterEditMode(e);
        }}
        className={containerClass}
    >
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        <button
          onClick={(e) => { e.stopPropagation(); onComplete(task); }}
          onPointerDown={(e) => e.stopPropagation()} 
          className={`mt-1 flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
             task.section === SectionId.DONE ? 'bg-gray-400 border-gray-400' : 
             (isStaleToday || isPastDue) ? 'border-red-400 hover:bg-red-100' : 'border-gray-300 hover:border-black'
          }`}
        >
          {task.section === SectionId.DONE && <Check size={12} className="text-white" />}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className={`text-base font-medium leading-tight break-words ${task.section === SectionId.DONE ? 'line-through text-gray-400' : (isStaleToday || isPastDue) ? 'text-red-700' : 'text-gray-900'}`}>
              {task.title || <span className="text-gray-400 italic">Сформулируй Фокус дня...</span>}
            </span>
            <div className="flex items-center gap-1">
                 {/* Focus Star */}
                {isToday && task.section !== SectionId.DONE && (
                <button 
                    onClick={handleToggleFocus} 
                    onPointerDown={(e) => e.stopPropagation()}
                    className={`p-1 rounded-full transition-colors ${task.isFocus ? 'text-amber-500' : 'text-gray-200 hover:text-amber-400'}`}
                >
                    <Star size={16} fill={task.isFocus ? "currentColor" : "none"} />
                </button>
                )}
                
                {/* Lock Status Icon */}
                {isFocusLocked && (
                    <Lock size={12} className="text-amber-400" />
                )}
            </div>
          </div>
          
          {/* Tags & Subtask Count */}
          <div className="flex flex-wrap items-center gap-2 mt-1.5">
             {task.tags.map(tag => (
               <span key={tag} className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${tag === '#trading' || tag === '#трейдинг' ? 'bg-indigo-50 text-indigo-700' : 'bg-gray-100 text-gray-600'}`}>
                 {tag}
               </span>
             ))}
             {task.subtasks.length > 0 && (
                 <button 
                    onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }} 
                    onPointerDown={(e) => e.stopPropagation()}
                    className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-gray-700"
                 >
                    {isExpanded ? <ChevronDown size={12}/> : <ChevronRight size={12}/>}
                    {task.subtasks.filter(s => s.isCompleted).length}/{task.subtasks.length}
                 </button>
             )}
          </div>

          {/* Due Date Display */}
          {task.dueDate && (
             <div className={`mt-1.5 text-[10px] font-semibold flex items-center gap-1 ${isPastDue ? 'text-red-600' : 'text-gray-400'}`}>
                <Calendar size={10} />
                {formatDate(task.dueDate)}
             </div>
          )}

          {/* TIMER DISPLAY for Locked Focus Task */}
          {isFocusLocked && (
              <div className="mt-3 bg-white/60 border border-amber-200 rounded-lg p-3 text-center shadow-inner">
                  <div className="text-[10px] text-amber-700/70 font-bold mb-1 uppercase tracking-widest">
                      Дисциплина: изменение доступно через
                  </div>
                  <div className="text-3xl font-mono font-bold text-amber-600 tabular-nums tracking-tighter">
                      {remainingString}
                  </div>
              </div>
          )}
          
          {/* Unlocked Hint / Edit Button */}
          {!isFocusLocked && task.isFocus && task.section !== SectionId.DONE && (
              <button 
                  onClick={(e) => enterEditMode(e)}
                  className="mt-2 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-md bg-green-50 text-green-700 hover:bg-green-100 hover:text-green-900 border border-green-200/50 transition-colors"
              >
                  <Unlock size={12} />
                  <span className="text-[11px] font-semibold">Редактировать Фокус</span>
              </button>
          )}
        </div>

        {/* Edit/Menu Trigger */}
        <div className="relative">
          <button 
            onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
            onPointerDown={(e) => e.stopPropagation()}
            className="p-1 text-gray-300 hover:text-gray-600 rounded-md"
          >
            <MoreHorizontal size={18} />
          </button>
          
          {/* Dropdown Menu */}
          {showMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setShowMenu(false); }} />
              <div className="absolute right-0 top-6 z-20 w-32 bg-white rounded-lg shadow-xl border border-gray-100 py-1 text-sm animate-[fadeIn_0.1s_ease-out]">
                 <button
                    onClick={(e) => { e.stopPropagation(); enterEditMode(); }}
                    className={`w-full text-left px-3 py-2 flex items-center gap-2 ${isFocusLocked ? 'text-gray-400 cursor-not-allowed' : 'hover:bg-gray-50 text-gray-700'}`}
                 >
                    {isFocusLocked ? <Lock size={14}/> : <Pencil size={14}/>} 
                    {isFocusLocked ? 'Блок' : 'Редактировать'}
                 </button>
                 <div className="h-px bg-gray-100 my-1"></div>
                 <button
                    onClick={(e) => { e.stopPropagation(); onDelete(task.id); setShowMenu(false); }}
                    className="w-full text-left px-3 py-2 hover:bg-red-50 text-red-600 flex items-center gap-2"
                 >
                    <Trash2 size={14}/> Удалить
                 </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Subtasks */}
      {isExpanded && !isOverlay && (
        <div className="mt-3 pl-8 space-y-2">
            {task.subtasks.map(sub => (
                <div key={sub.id} className="flex items-center gap-2 group/sub">
                    <button 
                        onClick={(e) => { e.stopPropagation(); toggleSubtask(sub.id); }}
                        onPointerDown={(e) => e.stopPropagation()}
                        className={`w-3 h-3 rounded-[3px] border transition-colors ${sub.isCompleted ? 'bg-gray-400 border-gray-400' : 'border-gray-300'}`}
                    />
                    <span className={`text-sm ${sub.isCompleted ? 'line-through text-gray-400' : 'text-gray-600'}`}>
                        {sub.title}
                    </span>
                </div>
            ))}
            <form onSubmit={handleAddSubtask} className="flex items-center gap-2 mt-2">
                <Plus size={14} className="text-gray-400"/>
                <input 
                    type="text" 
                    value={newSubtask}
                    onChange={(e) => setNewSubtask(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()} 
                    placeholder="Добавить подзадачу..."
                    className="flex-1 bg-transparent text-sm placeholder:text-gray-300 focus:outline-none"
                />
            </form>
        </div>
      )}
    </div>
  );
};