import { useState, useMemo } from "react";

// Meeden 48-piece watercolor set — standard color names with representative hex values
// Ordered roughly: yellows → oranges → reds → pinks → purples → blues → greens → browns → neutrals
// Meeden 48-color watercolor set — colors and order match the official swatch chart
const MEEDEN_48 = [
  // Row 1 — whites, pinks, reds, oranges
  { name: "Titanium White (104)",        hex: "#F5F3EE" },
  { name: "Light Pink (219)",            hex: "#F6CFC7" },
  { name: "Crimson (315)",               hex: "#C72D3F" },
  { name: "Scarlet (302)",               hex: "#E23A3A" },
  { name: "Vermilion Red (324)",         hex: "#E8432A" },
  { name: "Orange Red (313)",            hex: "#EB6A34" },
  // Row 2 — oranges to yellows
  { name: "Orange Yellow (301)",         hex: "#F2A13C" },
  { name: "Permanent Deep Yellow (232)", hex: "#F4C01F" },
  { name: "Mid Yellow (227)",            hex: "#F5D31A" },
  { name: "Gamboge (218)",               hex: "#F5CC2A" },
  { name: "Yellow Pale (216)",           hex: "#F5DC4D" },
  { name: "Lemon Yellow (215)",          hex: "#F1E545" },
  // Row 3 — yellow-greens through deep greens
  { name: "Yellowish Green (562)",       hex: "#D4E24A" },
  { name: "Pale Green (503)",            hex: "#6FC39E" },
  { name: "Mid Green (505)",             hex: "#3FAE5F" },
  { name: "Viridian (560)",              hex: "#1E8F54" },
  { name: "Sap Green (568)",             hex: "#5B8B2B" },
  { name: "Deep Green (570)",            hex: "#2D7A3C" },
  // Row 4 — greens to deep blues
  { name: "Phthalo Green (558)",         hex: "#15806B" },
  { name: "Olive Green (569)",           hex: "#3D4B20" },
  { name: "Indigo Blue (422)",           hex: "#1E2A44" },
  { name: "Prussian Blue (445)",         hex: "#163E66" },
  { name: "Phthalo Blue (450)",          hex: "#1956A8" },
  { name: "Ultramarine (443)",           hex: "#2B3EA8" },
  // Row 5 — blues to pinks
  { name: "Cobalt Blue (453)",           hex: "#1E6FC4" },
  { name: "Cerulean Blue (455)",         hex: "#2AA5D6" },
  { name: "Sky Blue (447)",              hex: "#A8D3EC" },
  { name: "Light Grey Blue (477)",       hex: "#D5DDE3" },
  { name: "Pink (339)",                  hex: "#ECB7C9" },
  { name: "Peach Blossom (317)",         hex: "#F0B39F" },
  // Row 6 — roses, purples
  { name: "Rose (336)",                  hex: "#D63A8E" },
  { name: "Purple Red (403)",            hex: "#D26FB0" },
  { name: "Dioxazine Violet (439)",      hex: "#B073B8" },
  { name: "Purple Gray (783)",           hex: "#B2B0C0" },
  { name: "Purple Pale (434)",           hex: "#B09ECC" },
  { name: "Brilliant Purple (402)",      hex: "#8E3FA5" },
  // Row 7 — violet, ochres, browns
  { name: "Violet (430)",                hex: "#563C8C" },
  { name: "Yellow Ochre (676)",          hex: "#D79A28" },
  { name: "Raw Sienna (601)",            hex: "#B87333" },
  { name: "Burnt Sienna (684)",          hex: "#8E3A1E" },
  { name: "Burnt Umber (687)",           hex: "#6E3A1F" },
  { name: "Raw Umber (688)",             hex: "#8A6A3C" },
  // Row 8 — greys, blacks, metallics
  { name: "Neutral Grey (798)",          hex: "#9AA0A6" },
  { name: "Payne's Grey (797)",          hex: "#4A5866" },
  { name: "Black (793)",                 hex: "#1A1A1A" },
  { name: "Mars Black (791)",            hex: "#2A1E18" },
  { name: "Metallic Gold (132)",         hex: "#C9A24A" },
  { name: "Metallic Silver (121)",       hex: "#C4C6C8" },
];

// --- Color mixing math ---------------------------------------------------
// Real watercolor is subtractive. RGB averaging makes blue+yellow = gray.
// We use a perceptual subtractive approach: convert to a "pigment" space
// via inverse-light mixing with a gamma curve — closer to Kubelka–Munk
// without the full spectral machinery. Blue + yellow → green-ish, etc.

const hexToRgb = (hex: string) => {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  };
};

const rgbToHex = ({ r, g, b }: { r: number; g: number; b: number }) => {
  const toHex = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

// Subtractive-ish mix for N pigments: treat each channel as "amount of
// light absorbed" and mix absorptions, weighted by percentage. This gives
// much more believable paint mixing than a plain RGB average.
// `pigments` is an array of { hex, percent } where percents should sum to 100.
const mixColors = (pigments: { hex: string; percent: number }[]) => {
  if (!pigments || pigments.length === 0) return "#cccccc";

  const total = pigments.reduce((s, p) => s + p.percent, 0);
  if (total === 0) return "#cccccc";
  const normalized = pigments.map((p) => ({
    rgb: hexToRgb(p.hex),
    weight: p.percent / total,
  }));

  const absorb = (v: number) => Math.pow(1 - v / 255, 2);
  const emit = (a: number) => 255 * (1 - Math.sqrt(Math.max(0, a)));

  let ar = 0, ag = 0, ab = 0;
  let lr = 0, lg = 0, lb = 0;
  for (const { rgb, weight } of normalized) {
    ar += absorb(rgb.r) * weight;
    ag += absorb(rgb.g) * weight;
    ab += absorb(rgb.b) * weight;
    lr += rgb.r * weight;
    lg += rgb.g * weight;
    lb += rgb.b * weight;
  }

  let r = emit(ar);
  let g = emit(ag);
  let b = emit(ab);

  const blend = 0.22;
  r = r * (1 - blend) + lr * blend;
  g = g * (1 - blend) + lg * blend;
  b = b * (1 - blend) + lb * blend;

  return rgbToHex({ r, g, b });
};

const isLight = (hex: string) => {
  const { r, g, b } = hexToRgb(hex);
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  return lum > 140;
};

// --- UI ------------------------------------------------------------------

interface Pigment {
  color: string;
  percent: number;
}

interface PigmentRowProps {
  index: number;
  pigment: Pigment;
  onColorChange: (name: string) => void;
  onPercentChange: (pct: number) => void;
  onRemove: () => void;
  canRemove: boolean;
  compact?: boolean;
  hideSlider?: boolean;
  hidePercent?: boolean;
}

function PigmentRow({
  index,
  pigment,
  onColorChange,
  onPercentChange,
  onRemove,
  canRemove,
  compact = false,
  hideSlider = false,
  hidePercent = false,
}: PigmentRowProps) {
  const swatchHex =
    MEEDEN_48.find((c) => c.name === pigment.color)?.hex || "#ccc";

  const ordinal =
    ["One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight"][index] ||
    `${index + 1}`;

  const wrapperClass = compact
    ? "flex-1 min-w-0"
    : "relative pb-5 mb-5 border-b border-stone-300 last:border-b-0 last:mb-0 last:pb-0";

  return (
    <div className={wrapperClass}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between mb-2">
            <label className="text-[10px] tracking-[0.25em] uppercase text-stone-600">
              Pigment {ordinal}
            </label>
            {!hidePercent && (
              <span className="font-serif italic text-stone-700 text-sm tabular-nums">
                {pigment.percent}%
              </span>
            )}
          </div>
          <div className="relative">
            <div
              className="absolute left-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full border border-stone-400 shadow-inner pointer-events-none"
              style={{ backgroundColor: swatchHex }}
            />
            <select
              value={pigment.color}
              onChange={(e) => onColorChange(e.target.value)}
              className="w-full pl-12 pr-8 py-3 bg-stone-50 border border-stone-400 rounded-none text-stone-900 font-serif text-base focus:outline-none focus:border-stone-900 transition-colors appearance-none cursor-pointer"
            >
              {MEEDEN_48.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
            <svg
              className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500 pointer-events-none"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>
          {!hideSlider && (
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={pigment.percent}
              onChange={(e) => onPercentChange(parseInt(e.target.value, 10))}
              className="w-full mt-3 accent-stone-800"
              aria-label={`Percentage of pigment ${ordinal}`}
            />
          )}
        </div>

        {canRemove && (
          <button
            onClick={onRemove}
            className="mt-6 w-8 h-8 flex items-center justify-center border border-stone-400 text-stone-600 hover:text-stone-900 hover:border-stone-900 transition-colors shrink-0"
            aria-label={`Remove pigment ${ordinal}`}
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M6 6l12 12M18 6L6 18"
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

export default function WatercolorMixer() {
  const [pigments, setPigments] = useState<Pigment[]>([
    { color: "Ultramarine (443)", percent: 50 },
    { color: "Mid Yellow (227)", percent: 50 },
  ]);

  const updatePigment = (i: number, patch: Partial<Pigment>) => {
    setPigments((prev) =>
      prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p))
    );
  };

  const addPigment = () => {
    if (pigments.length >= 6) return;
    const newCount = pigments.length + 1;
    const base = Math.floor(100 / newCount / 5) * 5;
    const remainder = 100 - base * newCount;
    setPigments((prev) => [
      ...prev.map((p, idx) => ({
        ...p,
        percent: base + (idx === 0 ? remainder : 0),
      })),
      { color: "Burnt Sienna (684)", percent: base },
    ]);
  };

  const removePigment = (i: number) => {
    if (i < 2) return;
    setPigments((prev) => {
      const next = prev.filter((_, idx) => idx !== i);
      const removedPct = prev[i].percent;
      const share = Math.round((removedPct / next.length) * 5) * 5;
      const updated = next.map((p) => ({ ...p, percent: p.percent + share }));
      const sum = updated.reduce((s, p) => s + p.percent, 0);
      updated[0].percent += 100 - sum;
      return updated;
    });
  };

  const resultHex = useMemo(() => {
    const withHex = pigments.map((p) => ({
      hex: MEEDEN_48.find((c) => c.name === p.color)?.hex || "#ccc",
      percent: p.percent,
    }));
    return mixColors(withHex);
  }, [pigments]);

  const resultTextLight = isLight(resultHex);

  const totalPct = pigments.reduce((s, p) => s + p.percent, 0);

  return (
    <div className="min-h-screen w-full bg-[#f4f0e8] relative overflow-hidden">
      {/* Subtle warm wash */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at top left, rgba(180,140,100,0.08), transparent 65%), radial-gradient(ellipse at bottom right, rgba(100,120,140,0.06), transparent 60%)",
        }}
      />

      <div className="relative max-w-3xl mx-auto px-6 py-10 md:py-16">
        {/* Header */}
        <header className="mb-12 md:mb-16 border-b border-stone-400 pb-6">
          <div className="flex items-center gap-3 text-[10px] tracking-[0.3em] uppercase text-stone-600 mb-4">
            <span className="w-6 h-[1px] bg-stone-500" />
            <span>Meeden 48 · pigment study</span>
            <span className="flex-1 h-[1px] bg-stone-500" />
          </div>
          <h1 className="font-serif text-5xl md:text-6xl italic text-stone-900 leading-none">
            a watercolor mixing tool
            {/* <br />
            <span className="not-italic">bowl</span> */}
          </h1>
          <p className="mt-4 font-serif text-stone-700 max-w-md">
            Preview what colors your watercolors will make
            <br></br>without wasting your finite paint.
          </p>
        </header>

        {/* Mixer controls */}
        <section className="bg-stone-50/70 backdrop-blur-sm border border-stone-400 p-6 md:p-8 shadow-[0_20px_60px_-30px_rgba(50,30,10,0.4)]">
          {pigments.length === 2 ? (
            <>
              <div className="flex flex-row gap-4 sm:gap-8">
                {pigments.map((p, i) => (
                  <PigmentRow
                    key={i}
                    index={i}
                    pigment={p}
                    onColorChange={(name) => updatePigment(i, { color: name })}
                    onPercentChange={(pct) =>
                      updatePigment(i, { percent: pct })
                    }
                    onRemove={() => removePigment(i)}
                    canRemove={false}
                    compact
                    hideSlider
                    hidePercent
                  />
                ))}
              </div>

              {/* Shared ratio slider */}
              <div className="mt-8">
                <div className="flex justify-between items-baseline mb-2">
                  <span className="text-[10px] tracking-[0.25em] uppercase text-stone-600">
                    Ratio
                  </span>
                  <span className="font-serif italic text-stone-700 text-sm tabular-nums">
                    {pigments[0].percent}% &nbsp;·&nbsp;{" "}
                    {100 - pigments[0].percent}%
                  </span>
                </div>
                <div className="relative h-3 overflow-hidden border border-stone-400">
                  <div
                    className="absolute inset-0"
                    style={{
                      background: `linear-gradient(to right, ${
                        MEEDEN_48.find((c) => c.name === pigments[0].color)?.hex
                      } 0%, ${
                        MEEDEN_48.find((c) => c.name === pigments[0].color)?.hex
                      } ${pigments[0].percent}%, ${
                        MEEDEN_48.find((c) => c.name === pigments[1].color)?.hex
                      } ${pigments[0].percent}%, ${
                        MEEDEN_48.find((c) => c.name === pigments[1].color)?.hex
                      } 100%)`,
                    }}
                  />
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={pigments[0].percent}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    setPigments([
                      { ...pigments[0], percent: v },
                      { ...pigments[1], percent: 100 - v },
                    ]);
                  }}
                  className="w-full mt-2 accent-stone-800"
                  aria-label="Mix ratio between pigments"
                />
              </div>
            </>
          ) : (
            pigments.map((p, i) => (
              <PigmentRow
                key={i}
                index={i}
                pigment={p}
                onColorChange={(name) => updatePigment(i, { color: name })}
                onPercentChange={(pct) => updatePigment(i, { percent: pct })}
                onRemove={() => removePigment(i)}
                canRemove={i >= 2}
              />
            ))
          )}

          {/* Running total + add button */}
          <div className="mt-6 flex items-center justify-between gap-4">
            <span
              className={`text-[10px] tracking-[0.25em] uppercase ${
                totalPct === 100 ? "text-stone-500" : "text-amber-700"
              }`}
            >
              Total · {totalPct}%
              {totalPct !== 100 && (
                <span className="ml-2 italic font-serif normal-case tracking-normal">
                  (will be normalized)
                </span>
              )}
            </span>

            {pigments.length < 6 ? (
              <button
                onClick={addPigment}
                className="group flex items-center gap-2 px-4 py-2 border border-stone-400 text-stone-700 hover:text-stone-900 hover:border-stone-900 transition-colors font-serif italic text-sm"
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M12 5v14M5 12h14"
                  />
                </svg>
                Add a color
              </button>
            ) : (
              <span className="text-[10px] tracking-[0.25em] uppercase text-stone-500 italic">
                Max 6 pigments
              </span>
            )}
          </div>
        </section>

        {/* Result — the hero */}
        <section className="mt-10">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-[10px] tracking-[0.3em] uppercase text-stone-600">
              Predicted wash
            </span>
            <span className="flex-1 h-[1px] bg-stone-400" />
          </div>

          <div
            className="relative h-52 md:h-64 border border-stone-400 overflow-hidden shadow-[0_30px_80px_-40px_rgba(50,30,10,0.6)]"
            style={{ backgroundColor: resultHex }}
          >
            {/* Watercolor edge bloom */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: `
                  radial-gradient(ellipse at 30% 40%, rgba(255,255,255,0.15), transparent 60%),
                  radial-gradient(ellipse at 75% 70%, rgba(0,0,0,0.12), transparent 55%)
                `,
              }}
            />
            {/* Paper grain over the swatch */}
            <div
              className="absolute inset-0 opacity-25 pointer-events-none mix-blend-overlay"
              style={{
                backgroundImage: `
                  radial-gradient(circle at 10% 20%, rgba(255,255,255,0.5) 0.5px, transparent 1px),
                  radial-gradient(circle at 60% 70%, rgba(0,0,0,0.3) 0.5px, transparent 1px)
                `,
                backgroundSize: "5px 5px, 9px 9px",
              }}
            />

            {/* Recipe inside swatch */}
            <div
              className={`absolute bottom-4 left-4 right-4 font-serif ${
                resultTextLight ? "text-stone-900" : "text-stone-50"
              }`}
            >
              <div className="text-[10px] tracking-[0.3em] uppercase opacity-70">
                {resultHex.toUpperCase()}
              </div>
              <div className="italic text-base md:text-lg mt-1 leading-snug">
                {pigments.map((p, i) => {
                  const normalized =
                    totalPct > 0
                      ? Math.round((p.percent / totalPct) * 100)
                      : 0;
                  return (
                    <span key={i}>
                      {normalized}% {p.color}
                      {i < pigments.length - 1 && (
                        <span className="opacity-60"> &nbsp;·&nbsp; </span>
                      )}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>

          <p className="mt-4 text-xs italic font-serif text-stone-600 leading-relaxed">
            Note — watercolor behavior depends on pigment granulation, paper,
            and water ratio. This is a mathematical prediction of the dry hue,
            not a guarantee of what your brush will do.
          </p>
        </section>

        {/* Footer mark */}
        <footer className="mt-16 flex items-center justify-between text-[10px] tracking-[0.3em] uppercase text-stone-500">
          <span>№ 001</span>
          <span>—</span>
          <span>Studio Notebook</span>
        </footer>
      </div>
    </div>
  );
}
