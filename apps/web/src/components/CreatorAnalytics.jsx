import React, { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { getAiInsights, getCreatorAnalytics } from '../lib/api.js';
import './CreatorAnalytics.css';

const fallback = {
  totalViewers: 0,
  watchHours: 0,
  engagementRate: 0,
  demographics: [{ name: 'North America', viewers: 42 }, { name: 'Europe', viewers: 28 }, { name: 'Asia', viewers: 21 }, { name: 'Other', viewers: 9 }],
  devices: [{ name: 'Mobile', viewers: 61 }, { name: 'Desktop', viewers: 31 }, { name: 'TV', viewers: 8 }],
  engagementHeatmap: [],
  revenue: { subscriptions: 0, gifts: 0, bids: 0, payouts: 0 },
};
const colors = ['#d9f85a', '#8bd7cf', '#f19a5c', '#ef6c50'];

function buildAiSuggestions(analytics) {
  const suggestions = [];
  const revenue = analytics.revenue || {};
  const mobileShare = analytics.devices?.find((device) => device.name === 'Mobile')?.viewers ?? 0;
  const topRegion = [...(analytics.demographics || [])].sort((a, b) => Number(b.viewers) - Number(a.viewers))[0];

  if ((analytics.engagementRate || 0) < 18) {
    suggestions.push({
      title: 'Shorten the opening',
      detail: 'Your engagement is lagging early, so tightening the first 20 seconds could help more viewers stay for the full session.',
    });
  }

  if (mobileShare >= 55) {
    suggestions.push({
      title: 'Lean into mobile-first moments',
      detail: 'Most of your audience is on mobile, so bold captions, short prompts, and quick calls to action should perform better.',
    });
  }

  if ((revenue.gifts || 0) > (revenue.subscriptions || 0)) {
    suggestions.push({
      title: 'Double down on gift moments',
      detail: 'Gifts are outperforming subscriptions right now. Consider a light challenge or milestone moment to trigger more participation.',
    });
  }

  if (topRegion) {
    suggestions.push({
      title: `Tailor your next promo to ${topRegion.name}`,
      detail: `${topRegion.name} is driving the biggest audience share. Local language or region-specific themes may lift conversions next time.`,
    });
  }

  if (suggestions.length === 0) {
    suggestions.push({
      title: 'Keep the momentum going',
      detail: 'Your room is healthy right now. Maintain your current format and test one fresh hook during the next session.',
    });
  }

  return suggestions.slice(0, 3);
}

export function CreatorAnalytics() {
  const [analytics, setAnalytics] = useState(fallback);
  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    getCreatorAnalytics()
      .then((data) => {
        const merged = { ...fallback, ...data };
        setAnalytics(merged);
        return merged;
      })
      .then((merged) => getAiInsights(merged).catch(() => ({ suggestions: buildAiSuggestions(merged), source: 'heuristic' })))
      .then((insights) => { setAiSuggestions(insights.suggestions || buildAiSuggestions(analytics)); setStatus('ready'); })
      .catch((error) => { console.error('[Vexoryl] analytics load failed', error); setStatus('sample'); setAiSuggestions(buildAiSuggestions(fallback)); });
    return undefined;
  }, []);

  const revenueData = Object.entries(analytics.revenue || {}).filter(([name]) => name !== 'payouts').map(([name, value]) => ({ name, value }));

  return (
    <section className="creator-analytics" aria-label="Creator analytics">
      <div className="analytics-heading"><div><p className="eyebrow">Creator insights</p><h2>Know what moves the room.</h2></div><span className={`analytics-status ${status}`}>{status === 'loading' ? 'Loading' : status === 'error' ? 'Unavailable' : status === 'sample' ? 'Sample view' : 'Live data'}</span></div>
      <div className="analytics-metrics"><div><small>Viewers</small><strong>{analytics.totalViewers.toLocaleString()}</strong></div><div><small>Watch hours</small><strong>{analytics.watchHours.toLocaleString()}</strong></div><div><small>Engagement</small><strong>{analytics.engagementRate}%</strong></div></div>

      <div className="ai-panel" aria-label="AI suggestions">
        <div className="ai-panel-header">
          <p className="eyebrow">AI suggestions</p>
          <span className="ai-pill">Live</span>
        </div>
        <div className="ai-suggestions">
          {aiSuggestions.map((item) => (
            <article className="ai-card" key={item.title}>
              <h3>{item.title}</h3>
              <p>{item.detail}</p>
            </article>
          ))}
        </div>
      </div>

      <div className="analytics-grid">
        <div className="analytics-card"><h3>Viewer regions</h3><ResponsiveContainer width="100%" height={210}><BarChart data={analytics.demographics}><CartesianGrid stroke="#2a3430" vertical={false} /><XAxis dataKey="name" tick={{ fill: '#9aa59d', fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis hide /><Tooltip contentStyle={{ background: '#17201d', border: '1px solid #2a3430', color: '#f5f3eb' }} /><Bar dataKey="viewers" fill="#d9f85a" radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer></div>
        <div className="analytics-card"><h3>Devices</h3><ResponsiveContainer width="100%" height={210}><PieChart><Pie data={analytics.devices} dataKey="viewers" nameKey="name" innerRadius={52} outerRadius={78} paddingAngle={3}>{analytics.devices.map((entry, index) => <Cell key={entry.name} fill={colors[index % colors.length]} />)}</Pie><Tooltip contentStyle={{ background: '#17201d', border: '1px solid #2a3430', color: '#f5f3eb' }} /></PieChart></ResponsiveContainer><div className="chart-legend">{analytics.devices.map((entry, index) => <span key={entry.name}><i style={{ background: colors[index % colors.length] }} />{entry.name} {entry.viewers}%</span>)}</div></div>
        <div className="analytics-card analytics-wide"><h3>Engagement heatmap</h3><ResponsiveContainer width="100%" height={220}><LineChart data={analytics.engagementHeatmap}><CartesianGrid stroke="#2a3430" vertical={false} /><XAxis dataKey="hour" tick={{ fill: '#9aa59d', fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis hide /><Tooltip contentStyle={{ background: '#17201d', border: '1px solid #2a3430', color: '#f5f3eb' }} /><Line type="monotone" dataKey="chat" stroke="#8bd7cf" strokeWidth={2} dot={false} /><Line type="monotone" dataKey="director" stroke="#f19a5c" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer><div className="chart-legend"><span><i style={{ background: '#8bd7cf' }} />Chat</span><span><i style={{ background: '#f19a5c' }} />Director triggers</span></div></div>
        <div className="analytics-card analytics-wide"><h3>Stream duration trends</h3><ResponsiveContainer width="100%" height={180}><BarChart data={analytics.streamDurationTrends || []}><CartesianGrid stroke="#2a3430" vertical={false} /><XAxis dataKey="stream" tick={{ fill: '#9aa59d', fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis hide /><Tooltip contentStyle={{ background: '#17201d', border: '1px solid #2a3430', color: '#f5f3eb' }} /><Bar dataKey="minutes" fill="#f19a5c" radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer></div>
        <div className="analytics-card analytics-revenue"><h3>Revenue breakdown</h3>{revenueData.map(({ name, value }) => <div className="revenue-row" key={name}><span>{name}</span><strong>${Number(value).toLocaleString()}</strong></div>)}<div className="revenue-row payout"><span>Payouts</span><strong>-${Number(analytics.revenue?.payouts || 0).toLocaleString()}</strong></div></div>
      </div>
    </section>
  );
}

export default CreatorAnalytics;
