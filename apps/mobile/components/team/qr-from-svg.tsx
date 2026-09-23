import { useMemo } from 'react';
import { View } from 'react-native';

interface Run {
  x: number;
  y: number;
  w: number;
}

/**
 * Parse the QR module path the API embeds in the official ID card SVG (`<path stroke=… d="M0 0.5h7m2 0h5…">`,
 * one horizontal stroke per run of dark modules). Returns null when the SVG has no such path — callers then show no QR.
 */
export function parseQrRuns(svg: string | null | undefined): { size: number; runs: Run[] } | null {
  if (!svg) return null;
  const m =
    /<path[^>]*stroke="[^"]*"[^>]*\sd="([^"]+)"/.exec(svg) ??
    /<path[^>]*\sd="(M0 0\.5h[^"]+)"/.exec(svg);
  if (!m?.[1]) return null;
  const tokens = m[1].match(/[MmHhVv]|-?\d*\.?\d+/g);
  if (!tokens) return null;
  const runs: Run[] = [];
  let x = 0;
  let y = 0;
  let i = 0;
  const num = () => Number(tokens[i++]);
  while (i < tokens.length) {
    const cmd = tokens[i++];
    if (cmd === 'M') {
      x = num();
      y = num();
    } else if (cmd === 'm') {
      x += num();
      y += num();
    } else if (cmd === 'h') {
      const w = num();
      runs.push({ x: w >= 0 ? x : x + w, y: Math.floor(y), w: Math.abs(w) });
      x += w;
    } else if (cmd === 'H') {
      const nx = num();
      runs.push({ x: Math.min(x, nx), y: Math.floor(y), w: Math.abs(nx - x) });
      x = nx;
    } else {
      return null;
    }
  }
  if (runs.length === 0) return null;
  const size = Math.max(...runs.map((r) => Math.max(r.x + r.w, r.y + 1)));
  return { size, runs };
}

/** Renders the server-generated verification QR with plain Views (no SVG dependency). */
export function QrFromSvg({ svg, size = 120 }: { svg: string | null | undefined; size?: number }) {
  const qr = useMemo(() => parseQrRuns(svg), [svg]);
  if (!qr) return null;
  const s = size / qr.size;
  return (
    <View
      accessibilityLabel="Verification QR code"
      style={{ width: size, height: size, backgroundColor: '#fff' }}
    >
      {qr.runs.map((r, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left: r.x * s,
            top: r.y * s,
            width: r.w * s + 0.35,
            height: s + 0.35,
            backgroundColor: '#0B1533',
          }}
        />
      ))}
    </View>
  );
}
