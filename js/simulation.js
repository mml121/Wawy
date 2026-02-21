/**
 * Quantum Orbital Simulation
 * Computes hydrogen-like atomic orbital probability densities
 * from quantum numbers (n, l, m).
 */

const Simulation = (function () {
  let config = {
    n: 2,
    l: 1,
    m: 0,
    resolution: 300,
    zoom: 1,
    width: 600,
    height: 600,
  };

  let densityGrid = null;
  let maxDensity = 0;

  // ---- Math helpers ----

  function factorial(n) {
    if (n <= 1) return 1;
    let r = 1;
    for (let i = 2; i <= n; i++) r *= i;
    return r;
  }

  // Associated Laguerre polynomial L_p^k(x) via recurrence
  function laguerre(p, k, x) {
    if (p === 0) return 1;
    if (p === 1) return 1 + k - x;
    let prev2 = 1;
    let prev1 = 1 + k - x;
    let curr;
    for (let i = 2; i <= p; i++) {
      curr = ((2 * i - 1 + k - x) * prev1 - (i - 1 + k) * prev2) / i;
      prev2 = prev1;
      prev1 = curr;
    }
    return prev1;
  }

  // Associated Legendre polynomial P_l^m(x), m >= 0
  function legendreP(l, m, x) {
    // P_m^m
    let pmm = 1;
    if (m > 0) {
      const somx2 = Math.sqrt(1 - x * x);
      let fact = 1;
      for (let i = 1; i <= m; i++) {
        pmm *= -fact * somx2;
        fact += 2;
      }
    }
    if (l === m) return pmm;

    // P_{m+1}^m
    let pmm1 = x * (2 * m + 1) * pmm;
    if (l === m + 1) return pmm1;

    // Recurrence
    let pll;
    for (let ll = m + 2; ll <= l; ll++) {
      pll = (x * (2 * ll - 1) * pmm1 - (ll + m - 1) * pmm) / (ll - m);
      pmm = pmm1;
      pmm1 = pll;
    }
    return pmm1;
  }

  // Radial wavefunction R_nl(r) for hydrogen atom
  // r is in units of Bohr radii
  function radialR(n, l, r) {
    const rho = (2 * r) / n;
    const normSq =
      (Math.pow(2 / n, 3) * factorial(n - l - 1)) /
      (2 * n * Math.pow(factorial(n + l), 3));
    const norm = Math.sqrt(normSq);
    const L = laguerre(n - l - 1, 2 * l + 1, rho);
    return norm * Math.exp(-rho / 2) * Math.pow(rho, l) * L;
  }

  // Spherical harmonic Y_l^m(theta, phi) — real form
  function sphericalY(l, m, theta, phi) {
    const absM = Math.abs(m);
    const normFactor = Math.sqrt(
      ((2 * l + 1) / (4 * Math.PI)) *
      (factorial(l - absM) / factorial(l + absM))
    );
    const P = legendreP(l, absM, Math.cos(theta));

    if (m > 0) {
      return normFactor * Math.SQRT2 * P * Math.cos(m * phi);
    } else if (m < 0) {
      return normFactor * Math.SQRT2 * P * Math.sin(absM * phi);
    }
    return normFactor * P;
  }

  // Full wavefunction ψ(r, theta, phi)
  function psi(n, l, m, r, theta, phi) {
    if (r < 1e-10) r = 1e-10;
    return radialR(n, l, r) * sphericalY(l, m, theta, phi);
  }

  // Probability density |ψ|²
  function probabilityDensity(n, l, m, r, theta, phi) {
    const val = psi(n, l, m, r, theta, phi);
    return val * val;
  }

  // ---- Compute the density grid (xz-plane cross section) ----

  function compute() {
    const { n, l, m, resolution, zoom, width, height } = config;
    const res = resolution;

    // Scale: how many Bohr radii to show
    // Orbital extent scales roughly as n² * (1 + some factor)
    const extent = (n * n * 2.5 + 5) / zoom;

    densityGrid = new Float64Array(res * res);
    maxDensity = 0;

    for (let iy = 0; iy < res; iy++) {
      for (let ix = 0; ix < res; ix++) {
        // Map pixel to physical coordinates (xz-plane, y=0)
        const x = ((ix / (res - 1)) * 2 - 1) * extent;
        const z = ((1 - iy / (res - 1)) * 2 - 1) * extent;

        const r = Math.sqrt(x * x + z * z);
        const theta = Math.acos(z / (r + 1e-20));
        const phi = Math.atan2(0, x); // y=0 plane, so phi = atan2(0, x)

        const density = probabilityDensity(n, l, m, r, theta, phi);
        densityGrid[iy * res + ix] = density;

        if (density > maxDensity) maxDensity = density;
      }
    }
  }

  // Compute 3D point cloud by sampling from probability density
  function computePointCloud(numPoints) {
    const { n, l, m, zoom } = config;
    const extent = (n * n * 2.5 + 5) / zoom;
    const points = [];
    let attempts = 0;
    const maxAttempts = numPoints * 50;

    // First pass: find max density for rejection sampling
    let sampleMax = 0;
    for (let i = 0; i < 2000; i++) {
      const x = (Math.random() * 2 - 1) * extent;
      const y = (Math.random() * 2 - 1) * extent;
      const z = (Math.random() * 2 - 1) * extent;
      const r = Math.sqrt(x * x + y * y + z * z);
      const theta = Math.acos(z / (r + 1e-20));
      const phi = Math.atan2(y, x);
      const d = probabilityDensity(n, l, m, r, theta, phi);
      if (d > sampleMax) sampleMax = d;
    }
    sampleMax *= 1.1;

    while (points.length < numPoints && attempts < maxAttempts) {
      attempts++;
      const x = (Math.random() * 2 - 1) * extent;
      const y = (Math.random() * 2 - 1) * extent;
      const z = (Math.random() * 2 - 1) * extent;
      const r = Math.sqrt(x * x + y * y + z * z);
      const theta = Math.acos(z / (r + 1e-20));
      const phi = Math.atan2(y, x);
      const d = probabilityDensity(n, l, m, r, theta, phi);

      if (Math.random() < d / (sampleMax + 1e-30)) {
        points.push({ x, y, z, density: d });
      }
    }

    return { points, extent };
  }

  function init() {
    compute();
  }

  function setConfig(newConfig) {
    const changed =
      newConfig.n !== undefined && newConfig.n !== config.n ||
      newConfig.l !== undefined && newConfig.l !== config.l ||
      newConfig.m !== undefined && newConfig.m !== config.m ||
      newConfig.zoom !== undefined && newConfig.zoom !== config.zoom ||
      newConfig.resolution !== undefined && newConfig.resolution !== config.resolution;

    Object.assign(config, newConfig);

    // Enforce quantum number constraints
    if (config.l >= config.n) config.l = config.n - 1;
    if (Math.abs(config.m) > config.l) config.m = 0;

    if (changed) compute();
  }

  function getDensityGrid() {
    return { grid: densityGrid, max: maxDensity, resolution: config.resolution };
  }

  function getConfig() {
    return config;
  }

  return {
    init,
    setConfig,
    compute,
    computePointCloud,
    getDensityGrid,
    getConfig,
  };
})();
