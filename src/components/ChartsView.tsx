import React, { useState, useMemo } from 'react';
import { useFinance } from '../context/FinanceContext';
import { DEFAULT_CATEGORIES, PAYMENT_METHOD_LABELS } from '../data/defaultData';
import { formatCurrency, formatMonthName } from '../utils/formatters';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  PieChart,
  Users,
  CreditCard,
  Flame,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
} from 'lucide-react';

export const ChartsView: React.FC = () => {
  const { transactions, selectedMonth, partners } = useFinance();

  const [periodMode, setPeriodMode] = useState<'month' | 'history'>('month');
  const [chartType, setChartType] = useState<'expense' | 'income'>('expense');
  const [ownerFilter, setOwnerFilter] = useState<'all' | 'partner1' | 'partner2' | 'shared'>('all');

  // Filter transactions for current month
  const monthTransactions = useMemo(() => {
    return transactions.filter(t => {
      const matchMonth = t.date.startsWith(selectedMonth);
      const matchOwner = ownerFilter === 'all' || t.owner === ownerFilter;
      return matchMonth && matchOwner;
    });
  }, [transactions, selectedMonth, ownerFilter]);

  // Current month totals
  const totalIncome = useMemo(() => {
    return monthTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
  }, [monthTransactions]);

  const totalExpense = useMemo(() => {
    return monthTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
  }, [monthTransactions]);

  const netBalance = totalIncome - totalExpense;
  const savingsRate = totalIncome > 0 ? Math.max(0, Math.round(((totalIncome - totalExpense) / totalIncome) * 100)) : 0;

  // Category breakdown for current selection
  const categoryStats = useMemo(() => {
    const filtered = monthTransactions.filter(t => t.type === chartType);
    const total = filtered.reduce((sum, t) => sum + t.amount, 0);

    const map: Record<string, { id: string; amount: number; count: number }> = {};
    filtered.forEach(t => {
      if (!map[t.category]) {
        map[t.category] = { id: t.category, amount: 0, count: 0 };
      }
      map[t.category].amount += t.amount;
      map[t.category].count += 1;
    });

    const list = Object.values(map)
      .map(item => {
        const catInfo = DEFAULT_CATEGORIES.find(c => c.id === item.id) || {
          name: item.id,
          color: '#94a3b8',
        };
        const percentage = total > 0 ? (item.amount / total) * 100 : 0;
        return {
          ...item,
          name: catInfo.name,
          color: catInfo.color,
          percentage,
        };
      })
      .sort((a, b) => b.amount - a.amount);

    return { total, list };
  }, [monthTransactions, chartType]);

  // Partner spending breakdown (expenses only)
  const partnerStats = useMemo(() => {
    const expenses = monthTransactions.filter(t => t.type === 'expense');
    const total = expenses.reduce((sum, t) => sum + t.amount, 0);

    const p1 = expenses.filter(t => t.owner === 'partner1').reduce((s, t) => s + t.amount, 0);
    const p2 = expenses.filter(t => t.owner === 'partner2').reduce((s, t) => s + t.amount, 0);
    const shared = expenses.filter(t => t.owner === 'shared').reduce((s, t) => s + t.amount, 0);

    return {
      total,
      partner1: { amount: p1, percent: total > 0 ? (p1 / total) * 100 : 0 },
      partner2: { amount: p2, percent: total > 0 ? (p2 / total) * 100 : 0 },
      shared: { amount: shared, percent: total > 0 ? (shared / total) * 100 : 0 },
    };
  }, [monthTransactions]);

  // Payment methods breakdown
  const paymentStats = useMemo(() => {
    const expenses = monthTransactions.filter(t => t.type === 'expense');
    const total = expenses.reduce((sum, t) => sum + t.amount, 0);

    const map: Record<string, number> = {};
    expenses.forEach(t => {
      const pm = t.payment_method || 'outros';
      map[pm] = (map[pm] || 0) + t.amount;
    });

    return Object.entries(map)
      .map(([method, amount]) => ({
        method,
        label: PAYMENT_METHOD_LABELS[method] || method,
        amount,
        percent: total > 0 ? (amount / total) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [monthTransactions]);

  // 6-Month Historical Data
  const historicalData = useMemo(() => {
    const months: string[] = [];
    const [currYearStr, currMonthStr] = selectedMonth.split('-');
    const currYear = parseInt(currYearStr, 10);
    const currMonth = parseInt(currMonthStr, 10);

    for (let i = 5; i >= 0; i--) {
      let targetYear = currYear;
      let targetMonth = currMonth - i;
      while (targetMonth <= 0) {
        targetMonth += 12;
        targetYear -= 1;
      }
      const mStr = `${targetYear}-${String(targetMonth).padStart(2, '0')}`;
      months.push(mStr);
    }

    const data = months.map(m => {
      const txs = transactions.filter(t => {
        const matchM = t.date.startsWith(m);
        const matchO = ownerFilter === 'all' || t.owner === ownerFilter;
        return matchM && matchO;
      });

      const inc = txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
      const exp = txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

      const d = new Date(parseInt(m.split('-')[0], 10), parseInt(m.split('-')[1], 10) - 1, 1);
      const label = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');

      return {
        month: m,
        label: label.charAt(0).toUpperCase() + label.slice(1),
        income: inc,
        expense: exp,
        balance: inc - exp,
        isCurrent: m === selectedMonth,
      };
    });

    const maxVal = Math.max(...data.map(d => Math.max(d.income, d.expense)), 100);

    return { data, maxVal };
  }, [transactions, selectedMonth, ownerFilter]);

  // Top 3 biggest expenses of the month
  const topExpenses = useMemo(() => {
    return monthTransactions
      .filter(t => t.type === 'expense')
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 3);
  }, [monthTransactions]);

  // SVG Donut calculation
  const donutSegments = useMemo(() => {
    const list = categoryStats.list.slice(0, 6);
    let cumulative = 0;
    return list.map(item => {
      const start = cumulative;
      cumulative += item.percentage;
      return {
        ...item,
        start,
        end: cumulative,
      };
    });
  }, [categoryStats]);

  return (
    <div className="space-y-3.5 pb-6">
      {/* Header & Controls */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <BarChart3 className="w-4 h-4 stroke-[2.25]" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 leading-tight">
                Gráficos & Análises
              </h2>
              <p className="text-[11px] text-slate-500 font-medium">
                {formatMonthName(selectedMonth)}
              </p>
            </div>
          </div>

          {/* Period View Pill Switcher */}
          <div className="flex p-0.5 bg-slate-100 rounded-lg text-xs font-semibold">
            <button
              type="button"
              onClick={() => setPeriodMode('month')}
              className={`px-2.5 py-1 rounded-md transition-all cursor-pointer text-[11px] ${
                periodMode === 'month'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Mês
            </button>
            <button
              type="button"
              onClick={() => setPeriodMode('history')}
              className={`px-2.5 py-1 rounded-md transition-all cursor-pointer text-[11px] ${
                periodMode === 'history'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              6 Meses
            </button>
          </div>
        </div>

        {/* Owner Filter Tabs */}
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 no-scrollbar text-xs">
          <button
            type="button"
            onClick={() => setOwnerFilter('all')}
            className={`px-3 py-1.5 rounded-xl font-medium shrink-0 transition-colors cursor-pointer text-[11px] ${
              ownerFilter === 'all'
                ? 'bg-slate-900 text-white font-semibold shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
            }`}
          >
            Casal Completo
          </button>
          <button
            type="button"
            onClick={() => setOwnerFilter('partner1')}
            className={`px-3 py-1.5 rounded-xl font-medium shrink-0 transition-colors cursor-pointer text-[11px] ${
              ownerFilter === 'partner1'
                ? 'bg-emerald-600 text-white font-semibold shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
            }`}
          >
            {partners.partner1Name}
          </button>
          <button
            type="button"
            onClick={() => setOwnerFilter('partner2')}
            className={`px-3 py-1.5 rounded-xl font-medium shrink-0 transition-colors cursor-pointer text-[11px] ${
              ownerFilter === 'partner2'
                ? 'bg-purple-600 text-white font-semibold shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
            }`}
          >
            {partners.partner2Name}
          </button>
          <button
            type="button"
            onClick={() => setOwnerFilter('shared')}
            className={`px-3 py-1.5 rounded-xl font-medium shrink-0 transition-colors cursor-pointer text-[11px] ${
              ownerFilter === 'shared'
                ? 'bg-sky-600 text-white font-semibold shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
            }`}
          >
            Compartilhado
          </button>
        </div>
      </div>

      {/* Overview Metric Cards */}
      <div className="grid grid-cols-2 gap-2.5">
        {/* Entradas */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span className="font-semibold text-emerald-700 flex items-center gap-1">
              <ArrowDownRight className="w-3.5 h-3.5 text-emerald-600" />
              Receitas
            </span>
            <span className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded-md font-bold">
              + Entradas
            </span>
          </div>
          <div className="text-base font-extrabold text-slate-900 font-mono tabular-nums">
            {formatCurrency(totalIncome)}
          </div>
        </div>

        {/* Saídas */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span className="font-semibold text-rose-700 flex items-center gap-1">
              <ArrowUpRight className="w-3.5 h-3.5 text-rose-600" />
              Despesas
            </span>
            <span className="text-[10px] bg-rose-50 text-rose-700 px-1.5 py-0.5 rounded-md font-bold">
              - Gastos
            </span>
          </div>
          <div className="text-base font-extrabold text-slate-900 font-mono tabular-nums">
            {formatCurrency(totalExpense)}
          </div>
        </div>

        {/* Saldo Líquido */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-3.5 shadow-xs col-span-2 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 block mb-0.5">
              Saldo Líquido ({formatMonthName(selectedMonth).split(' ')[0]})
            </span>
            <span
              className={`text-lg font-black font-mono tabular-nums ${
                netBalance >= 0 ? 'text-emerald-600' : 'text-rose-600'
              }`}
            >
              {netBalance >= 0 ? '+ ' : '- '}
              {formatCurrency(Math.abs(netBalance))}
            </span>
          </div>

          <div className="text-right">
            <span className="text-[10px] font-semibold text-slate-500 block mb-0.5">
              Taxa de Poupança
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-800 text-xs font-bold font-mono">
              <Sparkles className="w-3 h-3 text-emerald-600" />
              {savingsRate}%
            </span>
          </div>
        </div>
      </div>

      {/* 6-Month Comparison Chart (Historical Trend) */}
      {periodMode === 'history' && (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 leading-tight">
                  Evolução dos Últimos 6 Meses
                </h3>
                <span className="text-[10px] text-slate-500">
                  Receitas vs Despesas mês a mês
                </span>
              </div>
            </div>
          </div>

          {/* Chart Bars */}
          <div className="pt-4 pb-1">
            <div className="h-44 flex items-end justify-between gap-2 border-b border-slate-200/80 pb-2 px-1">
              {historicalData.data.map(item => {
                const incHeight = Math.max(4, (item.income / historicalData.maxVal) * 100);
                const expHeight = Math.max(4, (item.expense / historicalData.maxVal) * 100);

                return (
                  <div key={item.month} className="flex-1 flex flex-col items-center gap-1 group">
                    {/* Bars pair */}
                    <div className="w-full flex items-end justify-center gap-1 h-36">
                      {/* Income Bar */}
                      <div className="w-2.5 sm:w-3 flex flex-col items-center relative group/bar">
                        <div
                          className="w-full bg-emerald-500 hover:bg-emerald-400 rounded-t-sm transition-all"
                          style={{ height: `${incHeight}%` }}
                        />
                        <div className="absolute -top-7 opacity-0 group-hover/bar:opacity-100 transition-opacity bg-slate-900 text-white text-[9px] font-mono px-1.5 py-0.5 rounded pointer-events-none whitespace-nowrap z-20 shadow-md">
                          +{formatCurrency(item.income)}
                        </div>
                      </div>

                      {/* Expense Bar */}
                      <div className="w-2.5 sm:w-3 flex flex-col items-center relative group/bar">
                        <div
                          className="w-full bg-rose-500 hover:bg-rose-400 rounded-t-sm transition-all"
                          style={{ height: `${expHeight}%` }}
                        />
                        <div className="absolute -top-7 opacity-0 group-hover/bar:opacity-100 transition-opacity bg-slate-900 text-white text-[9px] font-mono px-1.5 py-0.5 rounded pointer-events-none whitespace-nowrap z-20 shadow-md">
                          -{formatCurrency(item.expense)}
                        </div>
                      </div>
                    </div>

                    {/* Month Label */}
                    <span
                      className={`text-[10px] font-bold ${
                        item.isCurrent ? 'text-emerald-700 underline underline-offset-2' : 'text-slate-500'
                      }`}
                    >
                      {item.label}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center gap-4 pt-3 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="text-slate-600 font-medium text-[11px]">Receitas</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                <span className="text-slate-600 font-medium text-[11px]">Despesas</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Category Donut & Ranking */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <PieChart className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 leading-tight">
                Distribuição por Categoria
              </h3>
              <span className="text-[10px] text-slate-500">
                Detalhamento percentual
              </span>
            </div>
          </div>

          {/* Toggle Type (Expenses vs Incomes) */}
          <div className="flex p-0.5 bg-slate-100 rounded-lg text-xs font-semibold">
            <button
              type="button"
              onClick={() => setChartType('expense')}
              className={`px-2 py-1 rounded-md transition-all cursor-pointer text-[10px] ${
                chartType === 'expense'
                  ? 'bg-rose-500 text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Despesas
            </button>
            <button
              type="button"
              onClick={() => setChartType('income')}
              className={`px-2 py-1 rounded-md transition-all cursor-pointer text-[10px] ${
                chartType === 'income'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Receitas
            </button>
          </div>
        </div>

        {categoryStats.list.length === 0 ? (
          <div className="py-8 text-center text-slate-500 text-xs">
            Nenhuma movimentação registrada nesta categoria neste período.
          </div>
        ) : (
          <div className="space-y-4 pt-1">
            {/* Visual Progress Multi-segment Bar */}
            <div className="w-full h-3 rounded-full bg-slate-100 flex overflow-hidden p-0.5">
              {donutSegments.map(seg => (
                <div
                  key={seg.id}
                  style={{
                    width: `${seg.percentage}%`,
                    backgroundColor: seg.color,
                  }}
                  className="h-full first:rounded-l-full last:rounded-r-full transition-all"
                  title={`${seg.name}: ${seg.percentage.toFixed(1)}%`}
                />
              ))}
            </div>

            {/* Top Categories List */}
            <div className="space-y-2.5">
              {categoryStats.list.map(item => (
                <div key={item.id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800 flex items-center gap-1.5 truncate max-w-[65%]">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="truncate">{item.name}</span>
                      <span className="text-[10px] text-slate-600 font-normal shrink-0">
                        ({item.percentage.toFixed(1)}%)
                      </span>
                    </span>

                    <span className="font-bold text-slate-900 font-mono tabular-nums shrink-0">
                      {formatCurrency(item.amount)}
                    </span>
                  </div>

                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${item.percentage}%`,
                        backgroundColor: item.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Divisão por Responsável (Quem Gastou Mais) */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 leading-tight">
              Gastos por Responsável
            </h3>
            <span className="text-[10px] text-slate-500">
              Divisão das despesas do mês
            </span>
          </div>
        </div>

        {partnerStats.total === 0 ? (
          <div className="py-6 text-center text-slate-500 text-xs">
            Nenhum gasto registrado neste mês.
          </div>
        ) : (
          <div className="space-y-3 pt-1">
            {/* Split Visual Progress */}
            <div className="w-full h-3 rounded-full bg-slate-100 flex overflow-hidden p-0.5">
              <div
                style={{ width: `${partnerStats.partner1.percent}%` }}
                className="bg-emerald-500 h-full first:rounded-l-full last:rounded-r-full transition-all"
                title={`${partners.partner1Name}: ${partnerStats.partner1.percent.toFixed(1)}%`}
              />
              <div
                style={{ width: `${partnerStats.partner2.percent}%` }}
                className="bg-purple-500 h-full first:rounded-l-full last:rounded-r-full transition-all"
                title={`${partners.partner2Name}: ${partnerStats.partner2.percent.toFixed(1)}%`}
              />
              <div
                style={{ width: `${partnerStats.shared.percent}%` }}
                className="bg-sky-500 h-full first:rounded-l-full last:rounded-r-full transition-all"
                title={`Compartilhado: ${partnerStats.shared.percent.toFixed(1)}%`}
              />
            </div>

            <div className="grid grid-cols-3 gap-2 text-center pt-1">
              {/* Partner 1 */}
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex flex-col items-center">
                <span className="w-2 h-2 rounded-full bg-emerald-500 mb-1" />
                <span className="text-[11px] font-bold text-slate-800 truncate max-w-full">
                  {partners.partner1Name}
                </span>
                <span className="text-xs font-extrabold text-slate-900 font-mono mt-0.5">
                  {partnerStats.partner1.percent.toFixed(0)}%
                </span>
                <span className="text-[10px] text-slate-500 font-mono">
                  {formatCurrency(partnerStats.partner1.amount)}
                </span>
              </div>

              {/* Partner 2 */}
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex flex-col items-center">
                <span className="w-2 h-2 rounded-full bg-purple-500 mb-1" />
                <span className="text-[11px] font-bold text-slate-800 truncate max-w-full">
                  {partners.partner2Name}
                </span>
                <span className="text-xs font-extrabold text-slate-900 font-mono mt-0.5">
                  {partnerStats.partner2.percent.toFixed(0)}%
                </span>
                <span className="text-[10px] text-slate-500 font-mono">
                  {formatCurrency(partnerStats.partner2.amount)}
                </span>
              </div>

              {/* Shared */}
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex flex-col items-center">
                <span className="w-2 h-2 rounded-full bg-sky-500 mb-1" />
                <span className="text-[11px] font-bold text-slate-800 truncate max-w-full">
                  Juntos
                </span>
                <span className="text-xs font-extrabold text-slate-900 font-mono mt-0.5">
                  {partnerStats.shared.percent.toFixed(0)}%
                </span>
                <span className="text-[10px] text-slate-500 font-mono">
                  {formatCurrency(partnerStats.shared.amount)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Payment Methods */}
      {paymentStats.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 leading-tight">
                Meios de Pagamento
              </h3>
              <span className="text-[10px] text-slate-500">
                Onde o dinheiro mais saiu
              </span>
            </div>
          </div>

          <div className="space-y-2 pt-1">
            {paymentStats.map(item => (
              <div key={item.method} className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <span>{item.label}</span>
                  <span className="text-[10px] text-slate-600 font-normal">
                    ({item.percent.toFixed(0)}%)
                  </span>
                </span>
                <span className="font-bold text-slate-900 font-mono tabular-nums">
                  {formatCurrency(item.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Destaque: Maiores Gastos do Mês */}
      {topExpenses.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <Flame className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 leading-tight">
                Maiores Despesas do Mês
              </h3>
              <span className="text-[10px] text-slate-500">
                Lançamentos com maior impacto financeiro
              </span>
            </div>
          </div>

          <div className="space-y-2 pt-1">
            {topExpenses.map((tx, idx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between p-2 rounded-xl bg-slate-50/80 border border-slate-100"
              >
                <div className="flex items-center gap-2.5 min-w-0 pr-2">
                  <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <div className="truncate">
                    <span className="text-xs font-semibold text-slate-900 block truncate">
                      {tx.description}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {tx.date} · {tx.owner === 'partner1' ? partners.partner1Name : (tx.owner === 'partner2' ? partners.partner2Name : 'Compartilhado')}
                    </span>
                  </div>
                </div>

                <span className="text-xs font-extrabold text-rose-700 font-mono tabular-nums shrink-0">
                  - {formatCurrency(tx.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
