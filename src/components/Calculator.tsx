import React, { useState } from 'react';
import { useI18n } from '@/i18n';

interface CalculatorProps {
  value: number | null;
  onConfirm: (val: number) => void;
  onClose: () => void;
}

export const Calculator: React.FC<CalculatorProps> = ({ value, onConfirm, onClose }) => {
  const { t } = useI18n();
  const [expression, setExpression] = useState<string>(value ? String(value) : '0');

  const appendNumber = (num: string) => {
    if (expression === '0' && num !== '.') {
      setExpression(num);
    } else {
      setExpression((prev) => prev + num);
    }
  };

  const appendOperator = (op: string) => {
    const lastChar = expression.slice(-1);
    if (['+', '-', '*', '/'].includes(lastChar)) {
      setExpression((prev) => prev.slice(0, -1) + op);
    } else {
      setExpression((prev) => prev + op);
    }
  };

  const appendDot = () => {
    const parts = expression.split(/[+\-*/]/);
    if (!parts[parts.length - 1].includes('.')) {
      appendNumber('.');
    }
  };

  const clear = () => {
    setExpression('0');
  };

  const del = () => {
    if (expression.length <= 1) {
      setExpression('0');
    } else {
      setExpression((prev) => prev.slice(0, -1));
    }
  };

  const evaluateExpression = (): string => {
    try {
      const sanitized = expression.replace(/×/g, '*').replace(/÷/g, '/');
      // eslint-disable-next-line no-new-func
      const result = new Function('return ' + sanitized)();
      if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
        return String(result);
      }
      return 'Error';
    } catch {
      return 'Error';
    }
  };

  const handleEqual = () => {
    const result = evaluateExpression();
    setExpression(result);
  };

  const handleConfirm = () => {
    const result = evaluateExpression();
    if (result !== 'Error') {
      onConfirm(Number(result));
      onClose();
    }
  };

  return (
    <div
      id="calculator-modal-backdrop"
      className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-xs p-4 bg-gray-800 pixel-border space-y-4">
        <div className="bg-gray-200 text-black text-right p-2 text-3xl font-mono pixel-border-sm overflow-x-auto min-h-[52px] flex items-center justify-end">
          {expression || '0'}
        </div>
        <div className="grid grid-cols-4 gap-2">
          <button
            onClick={clear}
            className="col-span-2 pixel-border bg-red-500 text-2xl py-3 active:translate-y-px active:translate-x-px transition-transform font-bold"
          >
            AC
          </button>
          <button
            onClick={del}
            className="pixel-border bg-yellow-500 text-2xl py-3 active:translate-y-px active:translate-x-px transition-transform font-bold"
          >
            DEL
          </button>
          <button
            onClick={() => appendOperator('/')}
            className="pixel-border bg-blue-500 text-2xl py-3 active:translate-y-px active:translate-x-px transition-transform font-bold"
          >
            ÷
          </button>

          <button
            onClick={() => appendNumber('7')}
            className="pixel-border bg-gray-600 text-2xl py-3 active:translate-y-px active:translate-x-px transition-transform font-bold"
          >
            7
          </button>
          <button
            onClick={() => appendNumber('8')}
            className="pixel-border bg-gray-600 text-2xl py-3 active:translate-y-px active:translate-x-px transition-transform font-bold"
          >
            8
          </button>
          <button
            onClick={() => appendNumber('9')}
            className="pixel-border bg-gray-600 text-2xl py-3 active:translate-y-px active:translate-x-px transition-transform font-bold"
          >
            9
          </button>
          <button
            onClick={() => appendOperator('*')}
            className="pixel-border bg-blue-500 text-2xl py-3 active:translate-y-px active:translate-x-px transition-transform font-bold"
          >
            ×
          </button>

          <button
            onClick={() => appendNumber('4')}
            className="pixel-border bg-gray-600 text-2xl py-3 active:translate-y-px active:translate-x-px transition-transform font-bold"
          >
            4
          </button>
          <button
            onClick={() => appendNumber('5')}
            className="pixel-border bg-gray-600 text-2xl py-3 active:translate-y-px active:translate-x-px transition-transform font-bold"
          >
            5
          </button>
          <button
            onClick={() => appendNumber('6')}
            className="pixel-border bg-gray-600 text-2xl py-3 active:translate-y-px active:translate-x-px transition-transform font-bold"
          >
            6
          </button>
          <button
            onClick={() => appendOperator('-')}
            className="pixel-border bg-blue-500 text-2xl py-3 active:translate-y-px active:translate-x-px transition-transform font-bold"
          >
            -
          </button>

          <button
            onClick={() => appendNumber('1')}
            className="pixel-border bg-gray-600 text-2xl py-3 active:translate-y-px active:translate-x-px transition-transform font-bold"
          >
            1
          </button>
          <button
            onClick={() => appendNumber('2')}
            className="pixel-border bg-gray-600 text-2xl py-3 active:translate-y-px active:translate-x-px transition-transform font-bold"
          >
            2
          </button>
          <button
            onClick={() => appendNumber('3')}
            className="pixel-border bg-gray-600 text-2xl py-3 active:translate-y-px active:translate-x-px transition-transform font-bold"
          >
            3
          </button>
          <button
            onClick={() => appendOperator('+')}
            className="pixel-border bg-blue-500 text-2xl py-3 active:translate-y-px active:translate-x-px transition-transform font-bold"
          >
            +
          </button>

          <button
            onClick={() => appendNumber('0')}
            className="col-span-2 pixel-border bg-gray-600 text-2xl py-3 active:translate-y-px active:translate-x-px transition-transform font-bold"
          >
            0
          </button>
          <button
            onClick={appendDot}
            className="pixel-border bg-gray-600 text-2xl py-3 active:translate-y-px active:translate-x-px transition-transform font-bold"
          >
            .
          </button>
          <button
            onClick={handleEqual}
            className="pixel-border bg-green-500 text-2xl py-3 active:translate-y-px active:translate-x-px transition-transform font-bold"
          >
            =
          </button>
        </div>
        <button
          onClick={handleConfirm}
          className="w-full pixel-border bg-green-500 text-lg py-2 mt-2 font-bold active:translate-y-px active:translate-x-px transition-transform"
        >
          {t('calculator.confirm')}
        </button>
      </div>
    </div>
  );
};
