'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface SellerBarChartProps {
  data: { name: string; value: number }[];
  color?: string;
}

export function SellerBarChart({ data, color = '#2C8598' }: SellerBarChartProps) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
          <CartesianGrid stroke="#2A5860" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" stroke="#6E9294" fontSize={11} tickLine={false} axisLine={false} />
          <YAxis stroke="#6E9294" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip
            contentStyle={{
              background: '#153C43',
              border: '1px solid #2A5860',
              borderRadius: 10,
              color: '#EAF3F2',
              fontSize: 12,
            }}
            cursor={{ fill: '#2A586033' }}
          />
          <Bar dataKey="value" fill={color} radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
