import { ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { SERIES } from './metrics.js';
import { aud } from '../lib/util.js';

const axis = { stroke: SERIES.axis, fontSize: 11, tickLine: false, axisLine: false };
const tip = { contentStyle: { borderRadius: 10, border: '1px solid #e4e0d0', fontSize: 12.5, boxShadow: '0 6px 20px rgba(0,0,40,0.08)' }, cursor: { fill: 'rgba(59,59,209,0.06)', stroke: SERIES.s1, strokeWidth: 1 } };
const money = (v) => aud(v, { round: true });
const short = (v) => (Math.abs(v) >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${Math.round(v)}`);

export function BarSeries({ data, x = 'label', y = 'value', name = 'Value', height = 240, layout = 'horizontal' }) {
  if (!data?.length) return <div className="empty small" style={{ padding: 30 }}>No data yet</div>;
  const vertical = layout === 'vertical';
  return (
    <div style={{ height }}>
      <ResponsiveContainer>
        <BarChart data={data} layout={layout} margin={{ top: 6, right: 8, left: vertical ? 10 : -6, bottom: 0 }} barCategoryGap={vertical ? 6 : '22%'}>
          <CartesianGrid stroke={SERIES.grid} vertical={vertical} horizontal={!vertical} />
          {vertical ? <><XAxis type="number" {...axis} tickFormatter={short} /><YAxis type="category" dataKey={x} {...axis} width={110} /></> : <><XAxis dataKey={x} {...axis} minTickGap={16} /><YAxis {...axis} tickFormatter={short} width={48} /></>}
          <Tooltip {...tip} formatter={(v) => [money(v), name]} />
          <Bar isAnimationActive={false} dataKey={y} name={name} fill={SERIES.s1} radius={vertical ? [0, 4, 4, 0] : [4, 4, 0, 0]} maxBarSize={vertical ? 22 : 26} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Two measures on the same $ scale (never dual axis). */
export function TwoLines({ data, a, b, height = 240 }) {
  if (!data?.length) return <div className="empty small" style={{ padding: 30 }}>No data yet</div>;
  return (
    <div style={{ height }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 6, right: 12, left: -6, bottom: 0 }}>
          <CartesianGrid stroke={SERIES.grid} vertical={false} />
          <XAxis dataKey="label" {...axis} minTickGap={18} />
          <YAxis {...axis} tickFormatter={short} width={52} />
          <Tooltip {...tip} formatter={(v, n) => [money(v), n]} />
          <Legend iconType="plainline" wrapperStyle={{ fontSize: 12, color: '#4a4a57' }} />
          <Line isAnimationActive={false} type="monotone" dataKey={a.key} name={a.name} stroke={SERIES.s1} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }} />
          {b && <Line isAnimationActive={false} type="monotone" dataKey={b.key} name={b.name} stroke={SERIES.s2} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }} />}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
