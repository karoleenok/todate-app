import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ROUTES, placeThumb } from './data';
import { ROUTE_GEO } from './routeGeo';

/* Минималистичная карта центра Петербурга на реальных улицах.
   Данные лежат в public/map/spb.json: дороги, вода и парки из OpenStreetMap (ODbL),
   нарезаны из векторных тайлов OpenFreeMap. Внешние сервисы карт не подключены,
   поэтому карта открывается и без доступа к зарубежным серверам. */

interface MapData {
  bbox: { s: number; n: number; w: number; e: number };
  water: number[][][][];
  waterway: number[][][];
  parks: number[][][][];
  major: number[][][];
  mid: number[][][];
  minor: number[][][];
}

let dataPromise: Promise<MapData> | null = null;
const loadMapData = () =>
  (dataPromise ??= fetch('./map/spb.json').then((r) => {
    if (!r.ok) throw new Error('map data');
    return r.json() as Promise<MapData>;
  }));

const flip = (c: number[]): L.LatLngTuple => [c[1], c[0]];
const flipLine = (line: number[][]) => line.map(flip);
const flipPoly = (poly: number[][][]) => poly.map(flipLine);

export type PickPoint = { lat: number; lng: number } | null;

export interface StreetMapProps {
  /** pick — режим админки: клик по карте ставит точку */
  mode: 'overview' | 'route' | 'pick';
  pickPoints?: PickPoint[];
  pickActive?: number;
  onPick?: (lat: number, lng: number) => void;
  routeId?: string;
  active?: number;
  onSelectPoint?: (i: number) => void;
  onSelectRoute?: (id: string) => void;
  height: number;
}

const pinIcon = (label: string, cls: string, size: number, photo?: string) =>
  L.divIcon({
    className: '',
    html: photo
      ? `<div class="map-pin photo ${cls}" style="width:${size}px;height:${size}px;background-image:url('${placeThumb(photo)}')"><span class="pin-num">${label}</span></div>`
      : `<div class="map-pin ${cls}">${label}</div>`,
    iconSize: [size, size], iconAnchor: [size / 2, size / 2],
  });
const photoOf = (routeId: string | undefined, i: number) => {
  const r = ROUTES.find((x) => x.id === routeId);
  const pt = r?.points[i];
  return pt?.photos?.[0] ?? pt?.photo;
};

export default function StreetMap({ mode, routeId, active = 0, onSelectPoint, onSelectRoute, height, pickPoints, pickActive = 0, onPick }: StreetMapProps) {
  const host = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const firstActive = useRef(true);
  const cbRef = useRef<{ onSelectPoint?: (i: number) => void; onSelectRoute?: (id: string) => void; onPick?: (lat: number, lng: number) => void }>({ onSelectPoint, onSelectRoute });
  cbRef.current = { onSelectPoint, onSelectRoute, onPick };
  const pickLayerRef = useRef<L.LayerGroup | null>(null);
  const pickRef = useRef<PickPoint[]>([]);
  pickRef.current = pickPoints ?? [];

  useEffect(() => {
    if (!host.current) return;
    let disposed = false;
    const map = L.map(host.current, {
      zoomControl: false, attributionControl: false, preferCanvas: true,
      minZoom: 12, maxZoom: 17, zoomSnap: 0.25, scrollWheelZoom: mode === 'pick', doubleClickZoom: true,
      maxBoundsViscosity: 0.85,
    });
    mapRef.current = map;
    L.control.zoom({ position: 'bottomright', zoomInTitle: 'Приблизить', zoomOutTitle: 'Отдалить' }).addTo(map);

    const geo = mode === 'route' && routeId ? [ROUTE_GEO[routeId]].filter(Boolean) : mode === 'pick' ? [] : Object.values(ROUTE_GEO);
    const allPts: L.LatLngTuple[] = geo.flatMap((g) => g.line.map(flip));
    if (allPts.length) {
      map.fitBounds(L.latLngBounds(allPts), { paddingTopLeft: [30, 96], paddingBottomRight: [30, 70], maxZoom: 16, animate: false });
    } else {
      const have = pickRef.current.filter((p): p is { lat: number; lng: number } => !!p);
      if (mode === 'pick' && have.length > 1) map.fitBounds(L.latLngBounds(have.map((p) => [p.lat, p.lng] as L.LatLngTuple)), { padding: [40, 40], maxZoom: 15, animate: false });
      else if (mode === 'pick' && have.length === 1) map.setView([have[0].lat, have[0].lng], 15);
      else map.setView([59.937, 30.31], 13);
    }
    if (mode === 'pick') {
      pickLayerRef.current = L.layerGroup().addTo(map);
      map.on('click', (ev: L.LeafletMouseEvent) => cbRef.current.onPick?.(ev.latlng.lat, ev.latlng.lng));
    }

    const lineLayers: L.Polyline[] = [];
    loadMapData().then((d) => {
      if (disposed) return;
      const bounds = L.latLngBounds([d.bbox.s, d.bbox.w], [d.bbox.n, d.bbox.e]);
      map.setMaxBounds(bounds.pad(0.1));
      const base = { interactive: false, lineCap: 'round' as const, lineJoin: 'round' as const };
      L.polygon(d.parks.map(flipPoly), { ...base, stroke: false, fillColor: '#DCE7D8', fillOpacity: 1 }).addTo(map);
      L.polygon(d.water.map(flipPoly), { ...base, stroke: false, fillColor: '#C9D9EE', fillOpacity: 1 }).addTo(map);
      L.polyline(d.waterway.map(flipLine), { ...base, color: '#C9D9EE', weight: 3, opacity: 1 }).addTo(map);
      const minor = L.polyline(d.minor.map(flipLine), { ...base, color: '#FAFBFC', weight: 1.4 }).addTo(map);
      const mid = L.polyline(d.mid.map(flipLine), { ...base, color: '#FFFFFF', weight: 2.6 }).addTo(map);
      const major = L.polyline(d.major.map(flipLine), { ...base, color: '#FFFFFF', weight: 4.2 }).addTo(map);
      // Толщина улиц растёт с масштабом, чтобы карта не превращалась в паутину
      const restyle = () => {
        const k = Math.pow(2, (map.getZoom() - 14) * 0.75);
        minor.setStyle({ weight: Math.max(0.8, 1.4 * k) });
        mid.setStyle({ weight: Math.max(1.4, 2.6 * k) });
        major.setStyle({ weight: Math.max(2, 4.2 * k) });
      };
      map.on('zoomend', restyle);
      restyle();
      // линии и метки маршрута поверх улиц
      lineLayers.forEach((l) => l.bringToFront());
    });

    // линии и метки маршрутов — отдельная группа, чтобы всегда быть сверху
    const routeLayer = L.layerGroup().addTo(map);
    geo.forEach((g) => {
      const latlngs = g.line.map(flip);
      if (mode === 'route') {
        lineLayers.push(L.polyline(latlngs, { color: '#FFFFFF', weight: 9, opacity: 0.95, lineCap: 'round', lineJoin: 'round', interactive: false }).addTo(routeLayer));
        lineLayers.push(L.polyline(latlngs, { color: '#3F6FBF', weight: 5, opacity: 1, lineCap: 'round', lineJoin: 'round', interactive: false }).addTo(routeLayer));
      } else {
        lineLayers.push(L.polyline(latlngs, { color: '#709CDD', weight: 3.5, opacity: 0.8, lineCap: 'round', lineJoin: 'round', interactive: false }).addTo(routeLayer));
      }
    });
    const markers: L.Marker[] = [];
    if (mode === 'route') {
      geo[0]?.points.forEach((p, i) => {
        const m = L.marker([p.lat, p.lng], {
          icon: pinIcon(String(i + 1), p.approx ? 'approx' : '', 44, photoOf(routeId, i)), keyboard: true, title: `Точка ${i + 1}`,
        }).addTo(routeLayer);
        m.on('click', () => cbRef.current.onSelectPoint?.(i));
        markers.push(m);
      });
    } else if (mode === 'overview') {
      Object.entries(ROUTE_GEO).forEach(([rid, g]) => {
        g.points.forEach((p, i) => {
          const m = L.marker([p.lat, p.lng], { icon: pinIcon('', 'route-pin', 38, photoOf(rid, i)), title: 'Открыть маршрут' }).addTo(routeLayer);
          m.on('click', () => cbRef.current.onSelectRoute?.(rid));
          markers.push(m);
        });
      });
    }
    markersRef.current = markers;

    return () => {
      disposed = true;
      map.remove();
      mapRef.current = null;
      markersRef.current = [];
    };
  }, [mode, routeId]);

  // активная точка: подсветка метки и плавный перелёт
  useEffect(() => {
    const map = mapRef.current;
    if (!map || mode !== 'route') return;
    const g = routeId ? ROUTE_GEO[routeId] : undefined;
    markersRef.current.forEach((m, i) => {
      const approx = g?.points[i]?.approx;
      m.setIcon(pinIcon(String(i + 1), `${approx ? 'approx' : ''} ${i === active ? 'active' : ''}`, 44, photoOf(routeId, i)));
      m.setZIndexOffset(i === active ? 1000 : 0);
    });
    // при открытии карта уже показывает весь маршрут целиком — перелёт только по выбору точки
    if (firstActive.current) { firstActive.current = false; return; }
    const p = g?.points[active];
    if (p) map.flyTo([p.lat, p.lng], Math.max(map.getZoom(), 15.5), { duration: 0.6 });
  }, [active, mode, routeId]);

  // режим админки: метки точек, пунктир между ними, перелёт к выбранной
  useEffect(() => {
    const map = mapRef.current, layer = pickLayerRef.current;
    if (!map || !layer || mode !== 'pick') return;
    layer.clearLayers();
    const pts = pickPoints ?? [];
    const have = pts.filter((p): p is { lat: number; lng: number } => !!p);
    if (have.length > 1) L.polyline(have.map((p) => [p.lat, p.lng] as L.LatLngTuple), { color: '#3F6FBF', weight: 3, dashArray: '6 8', interactive: false }).addTo(layer);
    pts.forEach((p, i) => {
      if (!p) return;
      L.marker([p.lat, p.lng], { icon: pinIcon(String(i + 1), i === pickActive ? 'active' : '', 36), zIndexOffset: i === pickActive ? 1000 : 0, interactive: false }).addTo(layer);
    });
    const a = pts[pickActive];
    if (a && !map.getBounds().contains([a.lat, a.lng])) map.panTo([a.lat, a.lng]);
  }, [mode, pickPoints, pickActive]);

  return (
    <div className="street-map" style={{ height }}>
      <div ref={host} style={{ position: 'absolute', inset: 0 }} role="application" aria-label="Карта маршрута" />
      <div className="map-attr">
        © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> · OpenFreeMap
      </div>
    </div>
  );
}
