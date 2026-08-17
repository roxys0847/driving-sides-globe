"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { geoCentroid, geoOrthographic, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import world from "world-atlas/countries-50m.json";

type Country = GeoJSON.Feature<GeoJSON.Geometry, { name?: string }> & { id?: string | number };
type Side = "left" | "right" | "none";
type Filter = "all" | "left" | "right";

const LEFT_DRIVING = new Set([
  "028", "036", "044", "050", "052", "060", "064", "072", "086", "090",
  "092", "096", "136", "144", "162", "166", "184", "196", "212", "238",
  "239", "242", "296", "308", "328", "344", "356", "360", "372", "388",
  "392", "404", "426", "446", "454", "458", "462", "470", "480", "500",
  "508", "516", "520", "524", "548", "554", "570", "574", "586", "598",
  "612", "626", "654", "659", "660", "662", "670", "690", "702", "710",
  "716", "740", "748", "764", "772", "776", "780", "796", "798", "800",
  "826", "831", "832", "833", "834", "850", "882", "894",
]);

const CHINESE_NAMES: Record<string, string> = {
  "036": "澳大利亚", "050": "孟加拉国", "124": "加拿大", "156": "中国", "196": "塞浦路斯",
  "250": "法国", "276": "德国", "344": "中国香港", "356": "印度", "360": "印度尼西亚",
  "372": "爱尔兰", "380": "意大利", "392": "日本", "404": "肯尼亚", "446": "中国澳门",
  "458": "马来西亚", "484": "墨西哥", "554": "新西兰", "586": "巴基斯坦", "643": "俄罗斯",
  "702": "新加坡", "710": "南非", "724": "西班牙", "764": "泰国", "792": "土耳其",
  "826": "英国", "840": "美国", "704": "越南", "076": "巴西", "032": "阿根廷",
};

const numericId = (country: Country) => String(country.id ?? "").padStart(3, "0");
const sideFor = (country: Country): Side => numericId(country) === "010" ? "none" : LEFT_DRIVING.has(numericId(country)) ? "left" : "right";
const displayName = (country: Country) => CHINESE_NAMES[numericId(country)] || country.properties?.name || "未知地区";
const colorFor = (country: Country) => {
  const id = Number(country.id ?? 0);
  if (sideFor(country) === "none") return "#39484d";
  return sideFor(country) === "left"
    ? `hsl(${174 + (id % 47)} 62% ${42 + (id % 13)}%)`
    : `hsl(${4 + (id % 43)} 72% ${49 + (id % 12)}%)`;
};

export default function Home() {
  const countries = useMemo(() => {
    const collection = feature(world as never, (world as never as { objects: { countries: never } }).objects.countries);
    return (collection as GeoJSON.FeatureCollection).features as Country[];
  }, []);
  const [rotation, setRotation] = useState<[number, number]>([-15, -18]);
  const [zoom, setZoom] = useState(1);
  const [dragging, setDragging] = useState(false);
  const [paused, setPaused] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<Country | null>(null);
  const [hovered, setHovered] = useState<Country | null>(null);
  const [query, setQuery] = useState("");
  const drag = useRef({ x: 0, y: 0, rotation: [-15, -18] as [number, number] });

  useEffect(() => {
    if (dragging || paused || selected || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    let previous = performance.now();
    const tick = (now: number) => {
      const elapsed = Math.min(now - previous, 40);
      previous = now;
      setRotation(([x, y]) => [x + elapsed * 0.0024, y]);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [dragging, paused, selected]);

  const projection = geoOrthographic().translate([340, 340]).scale(314 * zoom).rotate(rotation).clipAngle(90);
  const path = geoPath(projection);
  const activeCountry = hovered || selected;
  const counts = useMemo(() => ({
    left: countries.filter((country) => sideFor(country) === "left").length,
    right: countries.filter((country) => sideFor(country) === "right").length,
  }), [countries]);
  const matches = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return [];
    return countries.filter((country) => `${displayName(country)} ${country.properties?.name ?? ""}`.toLowerCase().includes(term)).slice(0, 5);
  }, [countries, query]);

  const focusCountry = (country: Country) => {
    const [longitude, latitude] = geoCentroid(country);
    setSelected(country);
    setHovered(null);
    setRotation([-longitude, -latitude]);
    setZoom(Math.max(zoom, 1.08));
    setQuery(displayName(country));
  };

  const resetView = () => {
    setSelected(null);
    setHovered(null);
    setQuery("");
    setRotation([-15, -18]);
    setZoom(1);
    setFilter("all");
    setPaused(false);
  };

  return (
    <main className="site-shell">
      <header className="topbar">
        <button className="brand" onClick={resetView} aria-label="返回全球视图"><span className="brand-mark">↙</span> DRIVING SIDES</button>
        <div className="search-wrap">
          <span aria-hidden="true">⌕</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter" && matches[0]) focusCountry(matches[0]); }}
            placeholder="搜索国家或地区"
            aria-label="搜索国家或地区"
            aria-expanded={matches.length > 0}
          />
          {matches.length > 0 && query !== displayName(selected || ({} as Country)) && (
            <div className="search-results">
              {matches.map((country) => (
                <button key={country.id} onClick={() => focusCountry(country)}>
                  <span className={`result-dot ${sideFor(country)}`} />
                  <span>{displayName(country)}<small>{country.properties?.name}</small></span>
                  <b>{sideFor(country) === "left" ? "左行 ↖" : "右行 ↘"}</b>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="top-note">全球道路通行方向图谱 <span>·</span> 互动地球仪</div>
      </header>

      <section className="hero-copy">
        <p className="eyebrow">LEFT OR RIGHT?</p>
        <h1>世界，沿着哪一侧前行？</h1>
        <p>拖动地球，看看各个国家与地区的车流方向。色彩区分国家，阴影方向标记通行侧。</p>
      </section>

      <section className="globe-stage" aria-label="可旋转的全球道路通行方向地图">
        <div className="orbit orbit-one" />
        <div className="orbit orbit-two" />
        <div className="globe-ground-shadow" />
        <svg
          className={`globe ${dragging ? "is-dragging" : ""}`}
          viewBox="0 0 680 680"
          role="img"
          aria-label="世界各国靠左或靠右行驶的地球仪"
          onWheel={(event) => { event.preventDefault(); setZoom((value) => Math.max(.82, Math.min(1.58, value - event.deltaY * .0008))); }}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            drag.current = { x: event.clientX, y: event.clientY, rotation };
            setDragging(true);
          }}
          onPointerMove={(event) => {
            if (!dragging) return;
            setRotation([
              drag.current.rotation[0] + (event.clientX - drag.current.x) * 0.25,
              Math.max(-70, Math.min(70, drag.current.rotation[1] - (event.clientY - drag.current.y) * 0.22)),
            ]);
          }}
          onPointerUp={() => setDragging(false)}
          onPointerCancel={() => setDragging(false)}
        >
          <defs>
            <radialGradient id="ocean" cx="35%" cy="28%"><stop offset="0" stopColor="#183b4c" /><stop offset=".58" stopColor="#0b2231" /><stop offset="1" stopColor="#06131e" /></radialGradient>
            <linearGradient id="shade-left" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="680" y2="680">
              <stop offset="0" stopColor="#03282d" stopOpacity=".58" />
              <stop offset=".38" stopColor="#071820" stopOpacity=".12" />
              <stop offset=".72" stopColor="#cffff5" stopOpacity=".08" />
              <stop offset="1" stopColor="#e8fff9" stopOpacity=".2" />
            </linearGradient>
            <linearGradient id="shade-right" gradientUnits="userSpaceOnUse" x1="680" y1="680" x2="0" y2="0">
              <stop offset="0" stopColor="#351407" stopOpacity=".52" />
              <stop offset=".38" stopColor="#20110b" stopOpacity=".1" />
              <stop offset=".72" stopColor="#fff0d8" stopOpacity=".08" />
              <stop offset="1" stopColor="#fff6e9" stopOpacity=".18" />
            </linearGradient>
            <clipPath id="sphere-clip"><circle cx="340" cy="340" r="314" /></clipPath>
          </defs>
          <circle className="globe-halo" cx="340" cy="340" r="326" />
          <circle cx="340" cy="340" r="314" fill="url(#ocean)" />
          <g clipPath="url(#sphere-clip)">
            {countries.map((country) => {
              const d = path(country);
              if (!d) return null;
              const side = sideFor(country);
              const dimmed = filter !== "all" && side !== filter;
              const active = activeCountry?.id === country.id;
              return (
                <g key={country.id} className={`country-group ${dimmed ? "is-dimmed" : ""}`}>
                  <path
                    d={d}
                    fill={colorFor(country)}
                    className={`country ${active ? "is-active" : ""}`}
                    onPointerEnter={() => { if (!dragging) setHovered(country); }}
                    onPointerLeave={() => setHovered(null)}
                    onClick={(event) => { event.stopPropagation(); if (!dragging) focusCountry(country); }}
                    role="button"
                    aria-label={`${displayName(country)}，${side === "left" ? "左侧通行" : side === "right" ? "右侧通行" : "无常规道路数据"}`}
                  />
                  {side !== "none" && <path d={d} fill={`url(#shade-${side})`} className="country-shade" aria-hidden="true" />}
                </g>
              );
            })}
          </g>
          <circle className="globe-rim" cx="340" cy="340" r="314" />
          <ellipse className="globe-glint" cx="265" cy="228" rx="168" ry="206" />
        </svg>
        <div className="drag-hint"><span>↔</span> 拖动旋转 · 滚轮缩放</div>
        <div className="globe-controls" aria-label="地球仪控制">
          <button onClick={() => setZoom((value) => Math.min(1.58, value + .12))} aria-label="放大">＋</button>
          <button onClick={() => setZoom((value) => Math.max(.82, value - .12))} aria-label="缩小">−</button>
          <button onClick={() => setPaused((value) => !value)} aria-label={paused ? "继续自动旋转" : "暂停自动旋转"}>{paused ? "▶" : "Ⅱ"}</button>
        </div>
      </section>

      <aside className={`detail-card ${activeCountry ? "is-visible" : ""}`} aria-live="polite">
        {activeCountry && (
          <>
            <button className="close-detail" onClick={() => { setSelected(null); setHovered(null); setQuery(""); }} aria-label="关闭国家详情">×</button>
            <div className={`detail-direction ${sideFor(activeCountry)}`}><span>{sideFor(activeCountry) === "left" ? "↖" : "↘"}</span>{sideFor(activeCountry) === "left" ? "左侧通行" : "右侧通行"}</div>
            <h2>{displayName(activeCountry)}</h2>
            <p>{activeCountry.properties?.name}</p>
            <div className="mini-road"><i /><span>车辆沿道路{sideFor(activeCountry) === "left" ? "左侧" : "右侧"}行驶</span><i /></div>
            <small>点击国家可锁定视角，拖动地球继续探索。</small>
          </>
        )}
      </aside>

      <aside className="legend" aria-label="地图图例">
        <div className="legend-title">通行方向</div>
        <button className={`legend-item ${filter === "left" ? "active" : ""}`} onClick={() => setFilter(filter === "left" ? "all" : "left")} aria-pressed={filter === "left"}>
          <span className="swatch left-swatch" /><span><strong>左侧通行</strong><small>{counts.left} 个地图区域 · 阴影向左上 ↖</small></span>
        </button>
        <button className={`legend-item ${filter === "right" ? "active" : ""}`} onClick={() => setFilter(filter === "right" ? "all" : "right")} aria-pressed={filter === "right"}>
          <span className="swatch right-swatch" /><span><strong>右侧通行</strong><small>{counts.right} 个地图区域 · 阴影向右下 ↘</small></span>
        </button>
      </aside>

      <div className="stat-card"><strong>{counts.left}</strong><span>个可见国家与地区采用左侧通行</span></div>
      <div className="coordinates">{(-rotation[1]).toFixed(1)}° N · {(-rotation[0]).toFixed(1)}° E <span>{paused || selected ? "HOLD" : "LIVE"}</span></div>
      <div className="data-note">边界为示意用途 · 点击图例可筛选</div>
    </main>
  );
}
