import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Chart,
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  Legend,
  Tooltip,
} from 'chart.js';
import dayjs from 'dayjs';
import { useApp } from '@/context/AppContext';
import { useI18n } from '@/i18n';

// Register Chart.js components
Chart.register(BarController, BarElement, CategoryScale, LinearScale, Legend, Tooltip);
Chart.defaults.font.family = "'open粉圓', 'Pixelify Sans', sans-serif";
Chart.defaults.color = '#FFFFFF';

interface DailyItem {
  dateStr: string;
  dayNum: number;
  dayLabel: string;
  fullDateLabel: string;
  weekdayLabel: string;
  amount: number;
  txCount: number;
  isToday: boolean;
  isWeekend: boolean;
}

interface DailyStats {
  total: number;
  dailyAvg: number;
  activeDays: number;
  totalDays: number;
  peakDay: DailyItem | null;
}

export const StatsPage: React.FC = () => {
  const {
    transactionsWithDetails,
    setCurrentPage,
    setStatsDetailsContext,
    statsFilterState,
    setStatsFilterState,
  } = useApp();
  const { t, language } = useI18n();

  const chartCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstanceRef = useRef<Chart<'bar'> | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const timeRange = statsFilterState.timeRange;
  const displayType = statsFilterState.displayType;
  const selectedDateStr = statsFilterState.selectedDateStr;
  const currentDate = useMemo(() => new Date(statsFilterState.currentDateIso), [statsFilterState.currentDateIso]);

  const setTimeRange = (range: 'weekly' | 'monthly') => {
    setStatsFilterState((prev) => ({
      ...prev,
      timeRange: range,
      selectedDateStr: null,
    }));
  };

  const setDisplayType = (type: 'expense' | 'income') => {
    setStatsFilterState((prev) => ({
      ...prev,
      displayType: type,
    }));
  };

  const setSelectedDateStr = (dateStrOrUpdater: string | null | ((prev: string | null) => string | null)) => {
    setStatsFilterState((prev) => ({
      ...prev,
      selectedDateStr:
        typeof dateStrOrUpdater === 'function'
          ? dateStrOrUpdater(prev.selectedDateStr)
          : dateStrOrUpdater,
    }));
  };

  const setCurrentDate = (d: Date) => {
    setStatsFilterState((prev) => ({
      ...prev,
      currentDateIso: d.toISOString(),
      selectedDateStr: null,
    }));
  };

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

  // Generate continuous daily data for the selected period
  const dailyData: DailyItem[] = useMemo(() => {
    const { startDate, endDate } = dateRange;
    const days: DailyItem[] = [];

    const todayStr = dayjs().format('YYYY-MM-DD');
    const cur = new Date(startDate);
    const end = new Date(endDate);

    const amountMap: Record<string, { total: number; count: number }> = {};
    filteredTransactions
      .filter((tx) => tx.categoryType === displayType)
      .forEach((tx) => {
        const dStr = dayjs(tx.date).format('YYYY-MM-DD');
        if (!amountMap[dStr]) {
          amountMap[dStr] = { total: 0, count: 0 };
        }
        amountMap[dStr].total += tx.amount;
        amountMap[dStr].count += 1;
      });

    const weekdaysZh = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
    const weekdaysEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const isZh = language === 'zh-TW';

    while (cur <= end) {
      const dStr = dayjs(cur).format('YYYY-MM-DD');
      const dayNum = cur.getDate();
      const monthNum = cur.getMonth() + 1;
      const dayOfWeek = cur.getDay();
      const wkLabel = isZh ? weekdaysZh[dayOfWeek] : weekdaysEn[dayOfWeek];
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      const dayLabel =
        timeRange === 'monthly'
          ? `${dayNum}${isZh ? '日' : ''}`
          : `${wkLabel} ${monthNum}/${dayNum}`;

      const fullDateLabel = `${dStr} (${wkLabel})`;
      const info = amountMap[dStr] || { total: 0, count: 0 };

      days.push({
        dateStr: dStr,
        dayNum,
        dayLabel,
        fullDateLabel,
        weekdayLabel: wkLabel,
        amount: info.total,
        txCount: info.count,
        isToday: dStr === todayStr,
        isWeekend,
      });

      cur.setDate(cur.getDate() + 1);
    }

    return days;
  }, [dateRange, filteredTransactions, displayType, timeRange, language]);

  // Calculate daily statistics insights
  const dailyStats: DailyStats = useMemo(() => {
    const total = displayType === 'expense' ? summary.expense : summary.income;
    const totalDays = dailyData.length;
    const activeDays = dailyData.filter((d) => d.amount > 0).length;
    const avg = totalDays > 0 ? Math.round(total / totalDays) : 0;

    let peakDay: DailyItem | null = null;
    dailyData.forEach((d) => {
      if (d.amount > 0 && (!peakDay || d.amount > peakDay.amount)) {
        peakDay = d;
      }
    });

    return {
      total,
      dailyAvg: avg,
      activeDays,
      totalDays,
      peakDay,
    };
  }, [dailyData, displayType, summary]);

  // Category breakdown ranking (dynamically filtered when a date is selected from chart)
  const categoryBreakdown = useMemo(() => {
    // Filter transactions by selected date if one is clicked on the chart
    const activeList = filteredTransactions.filter((tx) => {
      if (tx.categoryType !== displayType) return false;
      if (selectedDateStr) {
        return dayjs(tx.date).format('YYYY-MM-DD') === selectedDateStr;
      }
      return true;
    });

    const totalAmount = activeList.reduce((sum, tx) => sum + tx.amount, 0);
    if (totalAmount === 0 || activeList.length === 0) return [];

    const map = new Map<
      string,
      { name: string; id: number; icon: string; amount: number }
    >();

    activeList.forEach((tx) => {
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
  }, [displayType, filteredTransactions, selectedDateStr]);

  // Auto-scroll to selected date or today in monthly view
  useEffect(() => {
    if (timeRange === 'monthly' && scrollContainerRef.current) {
      let targetIndex = -1;
      if (selectedDateStr) {
        targetIndex = dailyData.findIndex((d) => d.dateStr === selectedDateStr);
      }
      if (targetIndex === -1) {
        targetIndex = dailyData.findIndex((d) => d.isToday);
      }

      if (targetIndex >= 0) {
        const barWidth = 22;
        const targetScroll = Math.max(0, targetIndex * barWidth - 120);
        scrollContainerRef.current.scrollTo({ left: targetScroll, behavior: 'smooth' });
      }
    }
  }, [timeRange, dateRange, dailyData, selectedDateStr]);

  // Selected Day Details
  const selectedDayInfo = useMemo(() => {
    if (!selectedDateStr) return null;
    return dailyData.find((d) => d.dateStr === selectedDateStr) || null;
  }, [selectedDateStr, dailyData]);

  // Daily Bar Chart Rendering
  useEffect(() => {
    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
      chartInstanceRef.current = null;
    }

    if (!chartCanvasRef.current) return;

    const isExpense = displayType === 'expense';
    const isZh = language === 'zh-TW';
    const txUnitText = t('stats.txUnit');

    const labels = dailyData.map((d) => d.dayLabel);
    const dataValues = dailyData.map((d) => d.amount);

    // Dynamic bar colors: highlight selected date, today, and peak day
    const backgroundColors = dailyData.map((d) => {
      const isSelected = selectedDateStr === d.dateStr;
      if (isSelected) {
        return '#facc15'; // yellow-400 for selected
      }
      if (isExpense) {
        if (d.isToday) return '#fb7185'; // rose-400 for today
        if (dailyStats.peakDay?.dateStr === d.dateStr && d.amount > 0) return '#ef4444'; // deep red for peak
        return d.amount > 0 ? '#f87171' : 'rgba(75, 85, 99, 0.4)'; // red-400 or muted placeholder
      } else {
        if (d.isToday) return '#86efac'; // green-300 for today
        if (dailyStats.peakDay?.dateStr === d.dateStr && d.amount > 0) return '#22c55e'; // deep green for peak
        return d.amount > 0 ? '#4ade80' : 'rgba(75, 85, 99, 0.4)'; // green-400 or muted placeholder
      }
    });

    const borderColors = dailyData.map((d) => {
      const isSelected = selectedDateStr === d.dateStr;
      if (isSelected) return '#ffffff';
      return d.amount > 0 ? '#1e1e1e' : 'transparent';
    });

    const ctx = chartCanvasRef.current.getContext('2d');
    if (!ctx) return;

    chartInstanceRef.current = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: isExpense ? t('stats.expense') : t('stats.income'),
            data: dataValues,
            backgroundColor: backgroundColors,
            borderColor: borderColors,
            borderWidth: 2,
            borderRadius: 2,
            borderSkipped: false,
            barThickness: timeRange === 'monthly' ? 14 : undefined,
            maxBarThickness: timeRange === 'monthly' ? 18 : 36,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        onClick: (_event, elements) => {
          if (elements.length > 0) {
            const index = elements[0].index;
            const clickedDay = dailyData[index];
            if (clickedDay) {
              setSelectedDateStr((prev) => (prev === clickedDay.dateStr ? null : clickedDay.dateStr));
            }
          }
        },
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            enabled: true,
            backgroundColor: '#1f2937',
            titleColor: '#facc15',
            titleFont: {
              family: "'open粉圓', 'Pixelify Sans', sans-serif",
              size: 13,
              weight: 'bold',
            },
            bodyColor: '#ffffff',
            bodyFont: {
              family: "'open粉圓', 'Pixelify Sans', sans-serif",
              size: 13,
            },
            borderColor: '#1e1e1e',
            borderWidth: 2,
            padding: 8,
            displayColors: false,
            callbacks: {
              title: (contexts) => {
                const idx = contexts[0].dataIndex;
                const d = dailyData[idx];
                return d ? d.fullDateLabel : '';
              },
              label: (context) => {
                const idx = context.dataIndex;
                const d = dailyData[idx];
                const typeLabel = isExpense ? (isZh ? '支出' : 'Expense') : isZh ? '收入' : 'Income';
                const amt = (context.parsed.y ?? 0).toLocaleString();
                const count = d?.txCount ?? 0;
                return `${typeLabel}: $${amt} (${count} ${txUnitText})`;
              },
            },
          },
        },
        scales: {
          x: {
            grid: {
              display: false,
            },
            ticks: {
              color: (context) => {
                const idx = context.index;
                const d = dailyData[idx];
                if (d?.isToday) return '#facc15';
                if (d?.isWeekend) return '#93c5fd'; // blue tint for weekends
                return '#d1d5db';
              },
              font: {
                family: "'open粉圓', 'Pixelify Sans', sans-serif",
                size: timeRange === 'monthly' ? 10 : 12,
              },
              maxRotation: 0,
              minRotation: 0,
            },
          },
          y: {
            beginAtZero: true,
            grid: {
              color: 'rgba(255, 255, 255, 0.08)',
            },
            ticks: {
              color: '#9ca3af',
              font: {
                family: "'open粉圓', 'Pixelify Sans', sans-serif",
                size: 10,
              },
              callback: (value) => {
                const val = Number(value);
                if (val >= 10000) return `${(val / 10000).toFixed(1)}w`;
                if (val >= 1000) return `${(val / 1000).toFixed(0)}k`;
                return `${val}`;
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
  }, [dailyData, displayType, language, selectedDateStr, timeRange, dailyStats, t]);

  const prevPeriod = () => {
    const d = new Date(currentDate);
    if (timeRange === 'monthly') {
      d.setMonth(d.getMonth() - 1);
    } else {
      d.setDate(d.getDate() - 7);
    }
    setCurrentDate(d);
    setSelectedDateStr(null);
  };

  const nextPeriod = () => {
    const d = new Date(currentDate);
    if (timeRange === 'monthly') {
      d.setMonth(d.getMonth() + 1);
    } else {
      d.setDate(d.getDate() + 7);
    }
    setCurrentDate(d);
    setSelectedDateStr(null);
  };

  const viewDetails = (item: { id: number }) => {
    let startDateStr = dateRange.startDate.toISOString();
    let endDateStr = dateRange.endDate.toISOString();

    if (selectedDateStr) {
      startDateStr = new Date(`${selectedDateStr}T00:00:00`).toISOString();
      endDateStr = new Date(`${selectedDateStr}T23:59:59.999`).toISOString();
    }

    setStatsDetailsContext({
      categoryId: item.id,
      startDate: startDateStr,
      endDate: endDateStr,
      type: displayType,
    });
    setCurrentPage('categoryDetails');
  };

  // Min width calculation for scrollable monthly bar chart (ensuring high visual clarity)
  const chartCanvasMinWidth = useMemo(() => {
    if (timeRange === 'monthly') {
      // 31 days * 22px gives ample space for each day bar and label
      return `${Math.max(dailyData.length * 22, 660)}px`;
    }
    return '100%';
  }, [timeRange, dailyData.length]);

  return (
    <div className="space-y-4">
      {/* Header */}
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
            onClick={() => {
              setTimeRange('weekly');
              setSelectedDateStr(null);
            }}
            className={`flex-1 px-4 py-2 text-lg font-bold transition-transform transform active:translate-y-px active:translate-x-px pixel-border-sm ${
              timeRange === 'weekly' ? 'bg-yellow-400 text-black' : 'bg-gray-500'
            }`}
          >
            {t('stats.weekly')}
          </button>
          <button
            onClick={() => {
              setTimeRange('monthly');
              setSelectedDateStr(null);
            }}
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

      {/* Summary overview cards */}
      <div className="p-4 bg-gray-700 pixel-border grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-gray-400 text-xs font-bold">{t('stats.totalIncome')}</p>
          <p className="text-lg font-bold text-green-400">${summary.income.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-gray-400 text-xs font-bold">{t('stats.totalExpense')}</p>
          <p className="text-lg font-bold text-red-400">${summary.expense.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-gray-400 text-xs font-bold">{t('stats.balance')}</p>
          <p
            className={`text-lg font-bold ${
              summary.balance >= 0 ? 'text-yellow-400' : 'text-red-400'
            }`}
          >
            ${summary.balance.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Daily Bar Chart Section */}
      <div className="p-4 bg-gray-700 pixel-border space-y-3">
        {/* Expense / Income analysis tabs */}
        <div className="flex space-x-2">
          <button
            onClick={() => {
              setDisplayType('expense');
              setSelectedDateStr(null);
            }}
            className={`flex-1 px-3 py-2 text-base font-bold transition-transform transform active:translate-y-px active:translate-x-px pixel-border-sm ${
              displayType === 'expense' ? 'bg-red-500 text-white' : 'bg-gray-500 text-gray-300'
            }`}
          >
            {t('stats.expenseAnalysis')}
          </button>
          <button
            onClick={() => {
              setDisplayType('income');
              setSelectedDateStr(null);
            }}
            className={`flex-1 px-3 py-2 text-base font-bold transition-transform transform active:translate-y-px active:translate-x-px pixel-border-sm ${
              displayType === 'income' ? 'bg-green-500 text-white' : 'bg-gray-500 text-gray-300'
            }`}
          >
            {t('stats.incomeAnalysis')}
          </button>
        </div>

        {/* Daily Insights Header */}
        <div className="bg-gray-800 p-2.5 pixel-border-sm grid grid-cols-3 gap-2 text-center text-xs">
          <div>
            <span className="text-gray-400 block">{t('stats.dailyAverage')}</span>
            <span className={`font-bold text-sm ${displayType === 'expense' ? 'text-red-400' : 'text-green-400'}`}>
              ${dailyStats.dailyAvg.toLocaleString()}
            </span>
          </div>
          <div>
            <span className="text-gray-400 block">{t('stats.maxDay')}</span>
            <span className={`font-bold text-sm truncate block ${displayType === 'expense' ? 'text-red-400' : 'text-green-400'}`}>
              {dailyStats.peakDay
                ? `${dailyStats.peakDay.dayLabel} $${dailyStats.peakDay.amount.toLocaleString()}`
                : '-'}
            </span>
          </div>
          <div>
            <span className="text-gray-400 block">{t('stats.activeDays')}</span>
            <span className="font-bold text-sm text-yellow-400">
              {dailyStats.activeDays} / {dailyStats.totalDays} {t('stats.day') || '天'}
            </span>
          </div>
        </div>

        {/* Interactive Scrollable Chart Container */}
        <div className="space-y-1">
          <div
            ref={scrollContainerRef}
            className="w-full overflow-x-auto overflow-y-hidden pb-2 scrollbar-thin bg-gray-800/80 p-2 rounded pixel-border-sm"
          >
            <div style={{ minWidth: chartCanvasMinWidth, height: '190px' }} className="relative">
              <canvas ref={chartCanvasRef} />
            </div>
          </div>

          {/* Monthly view hint for scrolling */}
          {timeRange === 'monthly' && (
            <p className="text-[11px] text-gray-400 text-center flex items-center justify-center gap-1">
              <span>↔️ {t('stats.scrollHint')}</span>
            </p>
          )}
        </div>

        {/* Selected Day Quick Card */}
        {selectedDayInfo && (
          <div className="bg-gray-800 border-2 border-yellow-400 p-3 pixel-border-sm flex justify-between items-center">
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-yellow-400 text-sm">
                  {selectedDayInfo.fullDateLabel}
                </span>
                {selectedDayInfo.isToday && (
                  <span className="bg-yellow-400 text-black px-1.5 py-0.2 text-[10px] font-bold rounded">
                    {language === 'zh-TW' ? '今日' : 'Today'}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-300 mt-0.5">
                {selectedDayInfo.amount > 0
                  ? `${displayType === 'expense' ? t('stats.expense') : t('stats.income')}: $${selectedDayInfo.amount.toLocaleString()} (${selectedDayInfo.txCount} ${t('stats.txUnit')})`
                  : t('stats.noTxOnDay')}
              </p>
            </div>
            <button
              onClick={() => setSelectedDateStr(null)}
              className="text-xs text-gray-400 hover:text-white px-2 py-1 bg-gray-700 pixel-border-sm active:translate-y-px"
            >
              ✕
            </button>
          </div>
        )}

        {/* Category Ranking Title & Filter Header */}
        <div className="pt-2 border-t border-gray-600 space-y-2">
          <div className="flex justify-between items-center flex-wrap gap-2">
            <div className="flex items-center space-x-2">
              <h3 className="text-base font-bold text-yellow-400">
                {selectedDateStr
                  ? `${selectedDayInfo?.dayLabel || selectedDateStr} ${
                      displayType === 'expense'
                        ? t('stats.expenseDetails')
                        : t('stats.incomeDetails')
                    }`
                  : `${
                      displayType === 'expense'
                        ? t('stats.expenseDetails')
                        : t('stats.incomeDetails')
                    } (${t('stats.allPeriod')})`}
              </h3>
              {selectedDateStr && (
                <span className="text-[11px] bg-yellow-400/20 text-yellow-300 border border-yellow-400/50 px-1.5 py-0.5 rounded font-bold">
                  {t('stats.dayDetails')}
                </span>
              )}
            </div>

            {selectedDateStr && (
              <button
                onClick={() => setSelectedDateStr(null)}
                className="text-xs text-yellow-300 bg-gray-800 border border-yellow-400 px-2.5 py-1 pixel-border-sm hover:bg-gray-700 active:translate-y-px transition-all font-bold"
              >
                ✕ {t('stats.clearFilter')}
              </button>
            )}
          </div>

          {/* Category List */}
          <div className="space-y-2">
            {categoryBreakdown.length === 0 ? (
              <div className="text-center text-gray-400 py-6 space-y-2">
                <p>
                  {selectedDateStr
                    ? `${selectedDayInfo?.fullDateLabel || selectedDateStr} ${t(
                        'stats.noDataOnSelectedDay'
                      )}`
                    : t('stats.noData')}
                </p>
                {selectedDateStr && (
                  <button
                    onClick={() => setSelectedDateStr(null)}
                    className="text-xs text-yellow-400 underline hover:text-yellow-300"
                  >
                    {t('stats.clearFilter')}
                  </button>
                )}
              </div>
            ) : (
              categoryBreakdown.map((item, index) => (
                <div
                  key={item.name}
                  className="flex items-center justify-between p-2 bg-gray-800/60 pixel-border-sm border-gray-600"
                >
                  <div className="flex items-center space-x-2 flex-1 min-w-0">
                    <span className="text-gray-400 font-bold w-5 text-center shrink-0 text-xs">
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
                      className={`text-right font-bold text-sm ${
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
    </div>
  );
};
