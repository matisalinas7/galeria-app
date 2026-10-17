import {
  collection,
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
  limit,
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { ColorGradingParams, renderGradedImageToCanvas } from "./colorEngine";

export interface PublicPhotoItem {
  id: string;
  title: string;
  authorAlias: string;
  filterName: string;
  originalDataUrl: string;
  processedDataUrl: string;
  width: number;
  height: number;
  grading: ColorGradingParams;
  createdAt: string;
  createdAtMs?: number;
  downloads: number;
}

const DB_NAME = "lumina_photos_db";
const STORE_NAME = "photos";
const DB_VERSION = 1;

function createProceduralPhotoSvg(
  type: "portrait" | "alpine" | "tokyo" | "arch",
  filtered: boolean
): string {
  if (type === "portrait") {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 900" width="1200" height="900">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${filtered ? "#2c1910" : "#24201d"}"/>
          <stop offset="55%" stop-color="${filtered ? "#6e3b1e" : "#574c43"}"/>
          <stop offset="100%" stop-color="${filtered ? "#140c08" : "#181615"}"/>
        </linearGradient>
        <radialGradient id="sun" cx="0.72" cy="0.32" r="0.55">
          <stop offset="0%" stop-color="${filtered ? "#ffbe76" : "#e6ccb2"}" stop-opacity="${filtered ? "0.85" : "0.55"}"/>
          <stop offset="50%" stop-color="${filtered ? "#e67e22" : "#b08968"}" stop-opacity="0.25"/>
          <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
        </radialGradient>
        <linearGradient id="beam" x1="1" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${filtered ? "#ffd8a8" : "#ffffff"}" stop-opacity="${filtered ? "0.32" : "0.16"}"/>
          <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <rect width="1200" height="900" fill="url(#bg)"/>
      <rect width="1200" height="900" fill="url(#sun)"/>
      <polygon points="650,0 1200,0 1200,520 220,900 0,900 0,580" fill="url(#beam)"/>
      <g fill="#090706" opacity="${filtered ? "0.52" : "0.34"}">
        <polygon points="0,120 1200,0 1200,45 0,165"/>
        <polygon points="0,250 1200,130 1200,175 0,295"/>
        <polygon points="0,380 1200,260 1200,305 0,425"/>
        <polygon points="0,510 1200,390 1200,435 0,555"/>
      </g>
      <circle cx="580" cy="340" r="115" fill="${filtered ? "#1a0f0a" : "#1f1c1a"}" stroke="${filtered ? "#ffb142" : "#d1ccc0"}" stroke-width="4" opacity="0.95"/>
      <path d="M395,900 C405,620 465,500 580,500 C695,500 755,620 765,900 Z" fill="${filtered ? "#140b07" : "#1c1917"}" stroke="${filtered ? "#ff9f43" : "#a49b93"}" stroke-width="3"/>
      <circle cx="625" cy="318" r="14" fill="${filtered ? "#ffeaa7" : "#f5f6fa"}" opacity="0.7"/>
    </svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }

  if (type === "alpine") {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" width="1280" height="720">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${filtered ? "#071929" : "#1e293b"}"/>
          <stop offset="45%" stop-color="${filtered ? "#164e63" : "#475569"}"/>
          <stop offset="78%" stop-color="${filtered ? "#f59e0b" : "#cbd5e1"}"/>
          <stop offset="100%" stop-color="${filtered ? "#fde68a" : "#e2e8f0"}"/>
        </linearGradient>
        <linearGradient id="lake" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${filtered ? "#b45309" : "#64748b"}"/>
          <stop offset="40%" stop-color="${filtered ? "#0f3f5c" : "#334155"}"/>
          <stop offset="100%" stop-color="${filtered ? "#041321" : "#0f172a"}"/>
        </linearGradient>
      </defs>
      <rect width="1280" height="440" fill="url(#sky)"/>
      <circle cx="880" cy="290" r="65" fill="${filtered ? "#fef08a" : "#f8fafc"}" opacity="${filtered ? "0.88" : "0.6"}"/>
      <polygon points="0,440 210,210 430,360 690,145 960,340 1140,220 1280,350 1280,440" fill="${filtered ? "#0c2d48" : "#334155"}"/>
      <polygon points="690,145 775,205 640,255" fill="${filtered ? "#fde047" : "#cbd5e1"}" opacity="0.45"/>
      <polygon points="0,440 140,310 380,410 560,260 850,420 1280,295 1280,440" fill="${filtered ? "#061a2e" : "#1e293b"}"/>
      <rect y="440" width="1280" height="280" fill="url(#lake)"/>
      <g opacity="0.35" fill="${filtered ? "#fcd34d" : "#cbd5e1"}">
        <rect x="810" y="458" width="140" height="4" rx="2"/>
        <rect x="830" y="472" width="100" height="3" rx="1.5"/>
        <rect x="795" y="488" width="170" height="4" rx="2"/>
        <rect x="840" y="506" width="80" height="3" rx="1.5"/>
      </g>
    </svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }

  if (type === "tokyo") {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 900" width="1200" height="900">
      <defs>
        <linearGradient id="night" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${filtered ? "#050816" : "#18181b"}"/>
          <stop offset="60%" stop-color="${filtered ? "#0f172a" : "#27272a"}"/>
          <stop offset="100%" stop-color="${filtered ? "#090d16" : "#18181b"}"/>
        </linearGradient>
        <radialGradient id="neonCyan" cx="0.3" cy="0.42" r="0.38">
          <stop offset="0%" stop-color="${filtered ? "#06b6d4" : "#71717a"}" stop-opacity="${filtered ? "0.65" : "0.3"}"/>
          <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="neonRose" cx="0.72" cy="0.38" r="0.35">
          <stop offset="0%" stop-color="${filtered ? "#f43f5e" : "#a1a1aa"}" stop-opacity="${filtered ? "0.65" : "0.28"}"/>
          <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="1200" height="900" fill="url(#night)"/>
      <rect width="1200" height="900" fill="url(#neonCyan)"/>
      <rect width="1200" height="900" fill="url(#neonRose)"/>
      <polygon points="0,0 370,180 370,640 0,820" fill="${filtered ? "#070b19" : "#202024"}"/>
      <polygon points="1200,0 830,180 830,640 1200,820" fill="${filtered ? "#070b19" : "#202024"}"/>
      <rect x="240" y="220" width="52" height="190" rx="6" fill="${filtered ? "#22d3ee" : "#a1a1aa"}" opacity="0.9"/>
      <rect x="895" y="250" width="58" height="160" rx="6" fill="${filtered ? "#fb7185" : "#d4d4d8"}" opacity="0.9"/>
      <circle cx="770" cy="480" r="24" fill="${filtered ? "#fbbf24" : "#e4e4e7"}" opacity="0.85"/>
      <polygon points="0,820 370,640 830,640 1200,820 1200,900 0,900" fill="${filtered ? "#060a17" : "#18181b"}"/>
      <ellipse cx="310" cy="760" rx="95" ry="18" fill="${filtered ? "#06b6d4" : "#71717a"}" opacity="0.45"/>
      <ellipse cx="860" cy="775" rx="110" ry="20" fill="${filtered ? "#f43f5e" : "#a1a1aa"}" opacity="0.45"/>
    </svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="1000" height="1000">
    <defs>
      <linearGradient id="skyArch" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${filtered ? "#111111" : "#3f627d"}"/>
        <stop offset="100%" stop-color="${filtered ? "#2b2b2b" : "#7494ad"}"/>
      </linearGradient>
    </defs>
    <rect width="1000" height="1000" fill="url(#skyArch)"/>
    <polygon points="120,1000 120,220 680,110 680,1000" fill="${filtered ? "#e5e5e5" : "#dfd3c3"}"/>
    <polygon points="680,110 920,240 920,1000 680,1000" fill="${filtered ? "#3a3a3a" : "#8d7b68"}"/>
    <path d="M290,1000 L290,520 A135,135 0 0,1 560,520 L560,1000 Z" fill="${filtered ? "#141414" : "#4a3f35"}"/>
    <polygon points="290,1000 560,690 560,1000" fill="${filtered ? "#050505" : "#2c2520"}"/>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const DEFAULT_SEED_GALLERY: PublicPhotoItem[] = [
  {
    id: "lumina-seed-1",
    title: "Tarde en el estudio",
    authorAlias: "Sofi",
    filterName: "Kodak Portra 400",
    originalDataUrl: createProceduralPhotoSvg("portrait", false),
    processedDataUrl: createProceduralPhotoSvg("portrait", true),
    width: 1200,
    height: 900,
    grading: {
      exposure: 6,
      contrast: 18,
      saturation: 22,
      warmth: 28,
      tint: 6,
      fade: 10,
      vignette: 25,
      grain: 14,
      highlightsWarmth: 20,
      shadowsTint: "#23120b",
    },
    createdAt: "Hace 18 min",
    createdAtMs: 1700000004000,
    downloads: 14,
  },
  {
    id: "lumina-seed-2",
    title: "Viaje al sur",
    authorAlias: "Mateo",
    filterName: "Cine Teal & Ámbar",
    originalDataUrl: createProceduralPhotoSvg("alpine", false),
    processedDataUrl: createProceduralPhotoSvg("alpine", true),
    width: 1280,
    height: 720,
    grading: {
      exposure: 4,
      contrast: 24,
      saturation: 28,
      warmth: 16,
      tint: -4,
      fade: 6,
      vignette: 20,
      grain: 8,
      highlightsWarmth: 25,
      shadowsTint: "#082032",
    },
    createdAt: "Hace 45 min",
    createdAtMs: 1700000003000,
    downloads: 29,
  },
  {
    id: "lumina-seed-3",
    title: "Salida nocturna",
    authorAlias: "Lucas",
    filterName: "Noche de Neón",
    originalDataUrl: createProceduralPhotoSvg("tokyo", false),
    processedDataUrl: createProceduralPhotoSvg("tokyo", true),
    width: 1200,
    height: 900,
    grading: {
      exposure: 2,
      contrast: 32,
      saturation: 35,
      warmth: -18,
      tint: 14,
      fade: 4,
      vignette: 32,
      grain: 12,
      highlightsWarmth: -10,
      shadowsTint: "#090d24",
    },
    createdAt: "Hace 1 hora",
    createdAtMs: 1700000002000,
    downloads: 19,
  },
  {
    id: "lumina-seed-4",
    title: "Paseo de domingo",
    authorAlias: "Clara",
    filterName: "Leica Monocromo",
    originalDataUrl: createProceduralPhotoSvg("arch", false),
    processedDataUrl: createProceduralPhotoSvg("arch", true),
    width: 1000,
    height: 1000,
    grading: {
      exposure: 5,
      contrast: 38,
      saturation: -100,
      warmth: 0,
      tint: 0,
      fade: 8,
      vignette: 28,
      grain: 22,
      highlightsWarmth: 4,
      shadowsTint: "#121212",
    },
    createdAt: "Hace 2 horas",
    createdAtMs: 1700000001000,
    downloads: 31,
  },
];

// IndexedDB backup storage
function openIndexedDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const idb = req.result;
      if (!idb.objectStoreNames.contains(STORE_NAME)) {
        idb.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveLocalPhoto(item: PublicPhotoItem): Promise<void> {
  try {
    const idb = await openIndexedDb();
    await new Promise<void>((resolve, reject) => {
      const tx = idb.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      store.put(item);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn("IndexedDB backup error:", e);
  }
}

/**
 * Compresses a rendered canvas into a high-clarity JPEG data URL guaranteed
 * to stay under 380KB so both original + processed fit inside a 1MB Firestore document.
 */
export function renderCompressedCloudDataUrl(
  img: HTMLImageElement,
  grading: ColorGradingParams,
  intensityPercent: number
): { dataUrl: string; width: number; height: number } {
  const offscreen = document.createElement("canvas");
  let maxDim = 1280;
  let quality = 0.82;
  let result = renderGradedImageToCanvas(img, offscreen, grading, intensityPercent, maxDim);
  let dataUrl = offscreen.toDataURL("image/jpeg", quality);

  while (dataUrl.length > 380000 && maxDim >= 640) {
    maxDim = Math.round(maxDim * 0.82);
    quality = Math.max(0.65, quality - 0.06);
    result = renderGradedImageToCanvas(img, offscreen, grading, intensityPercent, maxDim);
    dataUrl = offscreen.toDataURL("image/jpeg", quality);
  }

  return { dataUrl, width: result.width, height: result.height };
}

function formatRelativeTime(createdAtMs?: number): string {
  if (!createdAtMs) return "Reciente";
  const diffSec = Math.max(0, Math.floor((Date.now() - createdAtMs) / 1000));
  if (diffSec < 60) return "Ahora mismo";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `Hace ${diffMin} min`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `Hace ${diffHours} h`;
  const diffDays = Math.floor(diffHours / 24);
  return `Hace ${diffDays} d`;
}

/**
 * Real-time subscription to the cloud Firestore gallery so photos uploaded on Netlify
 * appear immediately for all friends across phones and computers.
 */
export function subscribeToPublicGallery(
  onUpdate: (items: PublicPhotoItem[]) => void
): () => void {
  const photosRef = collection(db, "photos");
  const q = query(photosRef, where("visibility", "==", "public"), limit(48));

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const cloudItems: PublicPhotoItem[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          title: data.title || "Foto compartida",
          authorAlias: data.authorAlias || "Amigo",
          filterName: data.filterName || "Luz Natural",
          originalDataUrl: data.originalDataUrl,
          processedDataUrl: data.processedDataUrl,
          width: Number(data.width) || 1200,
          height: Number(data.height) || 900,
          grading: data.grading || DEFAULT_SEED_GALLERY[0].grading,
          createdAt: formatRelativeTime(data.createdAtMs),
          createdAtMs: Number(data.createdAtMs) || 0,
          downloads: Number(data.downloads) || 0,
        };
      });

      cloudItems.sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));

      const cloudIds = new Set(cloudItems.map((i) => i.id));
      const seeds = DEFAULT_SEED_GALLERY.filter((s) => !cloudIds.has(s.id));
      onUpdate([...cloudItems, ...seeds]);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, "photos");
      } catch {
        onUpdate(DEFAULT_SEED_GALLERY);
      }
    }
  );

  return unsubscribe;
}

/**
 * Publishes a photo directly to Firebase Firestore (so it works on Netlify without a Node backend)
 * and stores a local backup in IndexedDB.
 */
export async function publishPhotoItem(payload: {
  title: string;
  authorAlias: string;
  filterName: string;
  originalDataUrl: string;
  processedDataUrl: string;
  width: number;
  height: number;
  grading: ColorGradingParams;
}): Promise<PublicPhotoItem> {
  const nowMs = Date.now();
  const id = `lumina-${nowMs}-${Math.random().toString(36).substring(2, 7)}`;

  const cleanTitle = (payload.title || "Momento compartido").trim().slice(0, 80);
  const cleanAuthor = (payload.authorAlias || "Amigo").trim().slice(0, 40);
  const cleanFilter = (payload.filterName || "Luz Natural").trim().slice(0, 50);

  const firestoreDoc = {
    visibility: "public",
    title: cleanTitle,
    authorAlias: cleanAuthor,
    filterName: cleanFilter,
    originalDataUrl: payload.originalDataUrl,
    processedDataUrl: payload.processedDataUrl,
    width: Math.max(1, Math.min(10000, Math.round(Number(payload.width) || 1280))),
    height: Math.max(1, Math.min(10000, Math.round(Number(payload.height) || 960))),
    downloads: 0,
    createdAtMs: nowMs,
    grading: payload.grading,
  };

  const newItem: PublicPhotoItem = {
    id,
    ...firestoreDoc,
    createdAt: "Ahora mismo",
  };

  await saveLocalPhoto(newItem);

  try {
    await setDoc(doc(db, "photos", id), firestoreDoc);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `photos/${id}`);
  }

  return newItem;
}

export async function incrementPhotoDownload(item: PublicPhotoItem): Promise<void> {
  if (item.id.startsWith("lumina-seed-")) return;
  const nextDownloads = (item.downloads || 0) + 1;
  await saveLocalPhoto({ ...item, downloads: nextDownloads });
  try {
    await updateDoc(doc(db, "photos", item.id), {
      downloads: nextDownloads,
    });
  } catch (error) {
    try {
      handleFirestoreError(error, OperationType.UPDATE, `photos/${item.id}`);
    } catch {
      // Ignore counter update failure
    }
  }
}
