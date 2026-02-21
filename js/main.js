/**
 * Main — Controls wiring, view switching, interaction.
 */

(function () {
  // ---- Elements ----
  const canvas = document.getElementById('simulation-canvas');
  const fpsDisplay = document.getElementById('fps-display');

  const btnStart = document.getElementById('btn-start');
  const btnPause = document.getElementById('btn-pause');
  const btnReset = document.getElementById('btn-reset');

  const inputN = document.getElementById('input-n');
  const inputL = document.getElementById('input-l');
  const inputM = document.getElementById('input-m');
  const sliderZoom = document.getElementById('slider-zoom');
  const zoomValue = document.getElementById('zoom-value');

  const btnMode2D = document.getElementById('btn-mode-2d');
  const btnMode3D = document.getElementById('btn-mode-3d');

  const orbitalLabel = document.getElementById('orbital-label');

  const menuToggle = document.getElementById('menu-toggle');
  const nav = document.getElementById('nav');

  // ---- State ----
  let rotating = true;
  let animFrameId = null;
  let pointCloud = null;
  let isDragging = false;
  let lastMouse = { x: 0, y: 0 };

  // ---- Orbital name lookup ----
  const subshellNames = ['s', 'p', 'd', 'f', 'g', 'h'];

  function getOrbitalName(n, l, m) {
    const sub = subshellNames[l] || '?';
    return n + sub + ' (m=' + m + ')';
  }

  function updateOrbitalLabel() {
    const cfg = Simulation.getConfig();
    orbitalLabel.textContent = getOrbitalName(cfg.n, cfg.l, cfg.m);
  }

  // ---- Quantum number constraints ----
  function enforceConstraints() {
    const n = parseInt(inputN.value, 10);
    const maxL = n - 1;

    inputL.max = maxL;
    if (parseInt(inputL.value, 10) > maxL) {
      inputL.value = maxL;
    }

    const l = parseInt(inputL.value, 10);
    inputM.min = -l;
    inputM.max = l;
    if (parseInt(inputM.value, 10) > l) inputM.value = l;
    if (parseInt(inputM.value, 10) < -l) inputM.value = -l;
  }

  // ---- Compute & render ----
  function recompute() {
    enforceConstraints();
    const n = parseInt(inputN.value, 10);
    const l = parseInt(inputL.value, 10);
    const m = parseInt(inputM.value, 10);
    const zoom = parseFloat(sliderZoom.value);

    Simulation.setConfig({ n, l, m, zoom });
    updateOrbitalLabel();

    if (Renderer.getMode() === '3d') {
      pointCloud = Simulation.computePointCloud(8000);
    }

    render();
  }

  function render() {
    if (Renderer.getMode() === '2d') {
      Renderer.draw2D();
    } else {
      Renderer.draw3D(pointCloud);
    }
  }

  // ---- 3D rotation loop ----
  function rotationLoop() {
    if (Renderer.getMode() === '3d' && rotating && !isDragging) {
      const rot = Renderer.getRotation();
      Renderer.setRotation(rot.theta, rot.phi + 0.008);
      render();
    }
    animFrameId = requestAnimationFrame(rotationLoop);
  }

  // ---- Init ----
  Renderer.init(canvas);
  Simulation.init();
  updateOrbitalLabel();
  render();
  animFrameId = requestAnimationFrame(rotationLoop);

  // ---- Quantum number inputs ----
  inputN.addEventListener('change', recompute);
  inputL.addEventListener('change', recompute);
  inputM.addEventListener('change', recompute);

  sliderZoom.addEventListener('input', function () {
    zoomValue.textContent = parseFloat(this.value).toFixed(1) + 'x';
    recompute();
  });

  // ---- View mode ----
  btnMode2D.addEventListener('click', function () {
    btnMode2D.classList.add('active');
    btnMode3D.classList.remove('active');
    Renderer.setMode('2d');
    recompute();
  });

  btnMode3D.addEventListener('click', function () {
    btnMode3D.classList.add('active');
    btnMode2D.classList.remove('active');
    Renderer.setMode('3d');
    pointCloud = Simulation.computePointCloud(8000);
    render();
  });

  // ---- Control buttons ----
  btnStart.addEventListener('click', function () {
    rotating = true;
  });

  btnPause.addEventListener('click', function () {
    rotating = false;
  });

  btnReset.addEventListener('click', function () {
    inputN.value = 2;
    inputL.value = 1;
    inputM.value = 0;
    sliderZoom.value = 1;
    zoomValue.textContent = '1.0x';
    Renderer.setRotation(0.5, 0.3);
    rotating = true;
    recompute();
  });

  // ---- Mouse drag for 3D rotation ----
  canvas.addEventListener('mousedown', function (e) {
    if (Renderer.getMode() !== '3d') return;
    isDragging = true;
    lastMouse = { x: e.clientX, y: e.clientY };
  });

  window.addEventListener('mousemove', function (e) {
    if (!isDragging) return;
    const dx = e.clientX - lastMouse.x;
    const dy = e.clientY - lastMouse.y;
    const rot = Renderer.getRotation();
    Renderer.setRotation(
      rot.theta + dy * 0.005,
      rot.phi + dx * 0.005
    );
    lastMouse = { x: e.clientX, y: e.clientY };
    render();
  });

  window.addEventListener('mouseup', function () {
    isDragging = false;
  });

  // Touch support
  canvas.addEventListener('touchstart', function (e) {
    if (Renderer.getMode() !== '3d') return;
    isDragging = true;
    lastMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  });

  canvas.addEventListener('touchmove', function (e) {
    if (!isDragging) return;
    e.preventDefault();
    const dx = e.touches[0].clientX - lastMouse.x;
    const dy = e.touches[0].clientY - lastMouse.y;
    const rot = Renderer.getRotation();
    Renderer.setRotation(rot.theta + dy * 0.005, rot.phi + dx * 0.005);
    lastMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    render();
  }, { passive: false });

  canvas.addEventListener('touchend', function () {
    isDragging = false;
  });

  // ---- Presets ----
  document.querySelectorAll('.preset-chip').forEach(function (chip) {
    chip.addEventListener('click', function () {
      inputN.value = this.dataset.n;
      inputL.value = this.dataset.l;
      inputM.value = this.dataset.m;
      recompute();
    });
  });

  // ---- Mobile Menu ----
  menuToggle.addEventListener('click', function () {
    nav.classList.toggle('open');
  });

  // ---- Scroll Animations ----
  const observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      });
    },
    { threshold: 0.1 }
  );

  document.querySelectorAll('.animate-on-scroll').forEach(function (el) {
    observer.observe(el);
  });
})();
