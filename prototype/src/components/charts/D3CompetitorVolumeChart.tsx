import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { COMPETITOR_CARGO_METRICS } from '../../data/mockData';
import { CompetitorCargoMetric } from '../../types';
import { BarChart3, TrendingUp, Zap, Clock, ShieldCheck, DollarSign } from 'lucide-react';

type MetricKey = 'monthlyTeuVolume' | 'smeMarketSharePct' | 'avgDeploymentDays' | 'monthlyCostAed' | 'uaeComplianceScore';

interface MetricOption {
  key: MetricKey;
  label: string;
  unit: string;
  icon: React.ReactNode;
  description: string;
  isHigherBetter: boolean;
}

const METRICS: MetricOption[] = [
  {
    key: 'monthlyTeuVolume',
    label: 'UAE Monthly Cargo Volume',
    unit: ' TEUs / mo',
    icon: <BarChart3 className="h-4 w-4" />,
    description: 'Actual container volume processed monthly through each platform in UAE ports (Jebel Ali, Khalifa, Port Rashid).',
    isHigherBetter: true,
  },
  {
    key: 'smeMarketSharePct',
    label: 'UAE SME Market Share',
    unit: '%',
    icon: <TrendingUp className="h-4 w-4" />,
    description: 'Percentage of UAE small-to-midsize freight forwarders running daily operations on the system.',
    isHigherBetter: true,
  },
  {
    key: 'avgDeploymentDays',
    label: 'Deployment & Setup Speed',
    unit: ' Days',
    icon: <Clock className="h-4 w-4" />,
    description: 'Calendar days required from initial signup to booking, tracking and billing a real live shipment.',
    isHigherBetter: false, // lower days is better
  },
  {
    key: 'monthlyCostAed',
    label: 'Software Cost (10 Users)',
    unit: ' AED/mo',
    icon: <DollarSign className="h-4 w-4" />,
    description: 'Total monthly subscription cost for a 10-person forwarding agency including all regulatory modules.',
    isHigherBetter: false, // lower cost is better
  },
  {
    key: 'uaeComplianceScore',
    label: 'UAE Compliance Readiness',
    unit: '%',
    icon: <ShieldCheck className="h-4 w-4" />,
    description: 'Audit score based on native 5% UAE VAT, accredited FTA eInvoicing ASP, and MOHRE WPS SIF payroll integration.',
    isHigherBetter: true,
  },
];

export const D3CompetitorVolumeChart: React.FC = () => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [activeMetricKey, setActiveMetricKey] = useState<MetricKey>('monthlyTeuVolume');
  const [hoveredData, setHoveredData] = useState<CompetitorCargoMetric | null>(null);

  const activeMetric = METRICS.find((m) => m.key === activeMetricKey) || METRICS[0];

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const containerWidth = containerRef.current.clientWidth || 700;
    const width = Math.max(containerWidth, 600);
    const height = 360;
    const margin = { top: 30, right: 30, bottom: 90, left: 70 };

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    svg
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('width', '100%')
      .attr('height', height);

    // Data sorted for clean comparison
    const data = [...COMPETITOR_CARGO_METRICS].sort((a, b) => {
      // Keep DigitalBurj visible or sort by value
      return (b[activeMetricKey] as number) - (a[activeMetricKey] as number);
    });

    // Scales
    const x = d3
      .scaleBand()
      .domain(data.map((d) => d.competitorName))
      .range([margin.left, width - margin.right])
      .padding(0.32);

    const yMax = d3.max(data, (d) => d[activeMetricKey] as number) || 100;
    const y = d3
      .scaleLinear()
      .domain([0, yMax * 1.15])
      .nice()
      .range([height - margin.bottom, margin.top]);

    // Grid lines
    svg
      .append('g')
      .attr('class', 'grid')
      .attr('transform', `translate(${margin.left},0)`)
      .call(
        d3
          .axisLeft(y)
          .ticks(5)
          .tickSize(-(width - margin.left - margin.right))
          .tickFormat(() => '')
      )
      .call((g) => g.select('.domain').remove())
      .call((g) => g.selectAll('.tick line').attr('stroke', '#E2E8F0').attr('stroke-dasharray', '3,3'));

    // X Axis with angled labels
    const xAxis = svg
      .append('g')
      .attr('transform', `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x).tickSizeOuter(0));

    xAxis.select('.domain').attr('stroke', '#CBD5E1');

    xAxis
      .selectAll('text')
      .attr('transform', 'rotate(-32)')
      .style('text-anchor', 'end')
      .attr('dx', '-0.6em')
      .attr('dy', '0.6em')
      .style('font-size', '10.5px')
      .style('font-family', 'sans-serif')
      .style('font-weight', (d) => (d === 'DigitalBurj Logistics OS' ? '800' : '500'))
      .style('fill', (d) => (d === 'DigitalBurj Logistics OS' ? '#E8472B' : '#475569'));

    // Y Axis
    const yAxis = svg
      .append('g')
      .attr('transform', `translate(${margin.left},0)`)
      .call(
        d3
          .axisLeft(y)
          .ticks(5)
          .tickFormat((d) => {
            const num = Number(d);
            if (activeMetricKey === 'monthlyTeuVolume') return `${(num / 1000).toFixed(0)}k`;
            if (activeMetricKey === 'monthlyCostAed') return `${(num / 1000).toFixed(0)}k`;
            return `${num}`;
          })
      );

    yAxis.select('.domain').attr('stroke', '#CBD5E1');
    yAxis.selectAll('text').style('font-size', '10px').style('fill', '#64748B');

    // Gradient definitions
    const defs = svg.append('defs');
    const dbGradient = defs
      .append('linearGradient')
      .attr('id', 'db-orange-grad')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');

    dbGradient.append('stop').attr('offset', '0%').attr('stop-color', '#F05A3E');
    dbGradient.append('stop').attr('offset', '100%').attr('stop-color', '#E8472B');

    // Bars
    const bars = svg
      .append('g')
      .selectAll('rect')
      .data(data)
      .enter()
      .append('rect')
      .attr('x', (d) => x(d.competitorName) || 0)
      .attr('width', x.bandwidth())
      .attr('y', height - margin.bottom)
      .attr('height', 0)
      .attr('rx', 6)
      .attr('fill', (d) => (d.highlight ? 'url(#db-orange-grad)' : d.color))
      .attr('opacity', (d) => (d.highlight ? 1 : 0.82))
      .attr('stroke', (d) => (d.highlight ? '#B91C1C' : 'transparent'))
      .attr('stroke-width', (d) => (d.highlight ? 1.5 : 0))
      .style('cursor', 'pointer');

    // Animation
    bars
      .transition()
      .duration(750)
      .ease(d3.easeCubicOut)
      .attr('y', (d) => y(d[activeMetricKey] as number))
      .attr('height', (d) => height - margin.bottom - y(d[activeMetricKey] as number));

    // Value Labels on top of bars
    svg
      .append('g')
      .selectAll('text')
      .data(data)
      .enter()
      .append('text')
      .attr('x', (d) => (x(d.competitorName) || 0) + x.bandwidth() / 2)
      .attr('y', (d) => y(d[activeMetricKey] as number) - 7)
      .attr('text-anchor', 'middle')
      .style('font-size', '10px')
      .style('font-weight', (d) => (d.highlight ? '800' : '600'))
      .style('fill', (d) => (d.highlight ? '#E8472B' : '#64748B'))
      .text((d) => {
        const val = d[activeMetricKey] as number;
        if (activeMetricKey === 'monthlyCostAed') return `AED ${val.toLocaleString()}`;
        if (activeMetricKey === 'smeMarketSharePct' || activeMetricKey === 'uaeComplianceScore') return `${val}%`;
        if (activeMetricKey === 'avgDeploymentDays') return `${val}d`;
        return `${val.toLocaleString()}`;
      });

    // Mouse events
    bars
      .on('mouseenter', function (event, d) {
        d3.select(this).attr('opacity', 1).attr('stroke', '#0F172A').attr('stroke-width', 2);
        setHoveredData(d);
      })
      .on('mouseleave', function (event, d) {
        d3.select(this)
          .attr('opacity', d.highlight ? 1 : 0.82)
          .attr('stroke', d.highlight ? '#B91C1C' : 'transparent')
          .attr('stroke-width', d.highlight ? 1.5 : 0);
      });
  }, [activeMetricKey]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
      {/* Panel Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#E8472B]/10 text-[#E8472B]">
              <BarChart3 className="h-3.5 w-3.5" />
            </span>
            <h3 className="font-extrabold text-slate-900 text-sm md:text-base">
              Interactive D3 Competitor Benchmark & Cargo Share
            </h3>
            <span className="rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5">
              Live D3.js Engine
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Compare DigitalBurj's real-time cargo volume and efficiency metrics against incumbent solutions.
          </p>
        </div>

        {/* Metric Switcher Tabs */}
        <div className="flex flex-wrap gap-1.5 bg-slate-100 p-1 rounded-xl text-xs">
          {METRICS.map((m) => (
            <button
              key={m.key}
              onClick={() => setActiveMetricKey(m.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition text-xs ${
                activeMetricKey === m.key
                  ? 'bg-white text-slate-950 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {m.icon}
              <span>{m.label.split(' ')[0]} {m.label.split(' ')[1]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Metric Context Sub-Bar */}
      <div className="flex flex-wrap items-center justify-between bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs gap-2">
        <div className="flex items-center gap-2 text-slate-700">
          <span className="font-bold text-slate-900">{activeMetric.label}:</span>
          <span>{activeMetric.description}</span>
        </div>
        <div className="text-[11px] font-semibold text-slate-500">
          Unit: <span className="font-mono text-slate-900 font-bold">{activeMetric.unit}</span>
        </div>
      </div>

      {/* D3 SVG Canvas */}
      <div ref={containerRef} className="w-full relative min-h-[360px] overflow-hidden">
        <svg ref={svgRef} className="w-full h-auto block select-none" />

        {/* Hover Tooltip Card */}
        {hoveredData && (
          <div className="absolute top-2 right-4 rounded-xl border border-slate-200 bg-white/95 backdrop-blur-xs p-3 shadow-lg text-xs space-y-1 z-20 pointer-events-none animate-in fade-in duration-100">
            <div className="flex items-center gap-1.5 font-bold text-slate-900">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: hoveredData.color }} />
              <span>{hoveredData.competitorName}</span>
            </div>
            <div className="text-slate-600 text-[11px]">
              {activeMetric.label}:{' '}
              <strong className="text-slate-950 font-mono">
                {activeMetricKey === 'monthlyCostAed'
                  ? `AED ${hoveredData[activeMetricKey].toLocaleString()}`
                  : `${hoveredData[activeMetricKey].toLocaleString()}${activeMetric.unit}`}
              </strong>
            </div>
            <div className="text-[10px] text-slate-400">
              SME Market Share: {hoveredData.smeMarketSharePct}% · Compliance: {hoveredData.uaeComplianceScore}%
            </div>
          </div>
        )}
      </div>

      {/* D3 Data Takeaway Card */}
      <div className="rounded-xl border border-[#E8472B]/30 bg-gradient-to-r from-[#E8472B]/5 via-amber-500/5 to-transparent p-3.5 text-xs text-slate-800 flex items-start gap-3">
        <Zap className="h-4 w-4 text-[#E8472B] shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong className="text-slate-950">Key Competitive Takeaway:</strong> While enterprise systems like CargoWise handle larger historical volumes, DigitalBurj delivers{' '}
          <strong>1-day self-serve onboarding</strong> (vs 240 days), <strong>AED 1,198/mo transparent pricing</strong> (vs AED 14,500/mo), and a{' '}
          <strong>100% UAE compliance readiness score</strong> with native MOHRE WPS SIF payroll and FTA eInvoicing ASP.
        </div>
      </div>
    </div>
  );
};
