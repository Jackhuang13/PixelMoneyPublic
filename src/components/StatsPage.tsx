import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Chart,
  DoughnutController,
  ArcElement,
  Legend,
  Tooltip,
} from 'chart.js';
import { useApp } from '@/context/AppContext';
import { useI18n } from '@/i18n';

// Register Chart.js components
Chart.register(DoughnutController, ArcElement, Legend, Tooltip);
Chart.defaults.font.family = "'open粉圓', 'Pixelify Sans', sans-serif";
Chart.defaults.font.size = 14;
Chart.defaults.color = '#FFFFFF';

export const StatsPage: React.FC = () => {
  const {
    transactionsWithDetails,
    setCurrentPage,
    setStatsDetailsContext,
  } = useApp();
  const { t, language } = useI18n();

  const chartCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstanceRef = useRef<Chart<'doughnut'> | null>(null);

  const [timeRange, setTimeRange] = useState<'weekly' | 'monthly'>('monthly');
  const [displayType, setDisplayType] = useState<'expense' | 'income'>('expense');
  const [currentDate, setCurrentDate] = useState<Date>(new Date());

  const dateRange = useMemo(() => {
    const d = new Date(currentDate);
    let startDate: Date;
    let endDate: Date;

    if (timeRange === 'monthly') {
      startDate = new Date(d.getFullYear(), d.getMonth(), 1);
      endDate = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
    } else {
      // Weekly: start on Monday
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      startDate = new Date(d.setDate(diff));
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);
      endDate.setHours(23, 59, 59, 999);
    }
    return { startDate, endDate };
  }, [currentDate, timeRange]);

  const currentPeriodLabel = useMemo(() => {
    const { startDate, endDate } = dateRange;
    const locale = language === 'zh-TW' ? 'zh-TW' : 'en-US';
    if (timeRange === 'monthly') {
      return startDate.toLocaleDateString(locale, { year: 'numeric', month: 'long' });
    } else {
      const startStr = startDate.toLocaleDateString(locale, { month: 'numeric', day: 'numeric' });
      const endStr = endDate.toLocaleDateString(locale, { month: 'numeric', day: 'numeric' });
      return `${startStr} - ${endStr}`;
    }
  }, [dateRange, language, timeRange]);

  const filteredTransactions = useMemo(() => {
    const { startDate, endDate } = dateRange;
    return transactionsWithDetails.filter((tItem) => {
      const txDate = new Date(tItem.date);
      return txDate >= startDate && txDate <= endDate;
    });
  }, [dateRange, transactionsWithDetails]);

  const summary = useMemo(() => {
    return filteredTransactions.reduce(
      (acc, tx) => {
        if (tx.categoryType === 'income') {
          acc.income += tx.amount;
        } else {
          acc.expense += tx.amount;
        }
        acc.balance = acc.income - acc.expense;
        return acc;
      },
      { income: 0, expense: 0, balance: 0 }
    );
  }, [filteredTransactions]);

  const categoryBreakdown = useMemo(() => {
    const totalAmount = displayType === 'income' ? summary.income : summary.expense;
    if (totalAmount === 0) return [];

    const map = new Map<
      string,
      { name: string; id: number; icon: string; amount: number }
    >();

    filteredTransactions
      .filter((tx) => tx.categoryType === displayType)
      .forEach((tx) => {
        const catName = tx.categoryName;
        if (!map.has(catName)) {
          map.set(catName, {
            name: catName,
            id: tx.categoryId ?? 0,
            icon: tx.categoryIcon || '📦',
            amount: 0,
          });
        }
        const entry = map.get(catName)!;
        entry.amount += tx.amount;
      });

    return Array.from(map.values())
      .sort((a, b) => b.amount - a.amount)
      .map((item) => ({
        ...item,
        percentage: ((item.amount / totalAmount) * 100).toFixed(1),
      }));
  }, [displayType, summary, filteredTransactions]);

  // Chart rendering
  useEffect(() => {
    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
      chartInstanceRef.current = null;
    }

    if (!chartCanvasRef.current) return;

    const income = summary.income;
    const expense = summary.expense;

    let chartData;
    if (income === 0 && expense === 0) {
      chartData = {
        labels: [t('stats.noData')],
        datasets: [
          {
            data: [1],
            backgroundColor: ['#4b5563'],
            borderColor: '#374151',
            borderWidth: 0,
          },
        ],
      };
    } else {
      chartData = {
        labels: [t('stats.income'), t('stats.expense')],
        datasets: [
          {
            data: [income, expense],
            backgroundColor: ['#4ade80', '#f87171'],
            borderColor: '#374151',
            borderWidth: 3,
          },
        ],
      };
    }

    const ctx = chartCanvasRef.current.getContext('2d');
    if (!ctx) return;

    chartInstanceRef.current = new Chart(ctx, {
      type: 'doughnut',
      data: chartData,
      options: {
        responsive: true,
        cutout: '70%',
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            enabled: true,
            callbacks: {
              label: (context) => {
                let label = context.label || '';
                if (label) label += ': ';
                if (context.parsed !== null) {
                  label += context.parsed.toLocaleString();
                }
                return label;
              },
            },
          },
        },
        animation: false,
      },
    });

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
    };
  }, [summary, t]);

  const prevPeriod = () => {
    const d = new Date(currentDate);
    if (timeRange === 'monthly') {
      d.setMonth(d.getMonth() - 1);
    } else {
      d.setDate(d.getDate() - 7);
    }
    setCurrentDate(d);
  };

  const nextPeriod = () => {
    const d = new Date(currentDate);
    if (timeRange === 'monthly') {
      d.setMonth(d.getMonth() + 1);
    } else {
      d.setDate(d.getDate() + 7);
    }
    setCurrentDate(d);
  };

  const viewDetails = (item: { id: number }) => {
    setStatsDetailsContext({
      categoryId: item.id,
      startDate: dateRange.startDate.toISOString(),
      endDate: dateRange.endDate.toISOString(),
      type: displayType,
    });
    setCurrentPage('categoryDetails');
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-yellow-400">{t('stats.title')}</h1>
        <button
          id="go-to-search-btn"
          onClick={() => setCurrentPage('search')}
          className="p-2 text-white transition-transform transform active:translate-y-px active:translate-x-px"
          aria-label="Search"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="1.5"
            stroke="currentColor"
            className="w-8 h-8"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
            />
          </svg>
        </button>
      </div>

      {/* Period Navigation */}
      <div className="p-4 bg-gray-700 pixel-border space-y-4">
        <div className="flex space-x-2">
          <button
            onClick={() => setTimeRange('weekly')}
            className={`flex-1 px-4 py-2 text-lg font-bold transition-transform transform active:translate-y-px active:translate-x-px pixel-border-sm ${
              timeRange === 'weekly' ? 'bg-yellow-400 text-black' : 'bg-gray-500'
            }`}
          >
            {t('stats.weekly')}
          </button>
          <button
            onClick={() => setTimeRange('monthly')}
            className={`flex-1 px-4 py-2 text-lg font-bold transition-transform transform active:translate-y-px active:translate-x-px pixel-border-sm ${
              timeRange === 'monthly' ? 'bg-yellow-400 text-black' : 'bg-gray-500'
            }`}
          >
            {t('stats.monthly')}
          </button>
        </div>
        <div className="flex justify-between items-center">
          <button
            onClick={prevPeriod}
            className="px-4 py-2 text-lg font-bold transition-transform transform active:translate-y-px active:translate-x-px pixel-border-sm bg-gray-500"
          >
            &lt;
          </button>
          <h2 className="text-xl font-bold text-center">{currentPeriodLabel}</h2>
          <button
            onClick={nextPeriod}
            className="px-4 py-2 text-lg font-bold transition-transform transform active:translate-y-px active:translate-x-px pixel-border-sm bg-gray-500"
          >
            &gt;
          </button>
        </div>
      </div>

      {/* Summary info cards */}
      <div className="p-4 bg-gray-700 pixel-border grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-gray-400 text-sm">{t('stats.totalIncome')}</p>
          <p className="text-xl font-bold text-green-400">{summary.income.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-gray-400 text-sm">{t('stats.totalExpense')}</p>
          <p className="text-xl font-bold text-red-400">{summary.expense.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-gray-400 text-sm">{t('stats.balance')}</p>
          <p
            className={`text-xl font-bold ${
              summary.balance >= 0 ? 'text-white' : 'text-red-400'
            }`}
          >
            {summary.balance.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Chart & Category breakdown */}
      <div className="p-4 bg-gray-700 pixel-border">
        <div className="max-w-xs mx-auto mb-6 relative">
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <p className="text-gray-400 text-sm font-bold">
              {t(displayType === 'expense' ? 'stats.totalExpense' : 'stats.totalIncome')}
            </p>
            <p
              className={`text-3xl font-bold ${
                displayType === 'expense' ? 'text-red-400' : 'text-green-400'
              }`}
            >
              {(displayType === 'expense' ? summary.expense : summary.income).toLocaleString()}
            </p>
          </div>
          <canvas ref={chartCanvasRef} />
        </div>

        {/* Expense / Income analysis tabs */}
        <div className="flex space-x-2 mb-4">
          <button
            onClick={() => setDisplayType('expense')}
            className={`flex-1 px-4 py-2 text-lg font-bold transition-transform transform active:translate-y-px active:translate-x-px pixel-border-sm ${
              displayType === 'expense' ? 'bg-red-500 text-white' : 'bg-gray-500'
            }`}
          >
            {t('stats.expenseAnalysis')}
          </button>
          <button
            onClick={() => setDisplayType('income')}
            className={`flex-1 px-4 py-2 text-lg font-bold transition-transform transform active:translate-y-px active:translate-x-px pixel-border-sm ${
              displayType === 'income' ? 'bg-green-500 text-white' : 'bg-gray-500'
            }`}
          >
            {t('stats.incomeAnalysis')}
          </button>
        </div>

        {/* Category List */}
        <div className="space-y-2">
          {categoryBreakdown.length === 0 ? (
            <div className="text-center text-gray-400 py-4">{t('stats.noData')}</div>
          ) : (
            categoryBreakdown.map((item, index) => (
              <div
                key={item.name}
                className="flex items-center justify-between p-2 border-b border-gray-600 last:border-0"
              >
                <div className="flex items-center space-x-2 flex-1 min-w-0">
                  <span className="text-gray-400 font-bold w-6 text-center shrink-0 text-sm">
                    {index + 1}.
                  </span>
                  <span className="text-2xl shrink-0">{item.icon}</span>
                  <div className="flex flex-col min-w-0">
                    <span className="font-bold truncate text-sm leading-tight">{item.name}</span>
                    <span className="text-gray-400 font-bold text-xs">{item.percentage}%</span>
                  </div>
                </div>
                <div className="flex items-center space-x-2 shrink-0">
                  <div
                    className={`text-right font-bold ${
                      displayType === 'expense' ? 'text-red-400' : 'text-green-400'
                    }`}
                  >
                    ${item.amount.toLocaleString()}
                  </div>
                  <button
                    onClick={() => viewDetails(item)}
                    className="px-2 py-1 text-xs font-bold transition-transform pixel-border-sm bg-blue-500 active:translate-y-px active:translate-x-px"
                  >
                    {t('common.details') || 'Details'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
