"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { geoBounds, geoCentroid, geoContains, geoDistance, geoOrthographic, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import world from "world-atlas/countries-50m.json";
import { CHINESE_COUNTRY_NAMES, COUNTRY_ALPHA2_CODES } from "./country-names";

type Country = GeoJSON.Feature<GeoJSON.Geometry, { name?: string }> & { id?: string | number };
type Side = "left" | "right" | "none";
type Filter = "all" | "left" | "right";
type PointerPoint = { x: number; y: number };
type LocationStatus = "locating" | "located" | "denied" | "unavailable";

const MIN_ZOOM = .82;
const MAX_ZOOM = 32;
const clampZoom = (value: number) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value));
const pointerDistance = (pointers: Map<number, PointerPoint>) => {
  const [first, second] = Array.from(pointers.values());
  return first && second ? Math.hypot(second.x - first.x, second.y - first.y) : 0;
};

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

const CHINESE_NAME_OVERRIDES: Record<string, string> = {
  "156": "中国大陆",
  "158": "台湾",
  "344": "中国香港",
  "446": "中国澳门",
};

const SPECIAL_CHINESE_NAMES: Record<string, string> = {
  "Somaliland": "索马里兰",
  "Kosovo": "科索沃",
  "N. Cyprus": "北塞浦路斯",
  "Indian Ocean Ter.": "印度洋属地",
  "Siachen Glacier": "锡亚琴冰川",
};

const numericId = (country: Country) => String(country.id ?? "").padStart(3, "0");
const sideFor = (country: Country): Side => numericId(country) === "010" ? "none" : LEFT_DRIVING.has(numericId(country)) ? "left" : "right";
const englishName = (country: Country) => country.properties?.name?.trim() || "Unknown region";
const flagFor = (country: Country) => {
  const alpha2 = COUNTRY_ALPHA2_CODES[numericId(country)];
  return alpha2
    ? String.fromCodePoint(...alpha2.split("").map((letter) => 127397 + letter.charCodeAt(0)))
    : "🏳️";
};
const displayName = (country: Country) => {
  const id = numericId(country);
  const atlasName = englishName(country);
  return CHINESE_NAME_OVERRIDES[id]
    || SPECIAL_CHINESE_NAMES[atlasName]
    || CHINESE_COUNTRY_NAMES[id]
    || "未知地区";
};
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
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [locationStatus, setLocationStatus] = useState<LocationStatus>("locating");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drag = useRef({ x: 0, y: 0, rotation: [-15, -18] as [number, number], moved: false, country: null as Country | null });
  const pointers = useRef(new Map<number, PointerPoint>());
  const pinch = useRef({ distance: 0, zoom: 1 });
  const activeCountry = hovered || selected;

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setLocationStatus("unavailable");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const location: [number, number] = [coords.longitude, coords.latitude];
        setUserLocation(location);
        setRotation([-location[0], -location[1]]);
        setPaused(true);
        setLocationStatus("located");
      },
      (error) => setLocationStatus(error.code === error.PERMISSION_DENIED ? "denied" : "unavailable"),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 300000 },
    );
  }, []);

  useEffect(() => {
    if (locationStatus === "locating" || dragging || paused || selected || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
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
  }, [dragging, paused, selected, locationStatus]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    const physicalSize = Math.round(680 * pixelRatio);
    if (canvas.width !== physicalSize || canvas.height !== physicalSize) {
      canvas.width = physicalSize;
      canvas.height = physicalSize;
    }
    const context = canvas.getContext("2d");
    if (!context) return;

    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, 680, 680);
    const projection = geoOrthographic().translate([340, 340]).scale(314 * zoom).rotate(rotation).clipAngle(90);
    const path = geoPath(projection, context);

    context.save();
    context.beginPath();
    context.arc(340, 340, 326, 0, Math.PI * 2);
    context.strokeStyle = "rgba(85, 220, 196, .08)";
    context.lineWidth = 20;
    context.stroke();

    context.beginPath();
    context.arc(340, 340, 314, 0, Math.PI * 2);
    const ocean = context.createRadialGradient(270, 245, 10, 340, 340, 314);
    ocean.addColorStop(0, "#183b4c");
    ocean.addColorStop(.58, "#0b2231");
    ocean.addColorStop(1, "#06131e");
    context.fillStyle = ocean;
    context.fill();
    context.clip();

    const leftShade = context.createLinearGradient(0, 0, 680, 680);
    leftShade.addColorStop(0, "rgba(3, 40, 45, .58)");
    leftShade.addColorStop(.42, "rgba(7, 24, 32, .1)");
    leftShade.addColorStop(1, "rgba(232, 255, 249, .18)");
    const rightShade = context.createLinearGradient(680, 680, 0, 0);
    rightShade.addColorStop(0, "rgba(53, 20, 7, .52)");
    rightShade.addColorStop(.42, "rgba(32, 17, 11, .09)");
    rightShade.addColorStop(1, "rgba(255, 246, 233, .16)");

    countries.forEach((country) => {
      const side = sideFor(country);
      context.globalAlpha = filter !== "all" && side !== filter ? .09 : 1;
      context.beginPath();
      path(country);
      context.fillStyle = colorFor(country);
      context.fill();
      if (side !== "none") {
        context.fillStyle = side === "left" ? leftShade : rightShade;
        context.fill();
      }
      context.strokeStyle = activeCountry?.id === country.id ? "#effffb" : "rgba(3, 14, 20, .86)";
      context.lineWidth = activeCountry?.id === country.id ? 2.4 : .8;
      context.stroke();
    });
    context.globalAlpha = 1;

    if (userLocation && geoDistance([-rotation[0], -rotation[1]], userLocation) < Math.PI / 2) {
      const marker = projection(userLocation);
      if (marker) {
        const [x, y] = marker;
        context.save();
        context.shadowColor = "rgba(110, 255, 225, .75)";
        context.shadowBlur = 16;
        context.beginPath();
        context.arc(x, y, 12, 0, Math.PI * 2);
        context.fillStyle = "rgba(91, 238, 210, .22)";
        context.fill();
        context.beginPath();
        context.arc(x, y, 5, 0, Math.PI * 2);
        context.fillStyle = "#a8ffe9";
        context.fill();
        context.strokeStyle = "#06171d";
        context.lineWidth = 2;
        context.stroke();
        context.shadowBlur = 0;
        context.font = "600 12px Arial, sans-serif";
        context.textAlign = "center";
        context.fillStyle = "#effffb";
        context.fillText("你在这里", x, y - 19);
        context.restore();
      }
    }
    context.restore();

    context.beginPath();
    context.arc(340, 340, 314, 0, Math.PI * 2);
    context.strokeStyle = "rgba(155, 238, 224, .28)";
    context.lineWidth = 2;
    context.stroke();

  }, [countries, rotation, zoom, filter, activeCountry, userLocation]);

  const counts = useMemo(() => ({
    left: countries.filter((country) => sideFor(country) === "left").length,
    right: countries.filter((country) => sideFor(country) === "right").length,
  }), [countries]);
  const matches = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return [];
    return countries.filter((country) => `${displayName(country)} ${englishName(country)}`.toLowerCase().includes(term)).slice(0, 5);
  }, [countries, query]);

  const countryAtPoint = (canvas: HTMLCanvasElement, clientX: number, clientY: number) => {
    const bounds = canvas.getBoundingClientRect();
    const point: [number, number] = [
      (clientX - bounds.left) * 680 / bounds.width,
      (clientY - bounds.top) * 680 / bounds.height,
    ];
    const projection = geoOrthographic().translate([340, 340]).scale(314 * zoom).rotate(rotation).clipAngle(90);
    const coordinates = projection.invert?.(point);
    if (!coordinates) return null;
    return countries.find((country) => geoContains(country, coordinates)) || null;
  };

  const focusCountry = (country: Country) => {
    const [longitude, latitude] = geoCentroid(country);
    const [[west, south], [east, north]] = geoBounds(country);
    const geographicSpan = Math.max(Math.abs(east - west), Math.abs(north - south), .1);
    const focusZoom = clampZoom(Math.max(1.8, 28 / geographicSpan));
    setSelected(country);
    setHovered(null);
    setRotation([-longitude, -latitude]);
    setZoom(Math.max(zoom, focusZoom));
    setQuery(displayName(country));
  };

  const selectCountry = (country: Country) => {
    setSelected(country);
    setHovered(null);
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

  const endPointer = (canvas: HTMLCanvasElement, pointerId: number, allowTap: boolean) => {
    const tappedCountry = allowTap && pointers.current.size === 1 && !drag.current.moved ? drag.current.country : null;
    pointers.current.delete(pointerId);
    if (canvas.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId);

    if (pointers.current.size >= 2) {
      pinch.current = { distance: Math.max(1, pointerDistance(pointers.current)), zoom };
      return;
    }
    pinch.current.distance = 0;
    if (pointers.current.size === 1) {
      const remaining = Array.from(pointers.current.values())[0];
      drag.current = { x: remaining.x, y: remaining.y, rotation, moved: true, country: null };
      return;
    }
    setDragging(false);
    if (tappedCountry) selectCountry(tappedCountry);
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
                  <span>{displayName(country)}<small>{englishName(country)}</small></span>
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
        <div className={`location-status ${locationStatus}`} role="status">
          {locationStatus === "locating" && "正在请求定位…"}
          {locationStatus === "located" && "📍 已定位 · 当前位置已居中"}
          {locationStatus === "denied" && "定位权限未开启 · 使用默认视角"}
          {locationStatus === "unavailable" && "暂时无法定位 · 使用默认视角"}
        </div>
        <canvas
          ref={canvasRef}
          className={`globe ${dragging ? "is-dragging" : ""}`}
          width={680}
          height={680}
          role="img"
          tabIndex={0}
          aria-label="世界各国靠左或靠右行驶的地球仪，可单指旋转、双指缩放"
          onWheel={(event) => {
            event.preventDefault();
            setZoom((value) => clampZoom(value * Math.exp(-event.deltaY * .0015)));
          }}
          onPointerDown={(event) => {
            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
            pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
            if (pointers.current.size === 1) {
              const country = countryAtPoint(event.currentTarget, event.clientX, event.clientY);
              drag.current = { x: event.clientX, y: event.clientY, rotation, moved: false, country };
              setHovered(country);
            } else if (pointers.current.size === 2) {
              pinch.current = { distance: Math.max(1, pointerDistance(pointers.current)), zoom };
              drag.current.moved = true;
              setHovered(null);
            }
            setDragging(true);
          }}
          onPointerMove={(event) => {
            if (pointers.current.has(event.pointerId)) {
              pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
            }
            if (pointers.current.size >= 2) {
              const distance = pointerDistance(pointers.current);
              if (pinch.current.distance > 0) {
                setZoom(clampZoom(pinch.current.zoom * distance / pinch.current.distance));
              }
              drag.current.moved = true;
              setHovered(null);
              return;
            }
            if (pointers.current.size === 1) {
              const deltaX = event.clientX - drag.current.x;
              const deltaY = event.clientY - drag.current.y;
              if (Math.hypot(deltaX, deltaY) > 3) drag.current.moved = true;
              setHovered(null);
              const dragScale = .25 / Math.max(1, zoom);
              setRotation([
                drag.current.rotation[0] + deltaX * dragScale,
                Math.max(-70, Math.min(70, drag.current.rotation[1] - deltaY * dragScale)),
              ]);
              return;
            }
            setHovered(countryAtPoint(event.currentTarget, event.clientX, event.clientY));
          }}
          onPointerUp={(event) => endPointer(event.currentTarget, event.pointerId, true)}
          onPointerLeave={() => { if (pointers.current.size === 0) setHovered(null); }}
          onPointerCancel={(event) => {
            endPointer(event.currentTarget, event.pointerId, false);
            setHovered(null);
          }}
        />
        <div className="drag-hint"><span>↔</span> 单指旋转 · 双指 / 滚轮缩放</div>
        <div className="globe-controls" aria-label="地球仪控制">
          <button onClick={() => setZoom((value) => clampZoom(value * 1.35))} aria-label="放大">＋</button>
          <button onClick={() => setZoom((value) => clampZoom(value / 1.35))} aria-label="缩小">−</button>
          <button onClick={() => setPaused((value) => !value)} aria-label={paused ? "继续自动旋转" : "暂停自动旋转"}>{paused ? "▶" : "Ⅱ"}</button>
        </div>
      </section>

      <aside className={`detail-card ${activeCountry ? "is-visible" : ""}`} aria-live="polite">
        {activeCountry && (
          <>
            <button className="close-detail" onClick={() => { setSelected(null); setHovered(null); setQuery(""); }} aria-label="关闭国家详情">×</button>
            <div className={`detail-direction ${sideFor(activeCountry)}`}><span>{sideFor(activeCountry) === "left" ? "↖" : "↘"}</span>{sideFor(activeCountry) === "left" ? "左侧通行" : "右侧通行"}</div>
            <h2>{displayName(activeCountry)}</h2>
            <p><span className="detail-flag" aria-hidden="true">{flagFor(activeCountry)}</span>{englishName(activeCountry)}</p>
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

      <div className="stat-card" aria-label="全球道路通行方向数量">
        <div className="stat-item left"><strong>{counts.left}</strong><span>个国家与地区采用左侧通行</span></div>
        <div className="stat-item right"><strong>{counts.right}</strong><span>个国家与地区采用右侧通行</span></div>
      </div>
      <div className="coordinates">{(-rotation[1]).toFixed(1)}° N · {(-rotation[0]).toFixed(1)}° E <span>{paused || selected ? "HOLD" : "LIVE"}</span></div>
      <div className="data-note">边界为示意用途 · 点击图例可筛选</div>
    </main>
  );
}
