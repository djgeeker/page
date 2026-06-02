const canvas = document.querySelector("#motionField");
const context = canvas.getContext("2d");
const points = [];
const pointer = { x: 0.5, y: 0.5 };
const isTechBlogPage = document.body.classList.contains("tech-blog-page");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let width = 0;
let height = 0;
let frame = 0;
let threeReady = false;

resize();
window.addEventListener("resize", resize);
// The canvas is fixed at width/height:100%, so its box excludes the scrollbar.
// Observe it directly so the field re-fits when a scrollbar appears/disappears
// (e.g. after async article content loads) — window "resize" won't fire then.
new ResizeObserver(resize).observe(canvas);
window.addEventListener("pointermove", (event) => {
  pointer.x = event.clientX / Math.max(window.innerWidth, 1);
  pointer.y = event.clientY / Math.max(window.innerHeight, 1);
});

requestAnimationFrame(draw);
requestAnimationFrame(scrollToRequestedSection);
initDecorativeMoon();
initMoonVideo();
initThreeField();

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  // Use the canvas's own laid-out box (CSS width/height:100%, which excludes the
  // scrollbar) instead of window.innerWidth/innerHeight (which include it).
  // Otherwise the backing buffer is wider than the visible area and the field
  // renders off-center on scrollable pages.
  width = canvas.clientWidth || window.innerWidth;
  height = canvas.clientHeight || window.innerHeight;
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  seedPoints();
}

function seedPoints() {
  points.length = 0;
  const count = isTechBlogPage
    ? Math.max(30, Math.round((width * height) / 40000))
    : Math.max(52, Math.round((width * height) / 20000));

  for (let i = 0; i < count; i += 1) {
    if (!isTechBlogPage) {
      points.push({
        mode: "star",
        x: Math.random() * width,
        y: Math.random() * height,
        phase: Math.random() * Math.PI * 2,
        speed: 0.0012 + Math.random() * 0.0018,
        radius: 1.05 + Math.random() * 1.75,
        alpha: 0.08 + Math.random() * 0.11
      });
      continue;
    }

    const cool = Math.random() > 0.42;
    points.push({
      mode: "firefly",
      x: Math.random() * width,
      y: Math.random() * height,
      phase: Math.random() * Math.PI * 2,
      speed: 0.012 + Math.random() * 0.018,
      radius: 2.6 + Math.random() * 3.4,
      glowRadius: 22 + Math.random() * 34,
      alpha: 0.11 + Math.random() * 0.14,
      vx: (Math.random() - 0.5) * 0.28,
      vy: (Math.random() - 0.5) * 0.18,
      wander: 0.18 + Math.random() * 0.32,
      color: cool
        ? { core: "232, 242, 255", halo: "118, 164, 238" }
        : { core: "246, 249, 255", halo: "168, 198, 255" }
    });
  }
}

function draw() {
  frame += 1;
  context.clearRect(0, 0, width, height);
  context.lineWidth = 1;
  context.globalCompositeOperation = isTechBlogPage ? "lighter" : "source-over";

  const driftX = (pointer.x - 0.5) * (isTechBlogPage ? 12 : 28);
  const driftY = (pointer.y - 0.5) * (isTechBlogPage ? 8 : 28);

  points.forEach((point, index) => {
    if (point.mode === "star") {
      const pulse = Math.sin(frame * point.speed * 2.8 + point.phase);
      const x = point.x + pulse * 24 + driftX;
      const y = point.y + Math.cos(frame * point.speed * 2.2 + point.phase) * 18 + driftY;

      context.beginPath();
      context.arc(x, y, point.radius, 0, Math.PI * 2);
      context.fillStyle = `rgba(190, 210, 255, ${threeReady ? point.alpha * 0.45 : point.alpha})`;
      context.fill();
      return;
    }

    const pulse = Math.sin(frame * point.speed + point.phase);
    const floatX = Math.sin(frame * point.speed * 0.73 + point.phase) * point.wander;
    const floatY = Math.cos(frame * point.speed * 0.91 + point.phase) * point.wander;
    point.x += point.vx + floatX;
    point.y += point.vy + floatY;

    if (point.x < -point.glowRadius) point.x = width + point.glowRadius;
    if (point.x > width + point.glowRadius) point.x = -point.glowRadius;
    if (point.y < -point.glowRadius) point.y = height + point.glowRadius;
    if (point.y > height + point.glowRadius) point.y = -point.glowRadius;

    const x = point.x + driftX;
    const y = point.y + driftY;
    const alpha = point.alpha * (0.58 + Math.max(0, pulse) * 0.62);

    const glow = context.createRadialGradient(x, y, 0, x, y, point.glowRadius);
    glow.addColorStop(0, `rgba(${point.color.core}, ${alpha * 0.78})`);
    glow.addColorStop(0.18, `rgba(${point.color.core}, ${alpha * 0.34})`);
    glow.addColorStop(0.58, `rgba(${point.color.halo}, ${alpha * 0.12})`);
    glow.addColorStop(1, `rgba(${point.color.halo}, 0)`);
    context.beginPath();
    context.arc(x, y, point.glowRadius, 0, Math.PI * 2);
    context.fillStyle = glow;
    context.fill();

    context.beginPath();
    context.arc(x, y, point.radius, 0, Math.PI * 2);
    context.fillStyle = `rgba(${point.color.core}, ${Math.min(alpha * 1.1, 0.68)})`;
    context.fill();
  });

  context.globalCompositeOperation = "source-over";
  // In reduced-motion mode render a single static frame instead of looping.
  if (!prefersReducedMotion) requestAnimationFrame(draw);
}

function scrollToRequestedSection() {
  const params = new URLSearchParams(window.location.search);
  const targetId = params.get("view") || window.location.hash.slice(1);
  if (!targetId) return;

  const target = document.getElementById(targetId);
  if (!target) return;

  window.setTimeout(() => {
    target.scrollIntoView({ block: "start" });
  }, 180);
}

function initDecorativeMoon() {
  const mount = document.querySelector("[data-decorative-moon]");
  if (!mount) return;

  const media = window.matchMedia("(orientation: landscape) and (min-width: 761px)");
  const sync = () => {
    const existing = mount.querySelector(".celestial-link");
    if (!media.matches) {
      existing?.remove();
      return;
    }

    if (existing) return;

    const bodyName = mount.dataset.decorativeBody || "mars";
    const sources = {
      mars: "./assets/mars-rotation-720p.mp4",
      saturn: "./assets/saturn-spinning-jpl.m4v",
      jupiter: "./assets/jupiter-globe-rotation-loop.mp4"
    };
    const link = document.createElement("a");
    link.className = `celestial-link ${bodyName}-link`;
    link.href = "./blog.html#about-me";
    link.setAttribute("aria-label", "Back to About Me");

    const video = document.createElement("video");
    video.className = `moon ${bodyName}`;
    video.autoplay = true;
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = "auto";

    const source = document.createElement("source");
    source.src = sources[bodyName] || sources.mars;
    source.type = "video/mp4";
    video.appendChild(source);
    link.appendChild(video);
    mount.appendChild(link);
    initMoonVideo(video);
  };

  sync();
  media.addEventListener("change", sync);
}

function initMoonVideo(video = document.querySelector(".moon")) {
  if (!video) return;
  if (video.dataset.moonReady === "true") return;
  video.dataset.moonReady = "true";

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    video.pause();
    return;
  }

  const targetRotationSeconds = 8;
  const syncPlaybackRate = () => {
    if (Number.isFinite(video.duration) && video.duration > targetRotationSeconds) {
      video.playbackRate = video.duration / targetRotationSeconds;
    }
  };

  video.addEventListener("loadedmetadata", syncPlaybackRate, { once: true });
  syncPlaybackRate();
  video.play().catch(() => {});
}

async function initThreeField() {
  const mount = document.querySelector("#threeField");
  if (!mount || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  try {
    const THREE = await import("./vendor/three.module.js");
    threeReady = true;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 0, 6.6);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.92;
    renderer.domElement.setAttribute("aria-hidden", "true");
    mount.appendChild(renderer.domElement);

    const geometry = new THREE.BufferGeometry();
    const particleCount = window.innerWidth < 700 ? 220 : 460;
    const positions = new Float32Array(particleCount * 3);
    const basePositions = new Float32Array(particleCount * 3);
    const phases = new Float32Array(particleCount);
    const speeds = new Float32Array(particleCount);
    const amplitudes = new Float32Array(particleCount);
    const colors = new Float32Array(particleCount * 3);
    const colorA = new THREE.Color("#8fb7ff");
    const colorB = new THREE.Color("#a78bfa");
    const colorC = new THREE.Color("#f7f1e2");

    let cursor = 0;
    let colorCursor = 0;
    for (let i = 0; i < particleCount; i += 1) {
      const px = (Math.random() - 0.5) * 18.6;
      const py = (Math.random() - 0.5) * 10.4;
      const pz = -0.9 - Math.random() * 2.8;
      phases[i] = Math.random() * Math.PI * 2;
      speeds[i] = 0.00012 + Math.random() * 0.00016;
      amplitudes[i] = 0.08 + Math.random() * 0.2;

      positions[cursor] = px;
      basePositions[cursor++] = px;
      positions[cursor] = py;
      basePositions[cursor++] = py;
      positions[cursor] = pz;
      basePositions[cursor++] = pz;

      const tint = Math.random();
      const color = tint < 0.34
        ? colorA.clone().lerp(colorC, 0.68)
        : tint < 0.68
          ? colorB.clone().lerp(colorC, 0.72)
          : colorC.clone();
      colors[colorCursor++] = color.r;
      colors[colorCursor++] = color.g;
      colors[colorCursor++] = color.b;
    }

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.05,
      vertexColors: true,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    const ambientField = new THREE.Points(geometry, material);
    scene.add(ambientField);

    const resizeThree = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
    };
    window.addEventListener("resize", resizeThree);

    const animate = (time) => {
      const position = geometry.attributes.position;
      for (let i = 0; i < position.count; i += 1) {
        const baseIndex = i * 3;
        const phase = phases[i];
        const speed = speeds[i];
        const amplitude = amplitudes[i];
        position.setX(i, basePositions[baseIndex] + Math.sin(time * speed + phase) * amplitude);
        position.setY(i, basePositions[baseIndex + 1] + Math.cos(time * speed * 1.17 + phase) * amplitude);
        position.setZ(i, basePositions[baseIndex + 2] + Math.sin(time * speed * 1.41 + phase) * amplitude * 0.72);
      }
      position.needsUpdate = true;

      ambientField.position.x = (pointer.x - 0.5) * 0.12;
      ambientField.position.y = (pointer.y - 0.5) * -0.08;
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  } catch {
    threeReady = false;
  }
}
