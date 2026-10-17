import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Upload,
  Download,
  Share2,
  Eye,
  X,
  Check,
  Image as ImageIcon,
  RotateCcw,
} from "lucide-react";
import {
  ColorGradingParams,
  CURATED_OPTICAL_PRESETS,
  renderGradedImageToCanvas,
  exportHighResDataUrl,
} from "./utils/colorEngine";

interface PublicPhotoItem {
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
  downloads: number;
}

export default function App() {
  const [gallery, setGallery] = useState<PublicPhotoItem[]>([]);
  const [lightboxItem, setLightboxItem] = useState<PublicPhotoItem | null>(null);
  const [lightboxShowOriginal, setLightboxShowOriginal] = useState<boolean>(false);

  // Editor state (opens when user selects/drops a photo or clicks one to edit)
  const [activeImageSrc, setActiveImageSrc] = useState<string | null>(null);
  const [loadedImageEl, setLoadedImageEl] = useState<HTMLImageElement | null>(null);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number }>({
    width: 1200,
    height: 900,
  });

  const [activePresetIndex, setActivePresetIndex] = useState<number>(0);
  const [intensity, setIntensity] = useState<number>(100);
  const [photoTitle, setPhotoTitle] = useState<string>("");
  const [authorAlias, setAuthorAlias] = useState<string>("");
  const [isHoldingOriginal, setIsHoldingOriginal] = useState<boolean>(false);
  const [isPublishing, setIsPublishing] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [statusToast, setStatusToast] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const currentPreset = CURATED_OPTICAL_PRESETS[activePresetIndex] || CURATED_OPTICAL_PRESETS[0];

  const triggerToast = useCallback((msg: string) => {
    setStatusToast(msg);
    setTimeout(() => {
      setStatusToast((prev) => (prev === msg ? null : prev));
    }, 3200);
  }, []);

  // Load shared gallery on mount
  useEffect(() => {
    async function fetchGallery() {
      try {
        const res = await fetch("/api/gallery");
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.items)) {
            setGallery(data.items);
          }
        }
      } catch (err) {
        console.error("Error loading gallery:", err);
      }
    }
    fetchGallery();
  }, []);

  // Load image element when user uploads or selects a photo
  useEffect(() => {
    if (!activeImageSrc) {
      setLoadedImageEl(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      setLoadedImageEl(img);
      setImageDimensions({
        width: img.naturalWidth || img.width || 1200,
        height: img.naturalHeight || img.height || 900,
      });
    };
    img.src = activeImageSrc;
  }, [activeImageSrc]);

  // Render preview canvas with selected automatic filter
  useEffect(() => {
    if (!loadedImageEl || !previewCanvasRef.current) return;
    const effectiveIntensity = isHoldingOriginal ? 0 : intensity;
    renderGradedImageToCanvas(
      loadedImageEl,
      previewCanvasRef.current,
      currentPreset.grading,
      effectiveIntensity,
      1400
    );
  }, [loadedImageEl, currentPreset, intensity, isHoldingOriginal]);

  // Handle file upload
  const handleFileUpload = (file: File) => {
    if (!file.type.startsWith("image/")) {
      triggerToast("Selecciona una imagen válida (JPG, PNG, WEBP).");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (result) {
        setActiveImageSrc(result);
        setActivePresetIndex(0);
        setIntensity(100);
        const cleanName = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
        setPhotoTitle(cleanName ? cleanName.slice(0, 40) : "");
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileUpload(file);
  };

  // Free High-Resolution Download
  const handleDownloadCurrent = () => {
    if (!loadedImageEl) return;
    setIsExporting(true);
    setTimeout(() => {
      try {
        const { dataUrl, width, height } = exportHighResDataUrl(
          loadedImageEl,
          currentPreset.grading,
          intensity,
          "image/png",
          1
        );
        const link = document.createElement("a");
        const safeName = (photoTitle || "foto")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");
        link.download = `${safeName || "foto"}-${width}x${height}.png`;
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        triggerToast(`Descargada en alta resolución (${width}×${height} px)`);
      } catch (err) {
        console.error(err);
        triggerToast("Error al descargar la imagen.");
      } finally {
        setIsExporting(false);
      }
    }, 40);
  };

  // Publish to shared gallery
  const handlePublish = async () => {
    if (!loadedImageEl || isPublishing) return;
    setIsPublishing(true);
    try {
      const offscreenOrig = document.createElement("canvas");
      renderGradedImageToCanvas(loadedImageEl, offscreenOrig, currentPreset.grading, 0, 1920);
      const originalDataUrl = offscreenOrig.toDataURL("image/jpeg", 0.88);

      const offscreenProcessed = document.createElement("canvas");
      const { width, height } = renderGradedImageToCanvas(
        loadedImageEl,
        offscreenProcessed,
        currentPreset.grading,
        intensity,
        1920
      );
      const processedDataUrl = offscreenProcessed.toDataURL("image/jpeg", 0.92);

      const res = await fetch("/api/gallery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: photoTitle.trim() || "Momento compartido",
          authorAlias: authorAlias.trim() || "Anónimo",
          filterName: intensity === 0 ? "Original" : currentPreset.name,
          originalDataUrl,
          processedDataUrl,
          width,
          height,
          grading: currentPreset.grading,
        }),
      });

      if (res.ok) {
        const { item } = await res.json();
        setGallery((prev) => [item, ...prev]);
        setActiveImageSrc(null);
        setPhotoTitle("");
        triggerToast("Foto subida a la galería");
      }
    } catch (err) {
      console.error(err);
      triggerToast("No se pudo subir la foto.");
    } finally {
      setIsPublishing(false);
    }
  };

  // Download any photo from the gallery in full resolution
  const handleDownloadGalleryItem = (item: PublicPhotoItem) => {
    fetch(`/api/gallery/${item.id}/download`, { method: "POST" }).catch(() => {});
    setGallery((prev) =>
      prev.map((g) => (g.id === item.id ? { ...g, downloads: g.downloads + 1 } : g))
    );

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const { dataUrl, width, height } = exportHighResDataUrl(
        img,
        item.grading,
        100,
        "image/png",
        1
      );
      const link = document.createElement("a");
      const slug = item.title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      link.download = `${slug || "foto"}-${width}x${height}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      triggerToast(`Descargada "${item.title}" (${width}×${height} px)`);
    };
    img.src = item.originalDataUrl;
  };

  return (
    <div className="min-h-screen bg-[#09090B] text-zinc-100 flex flex-col">
      {/* Minimal Top Bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-8 px-6 lg:px-12 py-4 bg-[#09090B]/90 backdrop-blur-md border-b border-zinc-800/80">
        <a
          href="#top"
          className="text-lg font-bold tracking-tight text-white font-display whitespace-nowrap shrink-0"
        >
          Lumina
        </a>

        <nav className="hidden sm:flex items-center gap-6 text-sm font-medium text-zinc-400">
          <a href="#subir" className="hover:text-white transition-colors whitespace-nowrap shrink-0">
            Subir Foto
          </a>
          <a href="#galeria" className="hover:text-white transition-colors whitespace-nowrap shrink-0">
            Galería ({gallery.length})
          </a>
        </nav>

        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-500 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Subir Imagen</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileUpload(file);
              e.target.value = "";
            }}
            className="hidden"
          />
        </div>
      </header>

      {/* Toast Notification */}
      {statusToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-zinc-900 border border-zinc-700 text-zinc-100 px-4 py-3 rounded-xl shadow-2xl text-xs font-medium flex items-center gap-2">
          <Check className="w-4 h-4 text-blue-400 shrink-0" />
          <span>{statusToast}</span>
        </div>
      )}

      <main id="top" className="flex-1 max-w-[1360px] w-full mx-auto px-6 lg:px-12 py-8">
        {/* Upload & Filter Section */}
        <section id="subir" className="mb-12">
          {!activeImageSrc ? (
            /* Compact & Direct Upload Box */
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-10 px-6 bg-[#121215] hover:bg-zinc-900/90 border border-dashed border-zinc-700 hover:border-blue-500 rounded-2xl transition-colors cursor-pointer flex flex-col items-center justify-center text-center gap-3"
            >
              <div className="w-11 h-11 rounded-full bg-zinc-800/80 text-zinc-200 flex items-center justify-center">
                <Upload className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">
                  Sube una foto para aplicarle filtros y compartirla con tus amigos
                </p>
                <p className="text-xs text-zinc-400 mt-1">
                  Arrastra una imagen aquí o haz clic para elegir de tu dispositivo · Sin cuenta y en alta resolución
                </p>
              </div>
            </div>
          ) : (
            /* Active Simple Filter & Share Editor */
            <div className="bg-[#121215] border border-zinc-800 rounded-2xl p-5 lg:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left: Photo Preview */}
              <div className="lg:col-span-7 flex flex-col gap-3">
                <div className="relative w-full aspect-[4/3] bg-zinc-950 rounded-xl overflow-hidden flex items-center justify-center border border-zinc-800/80">
                  <canvas
                    ref={previewCanvasRef}
                    className="w-full h-full object-contain"
                  />
                  <div className="absolute top-3 left-3 bg-black/65 backdrop-blur-sm px-2.5 py-1 rounded text-[11px] font-mono text-zinc-200">
                    {isHoldingOriginal
                      ? "Original"
                      : `${currentPreset.name} · ${intensity}%`}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 text-xs text-zinc-400">
                  <span className="font-mono tabular-nums">
                    {imageDimensions.width} × {imageDimensions.height} px
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onMouseDown={() => setIsHoldingOriginal(true)}
                      onMouseUp={() => setIsHoldingOriginal(false)}
                      onMouseLeave={() => setIsHoldingOriginal(false)}
                      onTouchStart={() => setIsHoldingOriginal(true)}
                      onTouchEnd={() => setIsHoldingOriginal(false)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white cursor-pointer whitespace-nowrap"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Ver original</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveImageSrc(null)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white cursor-pointer whitespace-nowrap"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Cerrar</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Right: Instant Filter Picker & Actions */}
              <div className="lg:col-span-5 flex flex-col gap-5">
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-xs font-semibold text-white">
                      Elige un filtro
                    </span>
                    <button
                      type="button"
                      onClick={() => setIntensity(0)}
                      className="text-xs text-zinc-400 hover:text-white flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Sin filtro</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {CURATED_OPTICAL_PRESETS.map((preset, idx) => {
                      const active = idx === activePresetIndex && intensity > 0;
                      return (
                        <button
                          key={preset.name}
                          type="button"
                          onClick={() => {
                            setActivePresetIndex(idx);
                            if (intensity === 0) setIntensity(100);
                          }}
                          className={`text-left p-2.5 rounded-xl border transition-colors cursor-pointer ${
                            active
                              ? "bg-blue-600/15 border-blue-500 text-white"
                              : "bg-zinc-950 border-zinc-800 text-zinc-300 hover:border-zinc-700"
                          }`}
                        >
                          <div className="text-xs font-semibold truncate">{preset.name}</div>
                          <div className="text-[11px] text-zinc-400 truncate mt-0.5">
                            {preset.tagline}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Intensity Slider */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-zinc-300">Intensidad</span>
                    <span className="font-mono tabular-nums text-zinc-200">{intensity}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={intensity}
                    onChange={(e) => setIntensity(Number(e.target.value))}
                    className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                {/* Optional Title & Name for Friends */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-zinc-800/80">
                  <input
                    type="text"
                    value={photoTitle}
                    onChange={(e) => setPhotoTitle(e.target.value)}
                    placeholder="Título (ej. Asado del sábado)"
                    className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-blue-500"
                  />
                  <input
                    type="text"
                    value={authorAlias}
                    onChange={(e) => setAuthorAlias(e.target.value)}
                    placeholder="Tu nombre (opcional)"
                    className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Action Buttons: Publish to Gallery or Download Free HD */}
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <button
                    type="button"
                    onClick={handlePublish}
                    disabled={isPublishing}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
                  >
                    <Share2 className="w-4 h-4" />
                    <span>{isPublishing ? "Subiendo..." : "Publicar en la Galería"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadCurrent}
                    disabled={isExporting}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-100 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
                  >
                    <Download className="w-4 h-4" />
                    <span>{isExporting ? "Exportando..." : "Descargar HD"}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Shared Gallery Section */}
        <section id="galeria">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white font-display">
              Fotos Compartidas
            </h2>
            <span className="text-xs text-zinc-400 font-mono tabular-nums">
              {gallery.length} fotos públicas
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {gallery.map((item) => (
              <article
                key={item.id}
                className="bg-[#121215] border border-zinc-800/90 rounded-2xl overflow-hidden flex flex-col group hover:border-zinc-700 transition-colors"
              >
                <div
                  onClick={() => {
                    setLightboxItem(item);
                    setLightboxShowOriginal(false);
                  }}
                  className="relative aspect-[4/3] w-full bg-zinc-900 overflow-hidden cursor-pointer"
                >
                  {item.processedDataUrl ? (
                    <img
                      src={item.processedDataUrl}
                      alt={item.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-200"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-500">
                      <ImageIcon className="w-8 h-8" />
                    </div>
                  )}
                </div>

                <div className="p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-white truncate">
                      {item.title}
                    </h3>
                    <div className="flex items-center gap-1.5 text-xs text-zinc-400 truncate mt-0.5">
                      <span>{item.authorAlias}</span>
                      <span aria-hidden="true">·</span>
                      <span>{item.filterName}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDownloadGalleryItem(item)}
                    className="px-3 py-1.5 text-xs font-medium text-white bg-zinc-800 hover:bg-blue-600 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5"
                    title="Descargar gratis en alta resolución"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Descargar</span>
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>

      {/* Lightbox Modal for Fullscreen View */}
      {lightboxItem && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setLightboxItem(null)}
        >
          <div
            className="bg-[#121215] border border-zinc-800 rounded-2xl max-w-4xl w-full overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative bg-zinc-950 flex items-center justify-center max-h-[75vh] p-3">
              <img
                src={
                  lightboxShowOriginal
                    ? lightboxItem.originalDataUrl
                    : lightboxItem.processedDataUrl
                }
                alt={lightboxItem.title}
                referrerPolicy="no-referrer"
                className="max-h-[70vh] w-auto object-contain rounded-lg"
              />
              <button
                type="button"
                onClick={() => setLightboxItem(null)}
                className="absolute top-3 right-3 p-2 rounded-lg bg-black/70 text-zinc-300 hover:text-white cursor-pointer"
                aria-label="Cerrar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 flex flex-wrap items-center justify-between gap-4 border-t border-zinc-800">
              <div>
                <h3 className="text-base font-bold text-white">{lightboxItem.title}</h3>
                <p className="text-xs text-zinc-400">
                  Subida por {lightboxItem.authorAlias} · Filtro: {lightboxItem.filterName} · {lightboxItem.width}×{lightboxItem.height} px
                </p>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setLightboxShowOriginal((v) => !v)}
                  className="px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-medium text-zinc-200 cursor-pointer whitespace-nowrap"
                >
                  {lightboxShowOriginal ? "Ver con filtro" : "Ver original"}
                </button>

                <button
                  type="button"
                  onClick={() => handleDownloadGalleryItem(lightboxItem)}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Descargar HD</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
