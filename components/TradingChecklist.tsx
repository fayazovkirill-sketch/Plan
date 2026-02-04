import React, { useState } from 'react';
import { TRADING_CHECKLIST } from '../constants';
import { triggerHaptic } from '../services/haptics';

interface Props {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const TradingChecklist: React.FC<Props> = ({ isOpen, onConfirm, onCancel }) => {
  const [checkedItems, setCheckedItems] = useState<boolean[]>(new Array(TRADING_CHECKLIST.length).fill(false));

  if (!isOpen) return null;

  const handleCheck = (index: number) => {
    triggerHaptic('light');
    const newChecked = [...checkedItems];
    newChecked[index] = !newChecked[index];
    setCheckedItems(newChecked);
  };

  const allChecked = checkedItems.every(Boolean);

  const handleSubmit = () => {
    if (allChecked) {
      triggerHaptic('success');
      onConfirm();
      setCheckedItems(new Array(TRADING_CHECKLIST.length).fill(false)); // Reset
    } else {
        triggerHaptic('error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-[fadeIn_0.2s_ease-out]">
        <h3 className="text-xl font-bold text-gray-900 mb-2">#трейдинг</h3>
        <p className="text-gray-500 text-sm mb-6">Подтверди дисциплину перед закрытием.</p>
        
        <div className="space-y-4 mb-8">
          {TRADING_CHECKLIST.map((item, index) => (
            <label key={index} className="flex items-start gap-3 cursor-pointer group">
              <div className="relative flex items-center">
                <input
                  type="checkbox"
                  checked={checkedItems[index]}
                  onChange={() => handleCheck(index)}
                  className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border border-gray-300 transition-all checked:border-black checked:bg-black hover:border-gray-400"
                />
                 <svg
                    className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none opacity-0 peer-checked:opacity-100 text-white transition-opacity"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </div>
              <span className={`text-sm transition-colors ${checkedItems[index] ? 'text-black font-medium' : 'text-gray-600'}`}>
                {item}
              </span>
            </label>
          ))}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-3 rounded-xl bg-gray-100 text-gray-700 font-medium active:scale-95 transition-transform"
          >
            Отмена
          </button>
          <button
            onClick={handleSubmit}
            disabled={!allChecked}
            className={`flex-1 px-4 py-3 rounded-xl font-medium transition-all active:scale-95 ${
              allChecked 
                ? 'bg-black text-white shadow-lg' 
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};