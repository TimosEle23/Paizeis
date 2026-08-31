import { useEffect, useRef, useState } from "react";

type Venue = {
  id: string;
  name: string;
  location: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
};

declare global {
  interface Window {
    google?: any;
    __initPezeisMap?: () => void;
  }
}

// Retro 8-bit inspired map styling (Super Mario palette)
const RETRO_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#4fa64f" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#1b3d1b" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#e8f5c8" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "landscape.man_made", elementType: "geometry", stylers: [{ color: "#7ec850" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#f3d9a4" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#8b5a2b" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#e8443a" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#7a1f1a" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#2d6fd1" }] },
  { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#1b3d1b" }] },
];

const pixelPin = (fill: string, stroke: string) =>
  "data:image/svg+xml;charset=UTF-8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="28" shape-rendering="crispEdges" viewBox="0 0 12 14">
      <g fill="${stroke}"><rect x="3" y="0" width="6" height="1"/><rect x="2" y="1" width="1" height="6"/><rect x="9" y="1" width="1" height="6"/><rect x="3" y="7" width="1" height="2"/><rect x="8" y="7" width="1" height="2"/><rect x="5" y="9" width="2" height="4"/></g>
      <g fill="${fill}"><rect x="3" y="1" width="6" height="6"/><rect x="4" y="7" width="4" height="2"/></g>
      <rect x="5" y="3" width="2" height="2" fill="#ffffff"/>
    </svg>`,
  );

const loadMapsApi = (): Promise<void> => {
  if (window.google?.maps) return Promise.resolve();
  const existing = document.getElementById("pezeis-gmaps") as HTMLScriptElement | null;
  return new Promise((resolve, reject) => {
    window.__initPezeisMap = () => resolve();
    if (existing) return;
    const key = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY;
    const channel = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID;
    if (!key) return reject(new Error("Missing Google Maps browser key"));
    const script = document.createElement("script");
    script.id = "pezeis-gmaps";
    script.async = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&loading=async&callback=__initPezeisMap&language=en&region=CY${
      channel ? `&channel=${channel}` : ""
    }`;
    script.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(script);
  });
};

const VenuesMap = ({ venues }: { venues: Venue[] }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadMapsApi()
      .then(() => {
        if (cancelled || !containerRef.current) return;
        if (!mapRef.current) {
          mapRef.current = new window.google.maps.Map(containerRef.current, {
            center: { lat: 35.0, lng: 33.2 },
            zoom: 9,
            styles: RETRO_STYLE,
            disableDefaultUI: true,
            zoomControl: true,
          });
        }
        setMapReady(true);

        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const me = { lat: pos.coords.latitude, lng: pos.coords.longitude };
              new window.google.maps.Marker({
                position: me,
                map: mapRef.current,
                title: "You are here",
                icon: {
                  url: pixelPin("#e8443a", "#1b1b1b"),
                  scaledSize: new window.google.maps.Size(30, 35),
                },
                zIndex: 999,
              });
              mapRef.current.setCenter(me);
              mapRef.current.setZoom(12);
            },
            () => {},
            { enableHighAccuracy: false, timeout: 8000 },
          );
        }
      })
      .catch((e) => setError(e.message));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!mapReady || !mapRef.current || !window.google?.maps) return;
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
    const info = new window.google.maps.InfoWindow();

    venues
      .filter((v) => v.latitude != null && v.longitude != null)
      .forEach((v) => {
        const marker = new window.google.maps.Marker({
          position: { lat: v.latitude as number, lng: v.longitude as number },
          map: mapRef.current,
          title: v.name,
          icon: {
            url: pixelPin("#38c172", "#1b1b1b"),
            scaledSize: new window.google.maps.Size(26, 30),
          },
        });
        marker.addListener("click", () => {
          info.setContent(
            `<div style="font-family:monospace;color:#111"><strong>${v.name}</strong><br/>${v.location}, ${v.city}</div>`,
          );
          info.open(mapRef.current, marker);
        });
        markersRef.current.push(marker);
      });
  }, [venues, mapReady]);

  if (error) {
    return (
      <div className="rounded-lg border border-white/10 bg-black/60 p-6 text-center font-mono text-sm text-white/70">
        Map unavailable: {error}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="h-[280px] w-full overflow-hidden rounded-lg border-4 border-white/20 shadow-lg sm:h-[360px] lg:h-[460px]"
      aria-label="Map of nearby pitches"
    />
  );
};

export default VenuesMap;
