// Toroidal void-and-cluster rank map, generated once per renderer (Ulichney).
export function blueNoise(size = 64): Uint8Array {
  const n = size * size,
    occupied = new Uint8Array(n),
    density = new Float32Array(n),
    rank = new Uint16Array(n);
  let seed = 73821;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const order = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const kernel: number[][] = [];
  for (let dy = -6; dy <= 6; dy++)
    for (let dx = -6; dx <= 6; dx++)
      kernel.push([dx, dy, Math.exp(-(dx * dx + dy * dy) / (2 * 1.9 ** 2))]);
  const update = (i: number, sign: number) => {
    const x = i % size,
      y = Math.floor(i / size);
    occupied[i] = sign > 0 ? 1 : 0;
    for (const [dx, dy, v] of kernel)
      density[((y + dy + size) % size) * size + ((x + dx + size) % size)] +=
        sign * v;
  };
  const pick = (full: boolean) => {
    let best = -1,
      value = full ? -Infinity : Infinity;
    for (let i = 0; i < n; i++)
      if (
        !!occupied[i] === full &&
        (full ? density[i] > value : density[i] < value)
      ) {
        best = i;
        value = density[i];
      }
    return best;
  };
  for (let i = 0; i < n / 2; i++) update(order[i], 1);
  for (let i = 0; i < n; i++) {
    const cluster = pick(true);
    update(cluster, -1);
    const hole = pick(false);
    update(hole, 1);
    if (cluster === hole) break;
  }
  const initial = occupied.slice();
  for (let r = n / 2 - 1; r >= 0; r--) {
    const i = pick(true);
    rank[i] = r;
    update(i, -1);
  }
  density.fill(0);
  occupied.fill(0);
  for (let i = 0; i < n; i++) if (initial[i]) update(i, 1);
  for (let r = n / 2; r < n; r++) {
    const i = pick(false);
    rank[i] = r;
    update(i, 1);
  }
  return Uint8Array.from(rank, (r) => Math.floor((r * 256) / n));
}
