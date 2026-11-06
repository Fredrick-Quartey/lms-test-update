/**
 * Original drawn scenes for the home page and the sign-in pictures (no stock images needed).
 * Decorative only: every scene is aria-hidden. Motion stops with the Pause button (.motion-paused)
 * and with the system "reduce motion" setting (index.css), as WCAG 2.2.2 asks.
 */
import { useMemo } from 'react';

/** Rising soap bubbles; positions are fixed per mount so the layout never jumps. */
export function Bubbles({ count = 14, className = '' }: { count?: number; className?: string }) {
  const bubbles = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const r = (n: number) => ((Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1 + 1) % 1; // stable pseudo-random
        return { left: `${4 + r(1) * 92}%`, size: 8 + Math.round(r(2) * 26), dur: 10 + r(3) * 10, delay: -r(4) * 20 };
      }),
    [count],
  );
  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      {bubbles.map((b, i) => (
        <span key={i} className="bubble" style={{ left: b.left, width: b.size, height: b.size, animationDuration: `${b.dur}s`, animationDelay: `${b.delay}s` }} />
      ))}
    </div>
  );
}

/** The home page backdrop: the round glass door of a washing machine, clothes turning slowly behind it. */
export function DrumScene() {
  const bolts = Array.from({ length: 24 }, (_, i) => {
    const a = (i / 24) * Math.PI * 2;
    return [500 + Math.cos(a) * 466, 500 + Math.sin(a) * 466];
  });
  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden bg-[radial-gradient(120%_90%_at_50%_45%,#16306f_0%,#0b1b3f_55%,#060f26_100%)]">
      <svg
        viewBox="0 0 1000 1000"
        className="absolute left-1/2 top-1/2 h-[max(118vmin,560px)] w-[max(118vmin,560px)] -translate-x-1/2 -translate-y-1/2"
      >
        <defs>
          <radialGradient id="bezel" cx="38%" cy="30%" r="80%">
            <stop offset="0" stopColor="#3a5fb8" />
            <stop offset="0.55" stopColor="#1c3678" />
            <stop offset="1" stopColor="#0d1d48" />
          </radialGradient>
          <radialGradient id="glass" cx="50%" cy="42%" r="62%">
            <stop offset="0" stopColor="#1a4aa8" />
            <stop offset="0.6" stopColor="#0f2c74" />
            <stop offset="1" stopColor="#081944" />
          </radialGradient>
          <linearGradient id="water" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#19a7b8" stopOpacity="0.55" />
            <stop offset="1" stopColor="#19a7b8" stopOpacity="0.15" />
          </linearGradient>
          <clipPath id="glass-clip">
            <circle cx="500" cy="500" r="392" />
          </clipPath>
        </defs>

        {/* door bezel with bolts and a handle */}
        <circle cx="500" cy="500" r="492" fill="url(#bezel)" />
        <circle cx="500" cy="500" r="492" fill="none" stroke="#ffffff" strokeOpacity="0.08" strokeWidth="2" />
        {bolts.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="5" fill="#0b1b3f" fillOpacity="0.55" />
        ))}
        <rect x="954" y="440" width="30" height="120" rx="15" fill="#0d1d48" stroke="#ffffff" strokeOpacity="0.12" />
        <circle cx="500" cy="500" r="430" fill="#0a1a44" />
        <circle cx="500" cy="500" r="430" fill="none" stroke="#ffffff" strokeOpacity="0.1" strokeWidth="3" />

        {/* inside the glass */}
        <circle cx="500" cy="500" r="392" fill="url(#glass)" />
        <g clipPath="url(#glass-clip)">
          {/* drum holes, turning */}
          <g className="spin-slower" opacity="0.22">
            {Array.from({ length: 6 }, (_, ring) =>
              Array.from({ length: 10 + ring * 6 }, (_, i) => {
                const rr = 90 + ring * 52;
                const a = (i / (10 + ring * 6)) * Math.PI * 2 + ring;
                return <circle key={`${ring}-${i}`} cx={500 + Math.cos(a) * rr} cy={500 + Math.sin(a) * rr} r="5" fill="#9fc0ff" />;
              }),
            )}
          </g>
          {/* clothes tumbling */}
          <g className="spin-slow">
            <path d="M330 300c40-30 90-26 120 6l22 24-40 34-20-18v108h-92V346l-20 18-38-34 24-24c12-6 28-6 44-6z" fill="#ffffff" fillOpacity="0.16" transform="rotate(-18 400 380)" />
            <path d="M590 560c30-8 64-4 92 10 24 12 36 36 32 62l-12 70H560l-6-68c-2-34 8-64 36-74z" fill="#f2c94c" fillOpacity="0.2" transform="rotate(24 640 630)" />
            <path d="M600 260c26-14 58-14 84 0l50 28-22 40-30-14v96h-82v-96l-30 14-22-40z" fill="#19a7b8" fillOpacity="0.32" transform="rotate(30 650 330)" />
            <path d="M300 600h140l18 150h-60l-10-80-12 80h-60z" fill="#9fc0ff" fillOpacity="0.22" transform="rotate(-30 380 680)" />
            <ellipse cx="500" cy="500" rx="70" ry="40" fill="#ffffff" fillOpacity="0.08" />
          </g>
          {/* water line */}
          <g className="slosh">
            <path d="M60 690 C 200 650 320 730 500 690 S 800 650 940 690 V 960 H 60 Z" fill="url(#water)" />
            <path d="M60 690 C 200 650 320 730 500 690 S 800 650 940 690" fill="none" stroke="#bff3f8" strokeOpacity="0.5" strokeWidth="4" />
          </g>
          {/* a dark centre so the words on top stay easy to read */}
          <circle cx="500" cy="500" r="392" fill="url(#centre-shade)" />
        </g>
        <radialGradient id="centre-shade" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#081944" stopOpacity="0.78" />
          <stop offset="0.7" stopColor="#081944" stopOpacity="0.45" />
          <stop offset="1" stopColor="#081944" stopOpacity="0" />
        </radialGradient>
        {/* glass reflections */}
        <path d="M250 330 A 300 300 0 0 1 420 175" fill="none" stroke="#ffffff" strokeOpacity="0.28" strokeWidth="14" strokeLinecap="round" />
        <path d="M232 410 A 300 300 0 0 1 240 372" fill="none" stroke="#ffffff" strokeOpacity="0.22" strokeWidth="14" strokeLinecap="round" />
        <circle cx="500" cy="500" r="392" fill="none" stroke="#ffffff" strokeOpacity="0.18" strokeWidth="3" />
      </svg>
      <Bubbles count={16} />
      {/* edges fade to the page colour */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,rgb(6_15_38/.75)_100%)]" />
    </div>
  );
}

/** Customer picture: fresh clothes on a rail, swaying a little. */
export function RailScene() {
  const items = [
    { x: 105, color: '#ffffff', kind: 'shirt', d: '0s' },
    { x: 200, color: '#f2c94c', kind: 'dress', d: '-1.2s' },
    { x: 295, color: '#19a7b8', kind: 'shirt', d: '-2.4s' },
  ] as const;
  return (
    <svg aria-hidden viewBox="0 0 440 560" preserveAspectRatio="xMidYMid slice" className="drift absolute inset-0 h-full w-full">
      <defs>
        <linearGradient id="rail-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1846c8" />
          <stop offset="1" stopColor="#0b1b3f" />
        </linearGradient>
      </defs>
      <rect width="440" height="560" fill="url(#rail-bg)" />
      <circle cx="380" cy="80" r="160" fill="#19a7b8" fillOpacity="0.14" />
      <circle cx="40" cy="520" r="200" fill="#ffffff" fillOpacity="0.05" />
      <rect x="20" y="120" width="400" height="8" rx="4" fill="#dbe6ff" fillOpacity="0.85" />
      {items.map((it) => (
        <g key={it.x} className="sway" style={{ animationDelay: it.d }}>
          <path d={`M${it.x} 124 v14 m0 0 c-10 0-14 10-6 14 l-38 20 h88 l-38-20`} fill="none" stroke="#dbe6ff" strokeWidth="3" strokeLinejoin="round" />
          {it.kind === 'shirt' ? (
            <path
              d={`M${it.x - 44} 172 h88 l30 34 -22 22 -14-12 v130 h-76 v-130 l-14 12 -22-22 z`}
              fill={it.color}
              fillOpacity={it.color === '#ffffff' ? 0.95 : 0.9}
            />
          ) : (
            <path d={`M${it.x - 30} 172 h60 l10 70 40 150 h-160 l40-150 z`} fill={it.color} fillOpacity="0.92" />
          )}
          {it.kind === 'shirt' && <path d={`M${it.x - 12} 172 l12 16 12-16`} fill="none" stroke="#0b1b3f" strokeOpacity="0.25" strokeWidth="3" />}
          <rect x={it.x + 10} y="300" width="18" height="26" rx="3" fill="#f2c94c" stroke="#0b1b3f" strokeOpacity="0.3" />
        </g>
      ))}
    </svg>
  );
}

/** Staff picture: a row of washers at work. */
export function MachinesScene() {
  return (
    <svg aria-hidden viewBox="0 0 440 560" preserveAspectRatio="xMidYMid slice" className="drift absolute inset-0 h-full w-full">
      <defs>
        <linearGradient id="m-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0f2f8f" />
          <stop offset="1" stopColor="#081944" />
        </linearGradient>
        <radialGradient id="m-glass" cx="45%" cy="40%" r="65%">
          <stop offset="0" stopColor="#2b62d6" />
          <stop offset="1" stopColor="#0b1b3f" />
        </radialGradient>
      </defs>
      <rect width="440" height="560" fill="url(#m-bg)" />
      <rect y="470" width="440" height="90" fill="#06102a" fillOpacity="0.6" />
      {[0, 1].map((row) =>
        [0, 1, 2].map((col) => {
          const x = 32 + col * 132;
          const y = 150 + row * 170;
          return (
            <g key={`${row}-${col}`}>
              <rect x={x} y={y} width="116" height="150" rx="14" fill="#e9effc" />
              <rect x={x} y={y} width="116" height="28" rx="14" fill="#cdd9f3" />
              <circle cx={x + 22} cy={y + 15} r="5" fill={col === 1 && row === 0 ? '#f2c94c' : '#19a7b8'} />
              <rect x={x + 64} y={y + 9} width="38" height="10" rx="5" fill="#0b1b3f" fillOpacity="0.25" />
              <circle cx={x + 58} cy={y + 90} r="42" fill="#b9c7e6" />
              <circle cx={x + 58} cy={y + 90} r="34" fill="url(#m-glass)" />
              <g className={row === 0 ? 'spin-slow' : 'spin-slower'} style={{ animationDelay: `${-col * 3}s` }}>
                <path d={`M${x + 38} ${y + 94} q20 -24 40 0 q-20 16 -40 0z`} fill="#19a7b8" fillOpacity="0.8" />
                <circle cx={x + 70} cy={y + 76} r="7" fill="#ffffff" fillOpacity="0.6" />
                <circle cx={x + 46} cy={y + 74} r="4" fill="#f2c94c" fillOpacity="0.8" />
              </g>
              <path d={`M${x + 36} ${y + 74} a28 28 0 0 1 20 -15`} fill="none" stroke="#ffffff" strokeOpacity="0.5" strokeWidth="5" strokeLinecap="round" />
            </g>
          );
        }),
      )}
    </svg>
  );
}
