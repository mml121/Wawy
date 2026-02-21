/**
 * Renderer — draws orbital probability density on canvas.
 * Supports 2D cross-section heatmap and 3D point cloud.
 */

const Renderer = (function () {
  let canvas, ctx;
  let dpr = 1;
  let mode = '2d'; // '2d' or '3d'
  let rotation = { theta: 0.5, phi: 0.3 };
  let autoRotate = true;

  // Color map: black → blue → cyan → white (cool scientific look)
  function densityColor(t) {
    // t is 0..1 (normalized density)
    // Apply gamma for better visibility of low-density regions
    t = Math.pow(t, 0.35);

    let r, g, b;
    if (t < 0.25) {
      const s = t / 0.25;
      r = 0;
      g = 0;
      b = Math.floor(s * 180);
    } else if (t < 0.5) {
      const s = (t - 0.25) / 0.25;
      r = 0;
      g = Math.floor(s * 200);
      b = 180 + Math.floor(s * 75);
    } else if (t < 0.75) {
      const s = (t - 0.5) / 0.25;
      r = Math.floor(s * 200);
      g = 200 + Math.floor(s * 55);
      b = 255;
    } else {
      const s = (t - 0.75) / 0.25;
      r = 200 + Math.floor(s * 55);
      g = 255;
      b = 255;
    }
    return (255 << 24) | (b << 16) | (g << 8) | r; // ABGR for ImageData
  }

  function init(canvasEl) {
    canvas = canvasEl;
    ctx = canvas.getContext('2d');
    dpr = window.devicePixelRatio || 1;
    resize();
    window.addEventListener('resize', resize);
  }

  function resize() {
    const wrapper = canvas.parentElement;
    const w = wrapper.clientWidth;
    const h = wrapper.clientHeight;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    Simulation.setConfig({ width: w, height: h });
  }

  function draw2D() {
    const data = Simulation.getDensityGrid();
    if (!data.grid) return;

    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    const res = data.resolution;
    const max = data.max;

    // Clear
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, w, h);

    if (max === 0) return;

    // Create ImageData at grid resolution, then scale
    const imgData = ctx.createImageData(res, res);
    const buf = new ArrayBuffer(imgData.data.length);
    const buf32 = new Uint32Array(buf);
    const buf8 = new Uint8Array(buf);

    for (let i = 0; i < res * res; i++) {
      const t = data.grid[i] / max;
      buf32[i] = densityColor(t);
    }

    imgData.data.set(buf8);

    // Draw at grid resolution then scale to canvas
    const offscreen = document.createElement('canvas');
    offscreen.width = res;
    offscreen.height = res;
    const offCtx = offscreen.getContext('2d');
    offCtx.putImageData(imgData, 0, 0);

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(offscreen, 0, 0, w, h);

    // Draw axis labels
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '11px "Roboto Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('x', w / 2, h - 8);
    ctx.save();
    ctx.translate(12, h / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('z', 0, 0);
    ctx.restore();

    // Center crosshair
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(w / 2, 0);
    ctx.lineTo(w / 2, h);
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();
  }

  function draw3D(pointCloud) {
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;

    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, w, h);

    if (!pointCloud || !pointCloud.points.length) return;

    const { points, extent } = pointCloud;
    const cosT = Math.cos(rotation.theta);
    const sinT = Math.sin(rotation.theta);
    const cosP = Math.cos(rotation.phi);
    const sinP = Math.sin(rotation.phi);

    const scale = Math.min(w, h) / (extent * 2.5);
    const cx = w / 2;
    const cy = h / 2;

    // Sort by depth for proper alpha blending
    const projected = [];
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      // Rotate around Y then X
      const x1 = p.x * cosP - p.z * sinP;
      const z1 = p.x * sinP + p.z * cosP;
      const y1 = p.y * cosT - z1 * sinT;
      const z2 = p.y * sinT + z1 * cosT;

      const radius = Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z);

      projected.push({
        sx: cx + x1 * scale,
        sy: cy - y1 * scale,
        depth: z2,
        density: p.density,
        radius: radius,
      });
    }

    // Find max radius for normalization
    let maxRadius = 0;
    for (let i = 0; i < projected.length; i++) {
      if (projected[i].radius > maxRadius) maxRadius = projected[i].radius;
    }
    if (maxRadius === 0) maxRadius = 1;

    projected.sort((a, b) => a.depth - b.depth);

    // Draw points with heatmap coloring based on proximity to center
    for (let i = 0; i < projected.length; i++) {
      const p = projected[i];
      const t = 1 - (p.radius / maxRadius); // 1 = close to center, 0 = far
      const alpha = 0.3 + 0.7 * (p.depth / extent + 1) / 2;

      // Heatmap: red (close) -> yellow -> green -> cyan -> blue (far)
      let r, g, b;
      if (t > 0.75) {
        const s = (t - 0.75) / 0.25;
        r = 255;
        g = Math.floor((1 - s) * 200);
        b = 60;
      } else if (t > 0.5) {
        const s = (t - 0.5) / 0.25;
        r = Math.floor(s * 255);
        g = 200 + Math.floor(s * 55);
        b = 60;
      } else if (t > 0.25) {
        const s = (t - 0.25) / 0.25;
        r = 0;
        g = 180 + Math.floor(s * 75);
        b = Math.floor((1 - s) * 200 + 60);
      } else {
        const s = t / 0.25;
        r = 0;
        g = Math.floor(s * 180);
        b = 180 + Math.floor((1 - s) * 75);
      }

      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha * 0.7})`;
      ctx.beginPath();
      ctx.arc(p.sx, p.sy, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw axes
    const axisLen = extent * 0.6 * scale;
    const axes = [
      { dir: [1, 0, 0], label: 'x', color: 'rgba(255,100,100,0.5)' },
      { dir: [0, 1, 0], label: 'y', color: 'rgba(100,255,100,0.5)' },
      { dir: [0, 0, 1], label: 'z', color: 'rgba(100,100,255,0.5)' },
    ];

    ctx.lineWidth = 1;
    ctx.font = '11px "Roboto Mono", monospace';
    for (const axis of axes) {
      const [ax, ay, az] = axis.dir;
      const x1 = ax * cosP - az * sinP;
      const z1 = ax * sinP + az * cosP;
      const y1 = ay * cosT - z1 * sinT;

      ctx.strokeStyle = axis.color;
      ctx.fillStyle = axis.color;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + x1 * axisLen, cy - y1 * axisLen);
      ctx.stroke();
      ctx.fillText(axis.label, cx + x1 * axisLen + 8, cy - y1 * axisLen + 4);
    }
  }

  function setMode(m) {
    mode = m;
  }

  function getMode() {
    return mode;
  }

  function setRotation(t, p) {
    rotation.theta = t;
    rotation.phi = p;
  }

  function getRotation() {
    return rotation;
  }

  return { init, resize, draw2D, draw3D, setMode, getMode, setRotation, getRotation };
})();
