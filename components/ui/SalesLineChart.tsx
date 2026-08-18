'use client';

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { DailySales } from '@/lib/calc';

interface SalesLineChartProps {
  data: DailySales[];
  color?: string;
}

export function SalesLineChart({ data, color = '#2C8598' }: SalesLineChartProps) {
  const formatted = data.map((d) => ({ ...d, label: d.date.slice(8, 10) }));

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={formatted} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
          <CartesianGrid stroke="#2A5860" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" stroke="#6E9294" fontSize={11} tickLine={false} axisLine={false} />
          <YAxis stroke="#6E9294" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip
            contentStyle={{
              background: '#153C43',
              border: '1px solid #2A5860',
              borderRadius: 10,
              color: '#EAF3F2',
              fontSize: 12,
            }}
            labelFormatter={(label, payload) => payload?.[0]?.payload?.date ?? label}
          />
          <Line
            type="monotone"
            dataKey="ventas"
            stroke={color}
            strokeWidth={2.5}
            dot={{ r: 2, fill: color }}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
