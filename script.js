import { DEFAULT_THEME, classifyTheme, getThemeById, getThemeSwatches } from "./themes.js";

const state = {
  items: [],
  activeIndex: 0,
  activeTheme: DEFAULT_THEME,
  activePhotoIndex: 0,
  photoIndexes: new Map(),
  photoSequence: 0,
  albumScrubbing: false,
  albumPointerStartX: 0,
  albumSuppressClick: false,
  albumWheelLocked: false,
  albumWheelUnlockTimer: 0,
  raf: 0,
  desiredIndex: 0,
  activating: false
};

const els = {
  stage: document.querySelector("#stage"),
  scrollSpace: document.querySelector("#scrollSpace"),
  chapterLabel: document.querySelector("#chapterLabel"),
  locationLabel: document.querySelector("#locationLabel"),
  heroTitle: document.querySelector("#heroTitle"),
  themeName: document.querySelector("#themeName"),
  locationCn: document.querySelector("#locationCn"),
  brushNote: document.querySelector("#brushNote"),
  dateValue: document.querySelector("#dateValue"),
  timeValue: document.querySelector("#timeValue"),
  coordsValue: document.querySelector("#coordsValue"),
  captionValue: document.querySelector("#captionValue"),
  paletteRow: document.querySelector("#paletteRow"),
  photoFrame: document.querySelector("#photoFrame"),
  mainPhoto: document.querySelector("#mainPhoto"),
  photoPlace: document.querySelector("#photoPlace"),
  photoIndex: document.querySelector("#photoIndex"),
  photoTime: document.querySelector("#photoTime"),
  photoCoords: document.querySelector("#photoCoords"),
  albumStrip: document.querySelector("#albumStrip"),
  previewTrack: document.querySelector("#previewTrack"),
  railCount: document.querySelector("#railCount"),
  railProgress: document.querySelector("#railProgress")
};

init();

async function init() {
  state.items = await loadGallery();
  if (!state.items.length) {
    renderEmptyState();
    return;
  }

  els.scrollSpace.style.height = `${state.items.length * 100}vh`;
  renderPreviewRail();
  await setActive(0, { immediate: true });
  window.addEventListener("scroll", scheduleScrollUpdate, { passive: true });
  window.addEventListener("resize", scheduleScrollUpdate);
  window.addEventListener("keydown", handleKeydown);
  els.albumStrip.addEventListener("pointerdown", handleAlbumPointerDown);
  els.albumStrip.addEventListener("pointermove", handleAlbumPointerMove);
  els.albumStrip.addEventListener("pointerup", handleAlbumPointerEnd);
  els.albumStrip.addEventListener("pointercancel", handleAlbumPointerEnd);
  els.albumStrip.addEventListener("wheel", handleAlbumWheel, { passive: false });
  scheduleScrollUpdate();
}

async function loadGallery() {
  const apiItems = await tryFetchJson("./api/gallery");
  if (apiItems?.length) return normalizeItems(apiItems);

  const fallbackItems = await tryFetchJson("./content/gallery.json");
  if (fallbackItems?.length) return normalizeItems(fallbackItems);

  return [];
}

async function tryFetchJson(url) {
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

function normalizeItems(items) {
  return items.map((item, index) => {
    const title = cleanTitle(item.title || item.name || item.id || `LOCATION ${index + 1}`);
    const images = Array.isArray(item.images) && item.images.length ? item.images : [item.cover].filter(Boolean);
    return {
      id: item.id || `location-${index + 1}`,
      title,
      location: item.location || title,
      chapter: item.chapter || `CHAPTER ${String(index + 1).padStart(2, "0")}`,
      date: item.date || "2026",
      time: item.time || "--:--",
      coordinates: item.coordinates || item.coords || "---",
      note: item.note || "light · distance · memory",
      caption: item.caption || "untitled frame",
      theme: item.theme || "auto",
      cover: item.cover || images[0],
      images
    };
  });
}

function renderEmptyState() {
  els.scrollSpace.style.height = "100vh";
  els.chapterLabel.textContent = "CHAPTER 00";
  els.locationLabel.textContent = "NO PHOTOS";
  els.heroTitle.textContent = "PHOTO JOURNAL";
  els.themeName.textContent = "NO GALLERY";
  els.locationCn.textContent = "No photo folders found";
  els.brushNote.textContent = "Add image folders under photos, then refresh.";
  els.dateValue.textContent = "--";
  els.timeValue.textContent = "--:--";
  els.coordsValue.textContent = "---";
  els.captionValue.textContent = "Waiting for photographs.";
  els.photoPlace.textContent = "EMPTY";
  els.photoIndex.textContent = "00 / 00";
  els.photoTime.textContent = "--:--";
  els.photoCoords.textContent = "---";
  els.mainPhoto.removeAttribute("src");
  els.previewTrack.innerHTML = "";
  els.railCount.textContent = "00";
  els.railProgress.style.transform = "scaleY(0)";
  renderPalette(DEFAULT_THEME);
  replayReveal(true);
}

async function setActive(index, options = {}) {
  const nextIndex = clamp(index, 0, state.items.length - 1);
  const item = state.items[nextIndex];
  if (!item) return;

  state.activeIndex = nextIndex;
  state.activePhotoIndex = state.photoIndexes.get(item.id) || 0;
  const theme = item.theme && item.theme !== "auto"
    ? getThemeById(item.theme)
    : classifyTheme(await sampleImageColor(item.cover));

  state.activeTheme = theme;
  applyTheme(theme);
  renderContent(item, nextIndex, options);
  updatePreviewRail(nextIndex);
  replayReveal(options.immediate);
}

function renderContent(item, index, options = {}) {
  els.chapterLabel.textContent = item.chapter;
  els.locationLabel.textContent = item.title;
  els.heroTitle.innerHTML = splitTitle(item.title);
  els.themeName.textContent = state.activeTheme.label.toUpperCase();
  els.locationCn.textContent = item.location;
  els.brushNote.textContent = item.note;
  els.dateValue.textContent = item.date;
  els.timeValue.textContent = item.time;
  els.coordsValue.textContent = item.coordinates;
  els.captionValue.textContent = item.caption;
  els.photoPlace.textContent = item.title;
  els.photoTime.textContent = item.time;
  els.photoCoords.textContent = item.coordinates;
  els.railCount.textContent = String(state.items.length).padStart(2, "0");
  renderPalette(state.activeTheme);
  renderAlbumStrip(item);
  showPhoto(item, state.activePhotoIndex, { immediate: options.immediate, direction: "album" });
}

function getAlbumImages(item) {
  return Array.isArray(item.images) && item.images.length ? item.images : [item.cover].filter(Boolean);
}

function renderAlbumStrip(item) {
  const images = getAlbumImages(item);
  els.albumStrip.innerHTML = "";
  els.albumStrip.hidden = images.length <= 1;
  els.albumStrip.style.setProperty("--album-count", String(Math.max(images.length, 1)));

  images.forEach((_, index) => {
    const button = document.createElement("button");
    button.className = "album-bar";
    button.type = "button";
    button.setAttribute("aria-label", `切换到第 ${index + 1} 张照片`);
    button.addEventListener("click", (event) => {
      if (state.albumSuppressClick) {
        event.preventDefault();
        return;
      }
      showPhoto(item, index, {
        direction: index > state.activePhotoIndex ? "next" : "prev"
      });
    });

    const fill = document.createElement("span");
    button.appendChild(fill);
    els.albumStrip.appendChild(button);
  });

  updateAlbumStrip(state.activePhotoIndex);
}

function showPhoto(item, photoIndex, options = {}) {
  const images = getAlbumImages(item);
  if (!images.length) return;

  const nextPhotoIndex = clamp(photoIndex, 0, images.length - 1);
  const src = images[nextPhotoIndex];
  const currentSrc = els.mainPhoto.getAttribute("src") || "";
  state.activePhotoIndex = nextPhotoIndex;
  state.photoIndexes.set(item.id, nextPhotoIndex);
  updateAlbumStrip(nextPhotoIndex);
  updatePhotoMeta(item, nextPhotoIndex, images.length);
  preloadAdjacent(images, nextPhotoIndex);

  if (currentSrc === src && !options.immediate) return;

  const sequence = state.photoSequence + 1;
  state.photoSequence = sequence;
  els.photoFrame.dataset.direction = options.direction || "next";
  els.photoFrame.classList.remove("is-photo-loaded");
  if (!options.immediate) {
    els.photoFrame.classList.add("is-photo-changing");
  }

  const finalize = () => {
    if (sequence !== state.photoSequence) return;
    updatePhotoOrientation();
    window.requestAnimationFrame(() => {
      els.photoFrame.classList.remove("is-photo-changing");
      els.photoFrame.classList.add("is-photo-loaded");
    });
  };

  els.mainPhoto.onload = finalize;
  els.mainPhoto.src = src;
  els.mainPhoto.alt = `${item.location} ${item.title} photo ${nextPhotoIndex + 1}`;

  if (els.mainPhoto.complete && els.mainPhoto.naturalWidth) {
    finalize();
  }
}

function updatePhotoMeta(item, photoIndex, photoCount) {
  els.photoPlace.textContent = item.title;
  els.photoIndex.textContent = `${String(photoIndex + 1).padStart(2, "0")} / ${String(photoCount).padStart(2, "0")}`;
  els.photoTime.textContent = item.time;
  els.photoCoords.textContent = item.coordinates;
}

function updateAlbumStrip(activeIndex) {
  [...els.albumStrip.children].forEach((child, index) => {
    child.classList.toggle("is-active", index === activeIndex);
  });
}

function updatePhotoOrientation() {
  const ratio = els.mainPhoto.naturalWidth / Math.max(els.mainPhoto.naturalHeight, 1);
  els.photoFrame.classList.remove("is-landscape", "is-portrait", "is-square");
  if (ratio > 1.16) {
    els.photoFrame.classList.add("is-landscape");
  } else if (ratio < 0.86) {
    els.photoFrame.classList.add("is-portrait");
  } else {
    els.photoFrame.classList.add("is-square");
  }
}

function preloadAdjacent(images, photoIndex) {
  [photoIndex - 1, photoIndex + 1].forEach((index) => {
    if (index < 0 || index >= images.length) return;
    const image = new Image();
    image.src = images[index];
  });
}

function splitTitle(title) {
  const clean = cleanTitle(title);
  if (clean.length <= 7) return `<span>${clean}</span>`;
  const midpoint = Math.ceil(clean.length / 2);
  return `<span>${clean.slice(0, midpoint)}</span><span>${clean.slice(midpoint)}</span>`;
}

function cleanTitle(value) {
  return String(value).replace(/^\d+[-_\s]*/, "").replace(/[-_]+/g, " ").trim().toUpperCase();
}

function renderPalette(theme) {
  els.paletteRow.innerHTML = "";
  getThemeSwatches(theme).forEach((color) => {
    const chip = document.createElement("span");
    chip.className = "color-chip";
    chip.style.backgroundColor = color;
    chip.title = color;
    els.paletteRow.appendChild(chip);
  });
}

function renderPreviewRail() {
  els.previewTrack.innerHTML = "";
  state.items.forEach((item, index) => {
    const button = document.createElement("button");
    button.className = "preview-card";
    button.type = "button";
    button.setAttribute("aria-label", `切换到 ${item.location}`);
    button.addEventListener("click", () => scrollToIndex(index));

    const image = document.createElement("img");
    image.src = item.cover;
    image.alt = "";

    const label = document.createElement("span");
    label.textContent = String(index + 1).padStart(2, "0");

    button.append(image, label);
    els.previewTrack.appendChild(button);
  });
}

function updatePreviewRail(index) {
  [...els.previewTrack.children].forEach((child, childIndex) => {
    child.classList.toggle("is-active", childIndex === index);
  });
  els.previewTrack.style.transform = `translate3d(0, ${index * -86}px, 0)`;
  const progress = state.items.length <= 1 ? 1 : (index + 1) / state.items.length;
  els.railProgress.style.transform = `scaleY(${progress})`;
}

function scrollToIndex(index) {
  window.scrollTo({
    top: index * window.innerHeight,
    behavior: "smooth"
  });
}

function handleAlbumPointerDown(event) {
  const item = state.items[state.activeIndex];
  if (!item || getAlbumImages(item).length <= 1) return;

  state.albumScrubbing = true;
  state.albumPointerStartX = event.clientX;
  state.albumSuppressClick = false;
  els.albumStrip.classList.add("is-scrubbing");
  els.albumStrip.setPointerCapture?.(event.pointerId);
  scrubAlbumFromPointer(event);
}

function handleAlbumPointerMove(event) {
  if (!state.albumScrubbing) return;
  if (Math.abs(event.clientX - state.albumPointerStartX) > 4) {
    state.albumSuppressClick = true;
  }
  scrubAlbumFromPointer(event);
}

function handleAlbumPointerEnd(event) {
  if (!state.albumScrubbing) return;
  state.albumScrubbing = false;
  els.albumStrip.classList.remove("is-scrubbing");
  els.albumStrip.releasePointerCapture?.(event.pointerId);
  window.setTimeout(() => {
    state.albumSuppressClick = false;
  }, 80);
}

function scrubAlbumFromPointer(event) {
  const item = state.items[state.activeIndex];
  if (!item) return;

  const images = getAlbumImages(item);
  if (images.length <= 1) return;

  const rect = els.albumStrip.getBoundingClientRect();
  const ratio = clamp((event.clientX - rect.left) / Math.max(rect.width, 1), 0, 1);
  const nextIndex = Math.round(ratio * (images.length - 1));
  if (nextIndex === state.activePhotoIndex) return;

  showPhoto(item, nextIndex, {
    direction: nextIndex > state.activePhotoIndex ? "next" : "prev"
  });
}

function handleAlbumWheel(event) {
  const item = state.items[state.activeIndex];
  if (!item) return;

  const images = getAlbumImages(item);
  if (images.length <= 1) return;

  event.preventDefault();
  const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
  if (!delta) return;

  window.clearTimeout(state.albumWheelUnlockTimer);
  if (state.albumWheelLocked) {
    state.albumWheelUnlockTimer = window.setTimeout(() => {
      state.albumWheelLocked = false;
    }, 220);
    return;
  }

  state.albumWheelLocked = true;
  state.albumWheelUnlockTimer = window.setTimeout(() => {
    state.albumWheelLocked = false;
  }, 220);

  const nextIndex = wrapPhotoIndex(state.activePhotoIndex + (delta > 0 ? 1 : -1), images.length);
  showPhoto(item, nextIndex, {
    direction: delta > 0 ? "next" : "prev"
  });
}

function handleKeydown(event) {
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
  const item = state.items[state.activeIndex];
  if (!item) return;

  const images = getAlbumImages(item);
  if (images.length <= 1) return;

  event.preventDefault();
  const offset = event.key === "ArrowRight" ? 1 : -1;
  const nextIndex = wrapPhotoIndex(state.activePhotoIndex + offset, images.length);
  showPhoto(item, nextIndex, { direction: offset > 0 ? "next" : "prev" });
}

function wrapPhotoIndex(index, length) {
  if (!length) return 0;
  return ((index % length) + length) % length;
}

function scheduleScrollUpdate() {
  if (state.raf) return;
  state.raf = window.requestAnimationFrame(handleScroll);
}

function handleScroll() {
  state.raf = 0;
  if (!state.items.length) return;

  const sectionHeight = Math.max(window.innerHeight, 1);
  const raw = window.scrollY / sectionHeight;
  const nextIndex = clamp(Math.round(raw), 0, state.items.length - 1);
  const sectionProgress = raw - Math.floor(raw);

  els.stage.style.setProperty("--scroll-progress", sectionProgress.toFixed(3));
  els.photoFrame.style.transform = `translate3d(0, ${sectionProgress * -18}px, 0) scale(${1 + sectionProgress * 0.012})`;

  if (nextIndex !== state.activeIndex) {
    requestActive(nextIndex);
  }
}

// Coalesce activations: only one setActive runs at a time. While it awaits
// image-color sampling, later scroll targets are recorded in desiredIndex and
// applied once the in-flight activation settles — avoiding concurrent,
// out-of-order theme/content updates during fast scrolling.
async function requestActive(index) {
  state.desiredIndex = index;
  if (state.activating) return;

  state.activating = true;
  try {
    while (state.desiredIndex !== state.activeIndex) {
      await setActive(state.desiredIndex);
    }
  } finally {
    state.activating = false;
  }
}

function replayReveal(immediate = false) {
  els.stage.classList.remove("is-ready");
  els.stage.classList.toggle("is-initial", Boolean(immediate));
  void els.stage.offsetWidth;
  els.stage.classList.add("is-ready");
}

function applyTheme(theme) {
  const root = document.documentElement;
  Object.entries(theme.colors).forEach(([key, value]) => {
    root.style.setProperty(`--theme-${toKebab(key)}`, value);
  });
  root.style.setProperty("--theme-family", theme.family);
}

async function sampleImageColor(src) {
  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      const canvas = document.createElement("canvas");
      const width = 36;
      const height = Math.max(1, Math.round((image.naturalHeight / image.naturalWidth) * width));
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      context.drawImage(image, 0, 0, width, height);
      const pixels = context.getImageData(0, 0, width, height).data;
      const buckets = new Map();
      const shares = {
        red: 0,
        yellow: 0,
        green: 0,
        blue: 0,
        warm: 0,
        white: 0,
        total: 0
      };

      for (let i = 0; i < pixels.length; i += 16) {
        const [hue, saturation, lightness] = rgbToHsl(pixels[i], pixels[i + 1], pixels[i + 2]);
        if (lightness > 0.76 && saturation < 0.14) shares.white += 1;
        if (lightness < 0.08 || lightness > 0.94) continue;
        if (saturation < 0.04) continue;
        const bucket = Math.round(hue / 18) * 18;
        const weight = Math.max(0.2, saturation) * (0.45 + lightness);
        const current = buckets.get(bucket) || { hue: bucket, saturation: 0, lightness: 0, count: 0, weight: 0 };
        current.saturation += saturation;
        current.lightness += lightness;
        current.count += 1;
        current.weight += weight;
        buckets.set(bucket, current);
        shares.total += weight;

        if (hue < 18 || hue > 340) shares.red += weight;
        if (hue >= 18 && hue < 62) shares.warm += weight;
        if (hue >= 46 && hue < 82) shares.yellow += weight;
        if (hue >= 82 && hue < 168) shares.green += weight;
        if (hue >= 168 && hue < 255) shares.blue += weight;
      }

      const dominant = [...buckets.values()].sort((a, b) => b.weight - a.weight)[0];
      if (!dominant) {
        resolve({ hue: 205, saturation: 0.18, lightness: 0.45 });
        return;
      }

      const normalizedShares = Object.fromEntries(
        Object.entries(shares).map(([key, value]) => [key, key === "total" ? value : value / Math.max(shares.total, 1)])
      );

      resolve({
        hue: dominant.hue,
        saturation: dominant.saturation / dominant.count,
        lightness: dominant.lightness / dominant.count,
        shares: normalizedShares
      });
    };
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

function rgbToHsl(red, green, blue) {
  const r = red / 255;
  const g = green / 255;
  const b = blue / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let hue = 0;
  let saturation = 0;
  const lightness = (max + min) / 2;

  if (max !== min) {
    const delta = max - min;
    saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    switch (max) {
      case r:
        hue = (g - b) / delta + (g < b ? 6 : 0);
        break;
      case g:
        hue = (b - r) / delta + 2;
        break;
      default:
        hue = (r - g) / delta + 4;
    }
    hue *= 60;
  }

  return [hue, saturation, lightness];
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function toKebab(value) {
  return value.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
}

