'use client'

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { formatMoney } from '@/lib/format'

/**
 * Graphiques statistiques (§16).
 *
 * Volontairement sobres : pas d'animation, une seule couleur par série, une
 * légende textuelle systématique. Le cahier des charges est explicite —
 * « rester simple et lisible, ne pas surcharger l'interface ».
 */

export type CategorySlice = {
  name: string
  value: number
  color: string
}

export function CategoryPieChart({
  data,
  currency,
}: {
  data: CategorySlice[]
  currency: string
}) {
  if (data.length === 0) {
    return <EmptyChart message="Aucune dépense catégorisée sur la période." />
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={1}
        >
          {data.map((slice) => (
            <Cell key={slice.name} fill={slice.color} stroke="var(--app-card)" strokeWidth={2} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value) => (typeof value === 'number' ? formatMoney(value, currency) : value)}
          contentStyle={{
            backgroundColor: 'var(--app-card)',
            border: '1px solid var(--app-border)',
            borderRadius: 12,
            color: 'var(--app-foreground)',
          }}
        />
        <Legend
          layout="vertical"
          align="right"
          verticalAlign="middle"
          formatter={(value: string) => <span className="text-sm">{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}

export type MonthlySeriesPoint = {
  month: string
  revenus: number
  depenses: number
}

export function IncomeExpenseBarChart({
  data,
  currency,
}: {
  data: MonthlySeriesPoint[]
  currency: string
}) {
  if (data.every((point) => point.revenus === 0 && point.depenses === 0)) {
    return <EmptyChart message="Aucune opération sur la période." />
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} barGap={4}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--app-border)" vertical={false} />
        <XAxis
          dataKey="month"
          tick={{ fill: 'var(--app-muted-foreground)', fontSize: 12 }}
          axisLine={{ stroke: 'var(--app-border)' }}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: 'var(--app-muted-foreground)', fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          width={64}
          tickFormatter={(value: number) => formatMoney(value, currency, { compact: true })}
        />
        <Tooltip
          formatter={(value) => (typeof value === 'number' ? formatMoney(value, currency) : value)}
          contentStyle={{
            backgroundColor: 'var(--app-card)',
            border: '1px solid var(--app-border)',
            borderRadius: 12,
            color: 'var(--app-foreground)',
          }}
        />
        <Legend formatter={(value: string) => <span className="text-sm">{value}</span>} />
        <Bar dataKey="revenus" name="Revenus" fill="var(--app-income)" radius={[6, 6, 0, 0]} />
        <Bar dataKey="depenses" name="Dépenses" fill="var(--app-expense)" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
      {message}
    </div>
  )
}
