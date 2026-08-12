/**
 * Plànol tècnic — schematic plan (top) + longitudinal section (side) view of
 * the pool vessel, plus a project data title block. Only rendered right
 * after PageCover when poolShape === 'regular' (see PdfDocument.tsx) — the
 * drawing assumes a rectangular vessel.
 *
 * Header/divider/logo match every other page (Tenor Sans navy 46pt title,
 * 6px divider, PdfLogo size 85). The technical linework itself (dimension
 * lines, hatching, section contour) uses a neutral dark gray, reserving navy
 * for titles and the title block — per design direction.
 *
 * The interior stairs are drawn schematically at the shallow end (left) of
 * both views as a fixed convention: the data model has no wall/side field
 * for the real stair position, so this is explicitly labelled as
 * approximate, not the exact site layout.
 *
 * SVG sizing: every <svg> sets width/height in mm that match its viewBox's
 * aspect ratio exactly, so html2canvas never has to stretch it — the same
 * class of bug already found (and fixed) with fixed width+height on <img>
 * tags combined with objectFit: contain (see PageDepuracio1/PageDepuracio2
 * bomba images).
 */
import type { PdfData } from "./pdfTypes";
import { pdfPageStyle } from "./pdfStyles";
import { PdfLogo } from "./PdfShared";
import { computeInteriorStepsCount } from "@/lib/stairsGeometry";

const NAVY = "#2f4494";
const DRAW = "#3a3a3a"; // neutral dark gray for all technical linework (contour, hatching, risers)
const WATER = "#cfe0ee";
const DIM_MAIN = DRAW; // main pool dimensions (llarg/ample, profile depths) — neutral gray, matching the vessel geometry
const DIM_INTERIOR = NAVY; // escala/plataforma dimensions — navy, so they read apart from the gray main cotas and geometry

// Fallback water-gradient anchors — only used when depth data is missing
// (hasDepthColor false in PlanView, see its water-gradient), reproducing
// the page's original flat 2-stop fade. Not used for anything depth-driven
// anymore now that both PlanView's main body and its escala steps are
// keyed off lastStepColor/WATER_STEP_DARK/WATER_BODY_DEEP instead (see
// below) — kept only for that no-data fallback.
const WATER_SHALLOW = "#dcebf5";
const WATER_DEEP = "#7fb0d6";

// Escala step colors — index-based (see PlanView's stepColor), not
// depth-based: those treads are all shallower than poolDepthMin itself,
// which would put them outside a depth→color interpolation's valid
// [dMin,dMax] domain (an earlier depth-based, unclamped version of this
// produced solid white steps because of that — see git history/prior
// comments if curious). WATER_STEP_DARK reuses WATER_DEEP's exact tone
// rather than inventing a new color, and is deliberately darker/more
// saturated than WATER_SHALLOW, the ramp's dark end used to originally sit
// at (5 steps' worth of difference wasn't visible enough against that
// lighter anchor).
//
// WATER_STEP_LIGHT was originally #eef6fb (near-white) — too close to
// literal white to read as tinted water at all, especially once the PDF
// export pipeline's lossy JPEG pass (see pdfRender.ts, toDataURL("image/
// jpeg", 0.88)) smooths out a difference that subtle. Moved closer to
// WATER_SHALLOW itself (a touch more saturated, even) so the first step
// reads as clearly blue rather than empty white.
const WATER_STEP_LIGHT = "#c9e0f0";
const WATER_STEP_DARK = WATER_DEEP;
// The main body's OWN darkest anchor — the poolDepthMax vertex — kept
// distinct from (and deliberately darker than) WATER_STEP_DARK: the escala
// block's own last step and the main body's flat zone right after it are
// now the SAME color on purpose (see lastStepColor's comment in PlanView),
// so the vertex needs its own, darker anchor for the flat-zone→vertex
// transition to still read as a real gradient rather than a plateau.
const WATER_BODY_DEEP = "#2f6191";
// <1 accelerates the ramp for the early/middle steps (2nd/3rd/4th) instead
// of a straight linear split — human color perception isn't linear either,
// so a pure linear t made those middle steps look too close together even
// though their t values were evenly spaced. Applied as t^STEP_COLOR_GAMMA
// in stepColor.
const STEP_COLOR_GAMMA = 0.7;

function clampByte(n: number): number {
  return Math.min(255, Math.max(0, n));
}

function clamp01(t: number): number {
  return Math.min(1, Math.max(0, t));
}

function lerpHexColor(hexA: string, hexB: string, t: number): string {
  const a = parseInt(hexA.slice(1), 16);
  const b = parseInt(hexB.slice(1), 16);
  const channel = (shift: number) => {
    const ca = (a >> shift) & 0xff;
    const cb = (b >> shift) & 0xff;
    return clampByte(Math.round(ca + (cb - ca) * t));
  };
  const r = channel(16);
  const g = channel(8);
  const bl = channel(0);
  return `#${[r, g, bl].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

function fmtM(n?: number): string {
  return typeof n === "number" && Number.isFinite(n)
    ? n.toLocaleString("ca-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : "—";
}

/** Extracts the "W x L x H" numbers (in meters) out of a dimensions string
 *  like "1,20m x 1,50m x 1,20m" (see budgetSave.ts stairsDimensions /
 *  platformDimensions) — width first, matching the order they're built in
 *  there. Used for both fields, hence the generic name. */
function parseMetersList(dims?: string): number[] {
  if (!dims) return [];
  return Array.from(dims.matchAll(/(\d+(?:,\d+)?)\s*m/g)).map((m) => parseFloat(m[1].replace(",", ".")));
}

/** Gentle repeating sine-like wave built from alternating quadratic bezier
 *  bumps — used for the waterline so it reads as water, not a ruled edge. */
function wavePath(x0: number, y0: number, width: number, amplitude: number, wavelength: number): string {
  const segments = Math.max(2, Math.round(width / wavelength));
  const segW = width / segments;
  let d = `M ${x0} ${y0}`;
  for (let i = 0; i < segments; i++) {
    const xMid = x0 + segW * (i + 0.5);
    const xEnd = x0 + segW * (i + 1);
    const yBump = y0 + (i % 2 === 0 ? -amplitude : amplitude);
    d += ` Q ${xMid} ${yBump} ${xEnd} ${y0}`;
  }
  return d;
}

/** Zigzag riser+tread staircase profile (side view), starting at (x0,y0)
 *  (the water surface at the stairs wall) and descending `steps` risers to
 *  land exactly at (x0 + (steps-1)*treadW, y0 + steps*riserH) — by
 *  construction that's always the flat zone's far end at floor depth, so the
 *  staircase always lands precisely where ProfileView's flat/base segment
 *  (and the slope starting from it) begins, however many steps there are.
 *  Each riser is followed by a tread EXCEPT the last one: real stairs have
 *  steps-1 treads between steps risers — the last riser drops you straight
 *  onto the pool floor, which is what the slope picks up from, not onto one
 *  more flat run first. Drawing a trailing tread after the final riser (the
 *  original bug here) left a straight, step-less stretch of "floor" between
 *  where the last riser actually reached full depth and x0+steps*treadW —
 *  i.e. an extra flat run wedged between the staircase and the slope start,
 *  even though both were already meeting at the same point on paper. Purely
 *  a visual overlay (drawn on top of the already-flat floor contour), same
 *  as PlanView's riser lines over its escala rect — it doesn't alter the
 *  pool's own fill/outline. */
function stairsProfilePath(x0: number, y0: number, treadW: number, riserH: number, steps: number): string {
  let d = `M ${x0} ${y0}`;
  let x = x0;
  let y = y0;
  for (let i = 0; i < steps; i++) {
    y += riserH;
    d += ` L ${x} ${y}`;
    if (i < steps - 1) {
      x += treadW;
      d += ` L ${x} ${y}`;
    }
  }
  return d;
}

// Tuned against the profile view's depth cotas — the one dimension style the
// user confirmed looks right — and now the single source every dimension
// line on this page (plan or profile) draws from.
const DIM_GAP = 2.5; // breathing room between the object edge and where the extension line starts
const DIM_OFFSET = 7; // distance from the object edge to the dimension line itself
const DIM_OVERSHOOT = 4; // how far the extension line continues past the dimension line
const DIM_TICK = 0.7; // half-length of each tick mark
const DIM_LABEL_GAP_V = 2; // how far past the dimension line a rotated (vertical) label sits
const DIM_LABEL_GAP_H = 2.2; // same, for a horizontal (non-rotated) label

// Module-level (not PlanView-local) so ProfileView's depth cotas can share
// the exact same tick/gap/overshoot/offset as PlanView's main llarg/ample
// cotas (Length/Width) and read as the same visual "family" of cota across
// both views, even though ProfileView has no literal corona of its own.
//  - CORONA: plan view's corona thickness (mm) — kept here only because
//    mainDimOffset is defined relative to it; PlanView still uses it
//    directly for its outer/corona rect too.
//  - mainDimTick: half the shared DIM_TICK default, so the tick can never
//    visually reach the hatch even with anti-aliasing (in PlanView).
//  - mainDimOvershoot: how far the extension line continues past the
//    dimension line (the crossing point) — short, so the crossing at each
//    corner reads as a discreet mark rather than a long, prominent stroke.
//  - mainDimOffset: distance from the object edge to the dimension line.
//  - mainDimGap: how far *before* the dimension line the extension line
//    starts (i.e. offset − gap is the "before" run). Set to mainDimOffset
//    − mainDimOvershoot so the "before" and "after" runs around the
//    crossing are the same short length — a symmetric, centered mark
//    instead of a long lopsided stroke.
const CORONA = 4;
const mainDimTick = DIM_TICK / 2;
const mainDimOvershoot = 0.8;
const mainDimOffset = CORONA + DIM_OFFSET;
const mainDimGap = mainDimOffset - mainDimOvershoot;

/**
 * One linear dimension: extension lines + dimension line + tick-mark
 * terminators + label. Replicated 1:1 from ProfileView's original depth
 * cotas and reused for every cota on this page, so a future correction only
 * has to be made once.
 *
 * `outward` is the sign of travel away from the measured object — for a
 * vertical dimension, -1 means "to the left", +1 "to the right"; for a
 * horizontal one, -1 means "up", +1 "down". For vertical dimensions it also
 * fixes the label's rotation: text glyphs sit above their own baseline, so a
 * rotate(-90) always nudges the rendered block toward negative x regardless
 * of which side it's on — correct when outward is -1 (the nudge pushes the
 * label further away from the object) but wrong when outward is +1 (it pulls
 * the label back onto the dimension line). Using rotate(90 * outward)
 * resolves that automatically instead of requiring a manual sign flip at
 * each call site.
 */
function Dimension({
  orientation,
  objPos,
  outward,
  from,
  to,
  label,
  fontSize = 3.6,
  offset = DIM_OFFSET,
  gap = DIM_GAP,
  overshoot = DIM_OVERSHOOT,
  tick = DIM_TICK,
  labelGap,
  color = DIM_MAIN,
  horizontalLabel = false,
}: {
  orientation: "horizontal" | "vertical";
  /** Coordinate of the measured object's edge, on the perpendicular axis
   *  (x for a vertical dimension, y for a horizontal one). */
  objPos: number;
  outward: 1 | -1;
  /** The two coordinates spanned, along the dimension's own axis (y for
   *  vertical, x for horizontal). */
  from: number;
  to: number;
  label: string;
  fontSize?: number;
  offset?: number;
  gap?: number;
  overshoot?: number;
  tick?: number;
  labelGap?: number;
  /** Stroke/fill for this dimension's lines and label — kept separate from
   *  DRAW (the geometry color) so cotas read as annotations, not vessel
   *  outline. Defaults to DIM_MAIN (navy); escala/plataforma cotas override
   *  it with DIM_INTERIOR so the two families of cotas are also
   *  distinguishable from each other. */
  color?: string;
  /** Vertical dimensions only: skip the rotate(90*outward) on the label and
   *  lay it out horizontally instead, reading outward from the dimension
   *  line (textAnchor "start" for outward=1, "end" for outward=-1) rather
   *  than centered/rotated on it. For very short spans (a single step's
   *  riser height, a few mm tall) the rotated glyphs run so tight against
   *  each other and against the dimension line that they become hard to
   *  read and can touch nearby geometry — an unrotated label just needs
   *  horizontal room next to the line instead, which is what these tight
   *  spots actually have more of. No effect on horizontal dimensions
   *  (already unrotated). */
  horizontalLabel?: boolean;
}) {
  const pos = objPos + outward * offset;
  const extStart = objPos + outward * gap;
  const extEnd = pos + outward * overshoot;
  const mid = (from + to) / 2;

  if (orientation === "vertical") {
    const labelPos = pos + outward * (labelGap ?? DIM_LABEL_GAP_V);
    return (
      <>
        <g stroke={color} strokeWidth="0.35" fill="none">
          <line x1={extStart} y1={from} x2={extEnd} y2={from} />
          <line x1={extStart} y1={to} x2={extEnd} y2={to} />
          <line x1={pos} y1={from} x2={pos} y2={to} />
          <line x1={pos - tick} y1={from} x2={pos + tick} y2={from} />
          <line x1={pos - tick} y1={to} x2={pos + tick} y2={to} />
        </g>
        {horizontalLabel ? (
          <text
            x={labelPos}
            y={mid + fontSize * 0.35}
            textAnchor={outward === 1 ? "start" : "end"}
            fontSize={fontSize}
            fill={color}
            fontFamily="Inter, sans-serif"
          >
            {label}
          </text>
        ) : (
          <text
            x={labelPos}
            y={mid}
            textAnchor="middle"
            fontSize={fontSize}
            fill={color}
            fontFamily="Inter, sans-serif"
            transform={`rotate(${90 * outward} ${labelPos} ${mid})`}
          >
            {label}
          </text>
        )}
      </>
    );
  }

  // Non-rotated text sits on its baseline with the glyph body drawn UPWARD
  // from it (toward smaller y). When the label is placed below the line
  // (outward === 1, labelPos > pos), that upward draw direction goes back
  // TOWARD the line — so a small labelGap alone isn't enough clearance, the
  // glyphs re-cross over the line unless we also clear their own ascent
  // (~0.75 × fontSize). When the label is above the line (outward === -1),
  // glyphs draw further away from it, so no correction is needed there.
  // Same root cause as the profunditat màxima rotate(90) fix in the vertical
  // branch above, just showing up as a missing offset instead of a wrong
  // rotation sign.
  const baseLabelGap = labelGap ?? DIM_LABEL_GAP_H;
  const labelPos = outward === 1 ? pos + baseLabelGap + fontSize * 0.75 : pos - baseLabelGap;
  return (
    <>
      <g stroke={color} strokeWidth="0.35" fill="none">
        <line x1={from} y1={extStart} x2={from} y2={extEnd} />
        <line x1={to} y1={extStart} x2={to} y2={extEnd} />
        <line x1={from} y1={pos} x2={to} y2={pos} />
        <line x1={from} y1={pos - tick} x2={from} y2={pos + tick} />
        <line x1={to} y1={pos - tick} x2={to} y2={pos + tick} />
      </g>
      <text x={mid} y={labelPos} textAnchor="middle" fontSize={fontSize} fill={color} fontFamily="Inter, sans-serif">
        {label}
      </text>
    </>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <div
      style={{
        fontFamily: '"Tenor Sans", serif',
        fontSize: "11pt",
        color: NAVY,
        letterSpacing: 1.5,
        marginBottom: "1mm",
      }}
    >
      {children}
    </div>
  );
}

// PlanView's own canvas layout — pulled out to module level (not just
// PlanView-local) because computePlanRect (below) needs these exact same
// numbers to reproduce PlanView's scale/rectX/rectW, so ProfileView can
// share them and have its pool footprint land at the identical physical
// page position as PlanView's (same wall x-coordinates), not just the same
// total length in meters. All of PlanView's other geometry (rectY, rectH,
// corona, etc.) stays local to PlanView — only the horizontal fit is
// shared, since that's the only thing that needs to visually line up
// between the two views.
const PLAN_VW = 182;
const PLAN_VH = 108;
const PLAN_LEFT_MARGIN = 20;
const PLAN_RIGHT_MARGIN = 10;
const PLAN_TOP_MARGIN = 22;
const PLAN_BOTTOM_MARGIN = 22;

/** Pure function: given the pool's real length/width (metres), returns the
 *  same {scale, rectX, rectW} PlanView draws its vas rectangle with. Called
 *  independently by both PlanView and ProfileView with the same inputs
 *  (data.poolLength/data.poolWidth) — being pure and deterministic, both
 *  calls always agree, without needing to thread props through PagePlanol.
 *
 *  Deliberately independent of ext-stairs: the pool's own drawn size must
 *  stay identical whether or not hasExteriorStairs is active (explicit
 *  product decision — an earlier version shrank scale here to make the
 *  ext-stairs protrusion fit inside a fixed-height canvas; that's reverted
 *  in favor of growing the canvas itself instead, see PlanView's own Vh). */
function computePlanRect(length: number, width: number): { scale: number; rectX: number; rectW: number } {
  const availW = PLAN_VW - PLAN_LEFT_MARGIN - PLAN_RIGHT_MARGIN;
  const availH = PLAN_VH - PLAN_TOP_MARGIN - PLAN_BOTTOM_MARGIN;
  const scale = Math.min(availW / length, availH / width);
  const rectW = length * scale;
  const rectX = PLAN_LEFT_MARGIN + (availW - rectW) / 2;
  return { scale, rectX, rectW };
}

function PlanView({ data }: { data: PdfData }) {
  const length = data.poolLength;
  const width = data.poolWidth;
  if (typeof length !== "number" || typeof width !== "number" || length <= 0 || width <= 0) {
    return (
      <div style={{ fontSize: "9pt", fontStyle: "italic", color: DRAW }}>
        Dades de mides no disponibles per generar la vista en planta.
      </div>
    );
  }

  const Vw = PLAN_VW;
  const leftMargin = PLAN_LEFT_MARGIN;
  const rightMargin = PLAN_RIGHT_MARGIN;
  // Generous top margin: the length dimension line + its label need to sit
  // fully inside the viewBox (SVG root clips to it by default) even in the
  // worst case where the rectangle fills the whole available height.
  const topMargin = PLAN_TOP_MARGIN;
  // Same clearance as topMargin (not the smaller value this used to have):
  // the banc case's escala-llarg cota now lives below the pool too (see
  // "escala llarg cota — banc case, external" further down) and needs the
  // exact same room to clear the corona + offset + label as the top one.
  const bottomMargin = PLAN_BOTTOM_MARGIN;
  const availW = Vw - leftMargin - rightMargin;
  // Fixed to the constant, NOT to the (possibly grown) Vh computed further
  // down — availH governs the vas's own bounding box, which must stay
  // identical whether or not there's an ext-stairs protrusion (see
  // computePlanRect's own comment). Vh instead grows PAST topMargin+availH+
  // bottomMargin when there's a protrusion, adding canvas below rather than
  // compressing this budget.
  const availH = PLAN_VH - topMargin - bottomMargin;
  const { scale, rectX, rectW } = computePlanRect(length, width);
  const rectH = width * scale;
  const rectY = topMargin + (availH - rectH) / 2;
  const outerX = rectX - CORONA;
  const outerY = rectY - CORONA;
  const outerW = rectW + CORONA * 2;
  const outerH = rectH + CORONA * 2;
  // mainDimTick/mainDimOvershoot/mainDimOffset/mainDimGap are module-level
  // (see their definitions near the top of the file) so ProfileView's depth
  // cotas can share them too.
  // The external banc-case stairsLength cota (see further down) uses this
  // same short-crossing recipe but a smaller offset than Length/Width: at
  // mainDimOffset (11mm) it sat with a lot of empty space between it and
  // the corona. gap keeps the same offset−overshoot relationship so the
  // crossing stays centered/small at this shorter offset too.
  const stairsLengthExtOffset = CORONA + 3;
  const stairsLengthExtGap = stairsLengthExtOffset - mainDimOvershoot;

  // "Escala Exterior d'Obra" (hasExteriorStairs/extStairsLength/extStairsWidth,
  // StepEstructura.tsx section 3B) — drawn as its own dedicated block further
  // down (see "Ext-stairs block" below), NOT a repositioning of the carved-in
  // escala/plataforma/banc/tot_ample block below: it only supports the plain
  // 'estandard' look for now (steps only, no plataforma/banc/tot_ample —
  // those need a different measurement approach for the ext case, deferred).
  // Mutually exclusive with the carved-in rendering (showStairs is
  // suppressed whenever this is active), regardless of interiorStairsType.
  const showExtStairs = !!data.hasExteriorStairs && (data.extStairsLength || 0) > 0 && (data.extStairsWidth || 0) > 0;
  const showStairs = !!data.hasInteriorStairs && !showExtStairs;
  // "escala a tot l'ample" — geometrically identical to the standard escala
  // (same risers, same computeInteriorStepsCount formula, same protrusion), the only
  // difference being stairsWidth: computeSuggestions() in StepEstructura.tsx
  // sets it to the full poolWidth for this type (stairsWidth = w) instead of
  // a partial value, so the block spans the pool's entire wall height rather
  // than a corner-anchored slice of it. No plataforma/banc/boundary line
  // applies here — see stairsAlongWall below and the external llarg cota
  // further down, both now also gated on isTotAmple alongside showBench.
  const isTotAmple = data.interiorStairsType === "tot_ample";
  // Real scale: same metres→mm factor as the pool rectangle itself, so the
  // stairs block's size relative to the pool is actually accurate rather
  // than an arbitrary schematic proportion.
  const stairsNums = parseMetersList(data.stairsDimensions);
  const stairsWidthM = stairsNums[0] > 0 ? stairsNums[0] : 0.9; // "ample" — first value
  const stairsLengthM = stairsNums[1] > 0 ? stairsNums[1] : stairsWidthM * 0.8; // "llarg" — protrusion into the pool
  const stairsAlongWall = isTotAmple ? rectH : Math.min(stairsWidthM * scale, rectH);
  const stairsProtrusion = Math.min(stairsLengthM * scale, rectW * 0.5);
  // Bottom corner of the shallow-end wall, not centered — a real stair sits
  // against a corner, not floating mid-wall.
  const stairsY = rectY + rectH - stairsAlongWall;
  // Kept as a plain alias for rectX (was a real second mode in an earlier
  // version of this file; the carved-in block below only ever runs when
  // showExtStairs is false now, so this is always rectX) — not renamed back
  // throughout the block below to keep this diff small.
  const stairsOriginX = rectX;
  const stepsCount = computeInteriorStepsCount(data.poolDepthMin);
  // First tread's own width (x-span from the wall to the first riser line,
  // rectX to rectX + stairsProtrusion/stepsCount below) — same geometry
  // ProfileView's stairsTreadW is built from (flatWidth/(totalRisers-1),
  // and flatWidth===stairsProtrusion here since both come from the same
  // stairsLengthM*scale), so the two views' tread cotas describe the exact
  // same real-world step. Needs a real first riser line to sit against,
  // which only exists once stepsCount>=2 (see the riser <line> map below —
  // stepsCount-1 risers are drawn, so stepsCount===1 draws none).
  const firstTreadX = rectX + stairsProtrusion / stepsCount;
  const showTreadDetailCota = showStairs && stepsCount >= 2;

  // Ext-stairs block geometry — "Escala Exterior d'Obra", 'estandard' look
  // only (see showExtStairs comment above). Protrudes from the LONG bottom
  // wall (along poolLength) instead of the short left wall the carved-in
  // block above uses, left-aligned to the poolDepthMin-side corner (same
  // corner the carved-in escala already occupies). extStairsWidth runs
  // along the wall (x, from rectX rightward, capped to the available
  // length rectW — mirrors the rectH cap the carved-in block's own
  // stairsAlongWall uses for its wall); extStairsLength is the protrusion,
  // straight down (y) with no cap — it's outside the vas, not bounded by
  // the pool's own footprint, same reasoning as the previous (left-wall)
  // ext-stairs cap removal.
  const extAlongWallPx = showExtStairs ? Math.min((data.extStairsWidth as number) * scale, rectW) : 0;
  const extProtrusionPx = showExtStairs ? (data.extStairsLength as number) * scale : 0;
  const extOriginX = rectX;
  const extOriginY = rectY + rectH;
  // Canvas height — grows past PLAN_VH only as far as the ext-stairs
  // protrusion's own content actually reaches, instead of shrinking scale
  // (see computePlanRect's own comment) or reserving the full generic
  // bottomMargin (22mm) below it like the fixed case does. That generic
  // bottomMargin is sized for the WORST case among several unrelated cotas
  // sharing it elsewhere on this page — reusing it here left a visibly
  // empty gap before the "posició esquemàtica" note below the <svg> (see
  // PagePlanol.tsx), since the Ample cota below the protrusion only needs a
  // fraction of that room. EXT_COTA_TAIL covers exactly what that cota
  // needs instead: its own offset (stairsLengthExtOffset = CORONA + 3,
  // i.e. already clears the corona) plus its label's own vertical extent
  // (labelGap=1.3 + fontSize*0.75≈1.95 ≈ 3.25mm, per Dimension's own
  // horizontal-label math), rounded up for a small safety margin. 0
  // whenever there's no ext-stairs, so Vh===PLAN_VH exactly for that case.
  const EXT_COTA_TAIL = 12;
  const extBottomContentY = showExtStairs ? extOriginY + extProtrusionPx + EXT_COTA_TAIL : 0;
  const Vh = Math.max(PLAN_VH, extBottomContentY);
  // Tread-width detail cota (0.30m) — same "single representative step"
  // idea as the carved-in block's own showTreadDetailCota, adapted to this
  // block's rotated axis: the FIRST tread here is the one nearest the wall
  // (high y, i=1, lightest per the point-3 color fix — the natural entry
  // point from the obra, same role stairsOriginX/the wall plays in the
  // carved-in block), not the one nearest open water. extFirstTreadY is
  // that first riser line's y (the boundary between tread 1 and tread 2),
  // mirroring firstTreadX's role there. Guarded the same way
  // (stepsCount>=2): with only 1 step there's no first riser line to bound
  // the cota against.
  const extFirstTreadY = extOriginY + ((stepsCount - 1) * extProtrusionPx) / stepsCount;
  const showExtTreadDetailCota = showExtStairs && stepsCount >= 2;

  // escala/plataforma (and escala/banc) boundary line — normally drawn
  // wall-to-boca in one piece, but step 2 (counting from the wall) sits
  // exactly level with the plataforma/banc, so the boundary opens up over
  // that step's tread width only: no divider is drawn between x at riser 1
  // and riser 2, representing that you can walk straight across from step 2
  // into the plataforma/banc with no level change. Only meaningful once
  // there's a real "step 2" tread, i.e. at least 2 interior risers. Computed
  // early (before the banc block below) because the banc's own front edge
  // is snapped to boundaryGapX2 — see benchProtrusion.
  const boundaryGapX1 = stepsCount >= 2 ? stairsOriginX + (stairsProtrusion * 1) / stepsCount : null;
  const boundaryGapX2 = stepsCount >= 2 ? stairsOriginX + (stairsProtrusion * 2) / stepsCount : null;

  // "escala amb plataforma" — the platform sits directly above the escala
  // sub-block, sharing its wall (x=rectX) and front edge (protrusion), per
  // StepEstructura.tsx's computeSuggestions(): stairsLength and
  // platformLength are the same value (flush front edge), only the width
  // along the wall differs.
  const isPlataforma = data.interiorStairsType === "plataforma" && !!data.hasPlatform;
  const platformNums = isPlataforma ? parseMetersList(data.platformDimensions) : [];
  const platformWidthM = platformNums[0] > 0 ? platformNums[0] : undefined;
  const platformAlongWall = platformWidthM ? Math.min(platformWidthM * scale, rectH - stairsAlongWall) : 0;
  const platformY = stairsY - platformAlongWall;
  const showPlatform = isPlataforma && platformAlongWall > 0;

  // "escala amb banc" — same wall-sharing idea as plataforma, but the banc's
  // own protrusion (benchLength, a fixed 0.6m suggestion in
  // StepEstructura.tsx's computeSuggestions(), independent of stairsLength's
  // 1.5m) is shorter than the escala's, so unlike plataforma its front edge
  // does NOT line up with the escala's front edge — see the L-shaped outline
  // built further down instead of a single combined <rect>. (The bench's own
  // front edge does, however, line up with the escala's step-2/step-3
  // divider — see benchProtrusion below.) Same data.platformDimensions field
  // is reused for the banc's own W×L×H (see budgetSave.ts), hence reusing
  // parseMetersList/the "platform" name for the raw numbers here.
  const isBanc = data.interiorStairsType === "banc" && !!data.hasPlatform;
  const benchNums = isBanc ? parseMetersList(data.platformDimensions) : [];
  const benchWidthM = benchNums[0] > 0 ? benchNums[0] : undefined;
  const benchLengthM = benchNums[1] > 0 ? benchNums[1] : 0.6; // matches the fixed 0.6m suggestion; still used for the cota's label
  const benchAlongWall = benchWidthM ? Math.min(benchWidthM * scale, rectH - stairsAlongWall) : 0;
  const benchY = stairsY - benchAlongWall;
  const showBench = isBanc && benchAlongWall > 0;
  // The banc's front edge is snapped to the step-2/step-3 riser divider
  // (boundaryGapX2) rather than drawn from benchLengthM independently — the
  // two are meant to line up exactly (same physical level-match reasoning
  // as the boundary gap itself), and computing them from two separate
  // sources produced a visibly crooked seam. benchLengthM is kept only for
  // the cota's displayed label, not for this geometry. Falls back to the
  // metres-based calculation when there's no step-2 divider to snap to
  // (fewer than 2 interior risers).
  const benchProtrusion = !showBench
    ? 0
    : boundaryGapX2 !== null
      ? Math.min(boundaryGapX2 - stairsOriginX, stairsProtrusion)
      : Math.min(benchLengthM * scale, stairsProtrusion);
  const benchEdgeX = stairsOriginX + benchProtrusion;

  // For the escala/banc boundary specifically: the gap only makes sense
  // where the banc is actually present above the escala — beyond the banc's
  // own (shorter) edge, the escala instead borders open pool water, which is
  // a normal solid boundary regardless of the step-2 level-match. Clipping
  // the gap's x-range to benchEdgeX means: if the gap falls entirely beyond
  // the banc, it collapses to zero width and the boundary line renders
  // fully solid, same as the "no banc/no plataforma" case.
  const benchGapX1 = boundaryGapX1 !== null ? Math.min(boundaryGapX1, benchEdgeX) : null;
  const benchGapX2 = boundaryGapX2 !== null ? Math.min(boundaryGapX2, benchEdgeX) : null;

  // Depth-driven water color. Guarded on both depths being present/valid —
  // with missing data hasDepthColor stays false and every color below falls
  // back to WATER (the old flat/solid tone), and the gradient further down
  // falls back to its original static 2-stop version.
  const dMin = data.poolDepthMin;
  const dMax = data.poolDepthMax;
  const hasDepthColor = typeof dMin === "number" && typeof dMax === "number" && dMin > 0 && dMax > 0;

  // Main body — the same flat/slope/vertex/drain floor profile ProfileView
  // computes for its own section cut, rebuilt here independently (not
  // imported/shared) since only 2 x-positions are actually needed for the
  // gradient stops. Deliberately mirrors ProfileView's OWN 0.9 clamp on the
  // flat zone, not stairsProtrusion's 0.5 clamp just above — the two only
  // diverge on extreme inputs, but using stairsProtrusion here would
  // silently drift the plan's "deepest point" x away from where the profile
  // actually draws it, breaking the two views' visual match.
  const bodyFlatWidth = Math.min(stairsLengthM * scale, rectW * 0.9);
  const bodyFlatEndX = rectX + bodyFlatWidth;
  const bodyVertexX = bodyFlatEndX + maxDepthPositionRatio * (rectX + rectW - bodyFlatEndX);
  const bodyDrainDepth = hasDepthColor ? (dMax as number) - 0.1 : 0;

  // Escala step colors — interpolated by STEP INDEX (1..stepsCount), not by
  // real depth (an earlier depth-based, unclamped version of this produced
  // solid white steps — every tread short of the last is shallower than
  // poolDepthMin, outside a depth→color interpolation's valid [dMin,dMax]
  // domain). Two contrast passes on top of that fix, per feedback that the
  // plain linear index ramp wasn't visible enough across 5 steps:
  //  1. Wider anchors — WATER_STEP_LIGHT (near-white) to WATER_STEP_DARK
  //     (=WATER_DEEP, deliberately darker/more saturated than
  //     WATER_SHALLOW, which the ramp's dark end used to sit at — see
  //     WATER_STEP_DARK's own comment for the resulting trade-off).
  //  2. A gamma curve (t^STEP_COLOR_GAMMA, GAMMA<1) instead of a straight
  //     linear split, so the middle steps (2nd/3rd/4th) diverge more from
  //     each other than even spacing alone would — matching how human
  //     color perception isn't linear.
  const stepColor = (i: number): string => {
    if (stepsCount <= 1) return WATER_STEP_DARK;
    const linearT = (i - 1) / (stepsCount - 1);
    const t = Math.pow(clamp01(linearT), STEP_COLOR_GAMMA);
    return lerpHexColor(WATER_STEP_LIGHT, WATER_STEP_DARK, t);
  };
  // The escala's last-step color. Also, DELIBERATELY, the main body's own
  // flat-zone color (see the water-gradient stops below) — per feedback on
  // an earlier version that decoupled the two (each using its own
  // depth-based tone): that made the flat zone restart at a LIGHT color
  // right where the escala's dark last step ends, reading as an ugly seam
  // between two disconnected patches of water instead of one continuous
  // body. Reusing lastStepColor here means the color flows unbroken from
  // the last step straight into the flat zone, then continues darkening
  // from THERE toward the vertex (see WATER_BODY_DEEP) — a real
  // progression, not two separate ramps that happen to sit side by side.
  const lastStepColor = hasDepthColor ? stepColor(stepsCount) : WATER;
  // Plataforma/banc shares step 2's level — the boundary gap above already
  // marks that as the walk-across point. Falls back to the LAST step's
  // color when there's no real step 2 (stepsCount<2), same fallback
  // boundaryGapX1/2 themselves already use (they stay null then).
  const step2Color = hasDepthColor ? stepColor(stepsCount >= 2 ? 2 : stepsCount) : WATER;
  // Drain-wall stop (100%, the far end) — an intermediate tone between
  // lastStepColor (flat zone) and WATER_BODY_DEEP (the vertex), NOT a flat
  // fixed color: bodyDrainDepth (poolDepthMax − 0.10) sits almost, but not
  // quite, at the pool's deepest point, so its color is placed at the same
  // proportion along [poolDepthMin, poolDepthMax] that its depth actually
  // sits at — close to WATER_BODY_DEEP, but visibly lighter than the
  // vertex itself, same as the depth values themselves are close but not
  // equal.
  const bodyDrainT =
    hasDepthColor && (dMax as number) > (dMin as number)
      ? clamp01((bodyDrainDepth - (dMin as number)) / ((dMax as number) - (dMin as number)))
      : 1;
  const bodyDrainColor = lerpHexColor(lastStepColor, WATER_BODY_DEEP, bodyDrainT);

  // Ext-stairs L-shape polygons — 6 vertices each, water body and outer
  // (corona) perimeter. Protrusion sticks out of the BOTTOM wall now (along
  // poolLength), left-aligned to rectX (the poolDepthMin-side corner), so
  // the reflex vertex is at the water polygon's (rectX+extAlongWallPx,
  // rectY+rectH) instead of the previous left-wall version's (rectX,
  // stairsY). Re-derived per-edge (not pattern-matched from the old
  // left-wall version): each of the 6 corners was individually checked for
  // which side water is on to get its true outward normal, since this
  // reflex corner's offset direction (+CORONA on both axes) is the OPPOSITE
  // sign from the old left-wall version's (-CORONA on both) — the two
  // shapes are mirror images, not simple rotations, so the signs don't
  // carry over. Only built/used when showExtStairs; the plain vas
  // <rect>/<rect stroke> stay exactly as before otherwise. */
  const waterPathD = showExtStairs
    ? `M ${rectX} ${rectY} L ${rectX + rectW} ${rectY} L ${rectX + rectW} ${rectY + rectH} L ${rectX + extAlongWallPx} ${rectY + rectH} L ${rectX + extAlongWallPx} ${rectY + rectH + extProtrusionPx} L ${rectX} ${rectY + rectH + extProtrusionPx} Z`
    : null;
  const outerPathD = showExtStairs
    ? `M ${outerX} ${outerY} L ${outerX + outerW} ${outerY} L ${outerX + outerW} ${rectY + rectH + CORONA} L ${rectX + extAlongWallPx + CORONA} ${rectY + rectH + CORONA} L ${rectX + extAlongWallPx + CORONA} ${rectY + rectH + extProtrusionPx + CORONA} L ${outerX} ${rectY + rectH + extProtrusionPx + CORONA} Z`
    : null;

  return (
    <div>
      <svg viewBox={`0 0 ${Vw} ${Vh}`} width={`${Vw}mm`} height={`${Vh}mm`} style={{ display: "block" }}>
        <defs>
          {/* Corona — a single row of full-width coronament planks running
              along the perimeter, not a grid of small tiles. Pattern
              height is exactly CORONA (the ring's own width in SVG units)
              so only one row of pieces ever fits across the ring, never
              two stacked — and width is 2x that, matching the real ~31cm x
              62cm proportions of a coronament piece (short side = the
              corona's own width, long side = along the perimeter). Only a
              vertical joint line is drawn (at x=0, spanning the full
              height) — dividing consecutive pieces along the row — and NO
              horizontal line, since with a single row there's no second
              row to divide; the pattern repeating vertically would just
              redraw the same un-joined row, which is what we want. See the
              corona <rect> below for a caveat re: this pattern's fixed
              orientation on the ring's vertical sides/corners. */}
          <pattern id="corona-tiles" patternUnits="userSpaceOnUse" width={CORONA * 2} height={CORONA}>
            <rect width={CORONA * 2} height={CORONA} fill="#e8dcc0" />
            <line x1="0" y1="0" x2="0" y2={CORONA} stroke="#b8a67e" strokeWidth="0.3" />
          </pattern>
          {/* Same piece, rotated 90° — for the left/right ring segments
              (see the 4-segment corona below), where pieces run vertically
              instead of horizontally. A separate pattern with width/height
              swapped (rather than patternTransform="rotate(90)" on
              corona-tiles itself), so its own tile origin lines up with
              the left/right segments' own x/y independently — rotating
              the existing pattern in place would rotate around the SVG's
              origin, not each segment's own origin, drifting the joints
              out of alignment with where each segment actually starts. */}
          <pattern id="corona-tiles-vertical" patternUnits="userSpaceOnUse" width={CORONA} height={CORONA * 2}>
            <rect width={CORONA} height={CORONA * 2} fill="#e8dcc0" />
            <line x1="0" y1="0" x2={CORONA} y2="0" stroke="#b8a67e" strokeWidth="0.3" />
          </pattern>
          {/* Water — 4 stops now instead of a flat 2-stop fade, tracking the
              SAME flat/slope/vertex/drain depth profile ProfileView draws
              for its own section cut (bodyFlatEndX/bodyVertexX are computed
              above with the exact same formulas, so the "deepest point"
              lands at the same x in both views): the flat zone CONTINUES
              at lastStepColor (the same tone the escala's own last step —
              and the lateral space beside it — already ends on, see its
              own comment above for why: a seam-free handoff, not a fresh
              restart at a light color), then darkens further toward
              WATER_BODY_DEEP at the vertex, then eases back toward
              bodyDrainColor (an intermediate tone, not a fixed one — see
              its own comment) at the far wall. userSpaceOnUse + explicit
              rectX/rectX+rectW (not objectBoundingBox) so this reads as the
              same continuous body of water regardless of the vas rect's own
              bounding box. Only the vas rect (the main body) uses this now
              — the escala/plataforma/banc area below is painted with its
              own discrete per-step colors instead, not this gradient (but
              the two are stitched together at the shared boundary via
              lastStepColor). Falls back to the original flat 2-stop
              version when depth data is missing (hasDepthColor false). */}
          <linearGradient id="water-gradient" gradientUnits="userSpaceOnUse" x1={rectX} y1={rectY} x2={rectX + rectW} y2={rectY}>
            {hasDepthColor ? (
              <>
                <stop offset="0%" stopColor={lastStepColor} />
                <stop offset={`${((bodyFlatEndX - rectX) / rectW) * 100}%`} stopColor={lastStepColor} />
                <stop offset={`${((bodyVertexX - rectX) / rectW) * 100}%`} stopColor={WATER_BODY_DEEP} />
                <stop offset="100%" stopColor={bodyDrainColor} />
              </>
            ) : (
              <>
                <stop offset="0%" stopColor={WATER_SHALLOW} />
                <stop offset="100%" stopColor={WATER_DEEP} />
              </>
            )}
          </linearGradient>
        </defs>

        {/* Corona — 4 independent ring segments instead of one shared
            <rect>, so the tile pattern can follow each side's own running
            direction (per feedback on the earlier single-pattern version).
            Top/bottom span the FULL outer width — i.e. they each absorb
            both of their own corners — using corona-tiles (pieces running
            horizontally, vertical joints). Left/right then only need to
            fill the straight run of height rectH directly between top and
            bottom (not the corners), using corona-tiles-vertical (pieces
            running vertically, horizontal joints). Splitting it this way
            means the 4 segments tile the ring exactly, no gaps/overlaps,
            without needing any special corner-mitering geometry.
            No corner miter — the two orientations simply meet edge-to-edge
            where top/bottom end and left/right begin — but since none of
            the 4 fill rects are stroked individually (see the single
            outer-perimeter <rect> below instead), there's no visible seam
            line at those joins, just a plain, clean edge. */}
        <rect x={outerX} y={outerY} width={outerW} height={CORONA} fill="url(#corona-tiles)" />
        {/* Bottom — of the MAIN rect only now: shortened to start at the
            protrusion's own reflex vertex x (rectX+extAlongWallPx) when
            showExtStairs, since that corner is no longer a plain corner but
            where the protrusion attaches (its own bottom wall, below, takes
            over the ring from there). Still absorbs the vas's own
            bottom-right corner at its other end, unchanged. */}
        <rect
          x={showExtStairs ? rectX + extAlongWallPx : outerX}
          y={rectY + rectH}
          width={showExtStairs ? outerX + outerW - (rectX + extAlongWallPx) : outerW}
          height={CORONA}
          fill="url(#corona-tiles)"
        />
        {/* Left — extended down past rectY+rectH when showExtStairs, to
            cover the protrusion's own left wall too (a straight
            continuation of the same wall, not a corner — rectX is shared by
            both, so no miter/overlap trick is even needed here, unlike the
            other new segment below) and absorb its bottom-left corner. */}
        <rect
          x={outerX}
          y={rectY}
          width={CORONA}
          height={showExtStairs ? rectY + rectH + extProtrusionPx + CORONA - rectY : rectH}
          fill="url(#corona-tiles-vertical)"
        />
        <rect x={rectX + rectW} y={rectY} width={CORONA} height={rectH} fill="url(#corona-tiles-vertical)" />
        {showExtStairs && (
          <>
            {/* Protrusion's own bottom wall — absorbs its bottom-left corner
                (redundant with, but harmless alongside, the extended Left
                segment above) and its bottom-right corner (own outer edge). */}
            <rect
              x={outerX}
              y={rectY + rectH + extProtrusionPx}
              width={extAlongWallPx + 2 * CORONA}
              height={CORONA}
              fill="url(#corona-tiles)"
            />
            {/* Protrusion's own right wall — straight run ONLY, trimmed by
                CORONA at both ends so it does NOT reach into either of its
                two corner squares, mirroring how the base ring's Right
                segment (see above) spans exactly rectY..rectY+rectH and
                never overlaps the top/bottom corners Top/Bottom already
                absorb. Getting this wrong was the actual corona-joint bug:
                an earlier version spanned the FULL rectY+rectH..
                rectY+rectH+extProtrusionPx+CORONA range, deliberately
                overlapping both corner squares "for the fill segments below
                to absorb" — but since this rect is drawn AFTER Bottom (the
                shortened main-rect bottom segment, which owns the reflex
                corner by ending its own left edge exactly there) yet BEFORE
                nothing draws over it again, its vertical-grain pattern won
                the top corner square outright, leaving that one corner with
                joints running the wrong way vs. the other 3 (all
                horizontal-grain, per the established "Top/Bottom always own
                every corner" rule this ring otherwise follows everywhere
                else). The bottom corner square (shared with Protrusion's own
                bottom wall below) happened to render correctly regardless,
                only because that segment is drawn AFTER this one and so
                painted over the overlap — real, but accidental/fragile.
                Trimming this rect to the pure straight run avoids relying on
                draw-order luck at either corner: both are left entirely to
                their rightful horizontal-grain segment (Bottom above,
                Protrusion's own bottom wall below). */}
            <rect
              x={rectX + extAlongWallPx}
              y={rectY + rectH + CORONA}
              width={CORONA}
              height={extProtrusionPx - CORONA}
              fill="url(#corona-tiles-vertical)"
            />
          </>
        )}
        {/* Single continuous outer border for the whole ring, drawn
            separately (fill="none") on top of the fill segments above —
            keeps the corona's outer edge as one unbroken line instead of
            separate rect outlines that would double up at the segment
            joins. The inner edge is already covered by the vas outline's
            own stroke, drawn next. showExtStairs uses the 6-vertex L outer
            path instead of the plain rect (see outerPathD above). */}
        {showExtStairs ? (
          <path d={outerPathD as string} fill="none" stroke={DRAW} strokeWidth="0.5" />
        ) : (
          <rect x={outerX} y={outerY} width={outerW} height={outerH} fill="none" stroke={DRAW} strokeWidth="0.5" />
        )}
        {/* Vas — pool water body, painted over the frame to leave only the ring visible.
            Fill only, no stroke — the vessel's own border is redrawn as a
            separate, later pass (see "Vas outline, redrawn on top" below,
            right after the escala block) instead of stroking it here. The
            escala's own opaque water-color fills (base column, plataforma/
            banc, per-tread rects) are drawn after this rect and, at the
            shared wall, would otherwise paint over roughly half of a stroke
            drawn here — the border came out visibly thinner wherever an
            escala/plataforma/banc fill touched it than elsewhere around the
            perimeter. Redrawing the border on top of everything, once,
            fixes that instead of having to reorder every fill relative to
            it. showExtStairs fills the 6-vertex L water polygon instead of
            the plain vas rect (see waterPathD above) — continuous with the
            protrusion, no dividing wall, per the "single L-shaped body of
            water" design. */}
        {showExtStairs ? (
          <path d={waterPathD as string} fill="url(#water-gradient)" stroke="none" />
        ) : (
          <rect x={rectX} y={rectY} width={rectW} height={rectH} fill="url(#water-gradient)" stroke="none" />
        )}

        {/* Schematic stairs — shallow end, bottom corner, fixed convention,
            drawn to the same metres→mm scale as the pool itself.
            Riser count follows computeInteriorStepsCount(poolDepthMin), same 0.20m
            riser formula used for the exterior access stair elsewhere. */}
        {showStairs && (
          <g>
            {/* Water-color fills — depth-derived and fully opaque (no more
                translucent white wash over the gradient underneath: each
                fill below already IS the intended final color). 3 layers,
                back to front:
                 1. a base rect over the whole "column" above the escala's
                    own row (rectY→stairsY) in lastStepColor — exactly where
                    a plataforma/banc sits when there is one; where there
                    isn't (standard escala), or wherever one doesn't fully
                    reach (short banc/platform width, or a banc shorter than
                    the escala's own protrusion), this stays visible
                    underneath and reads as "same color as the last step"
                    per spec, with no separate case-by-case logic needed for
                    those gaps.
                 2. the plataforma/banc's own (smaller/more specific)
                    footprint on top of that, in step2Color.
                 3. the escala's own row, as one solid rect per tread
                    (darkening with each step down — see stepColor above),
                    replacing the old single uniform fill for the whole row.
                Falls back to a flat, opaque WATER fill in the same shapes
                the old translucent-white version used, when depth data is
                missing (hasDepthColor false) — not pixel-identical to the
                old look (no gradient shows through anymore), but this path
                only matters for incomplete project data. */}
            {hasDepthColor ? (
              <>
                {/* Fills the open water column between the vas's own top
                    wall and the escala's row (rectY→stairsY) so a
                    plataforma/banc (or a gap next to one) reads as "same
                    color as the last step" rather than the plain gradient. */}
                <rect x={stairsOriginX} y={rectY} width={stairsProtrusion} height={Math.max(0, stairsY - rectY)} fill={lastStepColor} />
                {showPlatform && <rect x={stairsOriginX} y={platformY} width={stairsProtrusion} height={platformAlongWall} fill={step2Color} />}
                {showBench && <rect x={stairsOriginX} y={benchY} width={benchProtrusion} height={benchAlongWall} fill={step2Color} />}
                {Array.from({ length: stepsCount }, (_, idx) => idx + 1).map((i) => (
                  <rect
                    key={i}
                    x={stairsOriginX + ((i - 1) * stairsProtrusion) / stepsCount}
                    y={stairsY}
                    width={stairsProtrusion / stepsCount}
                    height={stairsAlongWall}
                    fill={stepColor(i)}
                  />
                ))}
              </>
            ) : showBench ? (
              <>
                <rect x={stairsOriginX} y={stairsY} width={stairsProtrusion} height={stairsAlongWall} fill={WATER} />
                <rect x={stairsOriginX} y={benchY} width={benchProtrusion} height={benchAlongWall} fill={WATER} />
              </>
            ) : (
              <rect
                x={stairsOriginX}
                y={showPlatform ? platformY : stairsY}
                width={stairsProtrusion}
                height={showPlatform ? stairsAlongWall + platformAlongWall : stairsAlongWall}
                fill={WATER}
              />
            )}
            {showBench ? (
              <>
                {/* escala + banc outline — an L-shape (the banc's front
                    edge sits short of the escala's), so unlike plataforma
                    this can't be one closed <rect>: every border is drawn
                    as its own <line>, giving full control over which edges
                    exist. Fill is handled entirely above now — this is
                    stroke-only. */}
                <g stroke={DRAW} strokeWidth="0.5" fill="none">
                  {/* Wall — one continuous line covering both the banc's and escala's left edge. */}
                  <line x1={stairsOriginX} y1={benchY} x2={stairsOriginX} y2={stairsY + stairsAlongWall} />
                  {/* Escala's own right edge and far (bottom) wall. */}
                  <line x1={stairsOriginX + stairsProtrusion} y1={stairsY} x2={stairsOriginX + stairsProtrusion} y2={stairsY + stairsAlongWall} />
                  <line x1={stairsOriginX} y1={stairsY + stairsAlongWall} x2={stairsOriginX + stairsProtrusion} y2={stairsY + stairsAlongWall} />
                  {/* Banc's top and right edge. No line continues from
                      benchEdgeX to the escala's own front edge — that
                      stretch is open pool water, left undrawn on purpose. */}
                  <line x1={stairsOriginX} y1={benchY} x2={benchEdgeX} y2={benchY} />
                  <line x1={benchEdgeX} y1={benchY} x2={benchEdgeX} y2={stairsY} />
                </g>
              </>
            ) : (
              // Combined outline — escala + plataforma (when present) share
              // one continuous border; the boundary between them is drawn
              // separately below rather than as two abutting <rect>s, to
              // avoid a doubled-up seam stroke. fill="none" now (was the
              // single filled+stroked rect) — fill is handled entirely
              // above, this is stroke-only, drawn on top of it.
              <rect
                x={stairsOriginX}
                y={showPlatform ? platformY : stairsY}
                width={stairsProtrusion}
                height={showPlatform ? stairsAlongWall + platformAlongWall : stairsAlongWall}
                fill="none"
                stroke={DRAW}
                strokeWidth="0.5"
              />
            )}
            {/* Step risers — escala sub-region only; the platform portion
                stays smooth/unlined. Every riser is drawn in full, always —
                this is exactly the single-stairs geometry, unconditionally,
                with or without a plataforma alongside. No riser is ever
                omitted, since dropping one would merge two steps into one
                and break the staircase reading. (The escala/plataforma
                level-change-free crossing at step 2 is represented instead
                by a gap in the boundary line below, not by touching any
                riser here.) */}
            {Array.from({ length: Math.max(0, stepsCount - 1) }, (_, i) => i + 1).map((i) => {
              const x = stairsOriginX + (stairsProtrusion * i) / stepsCount;
              return <line key={i} x1={x} y1={stairsY} x2={x} y2={stairsY + stairsAlongWall} stroke={DRAW} strokeWidth="0.3" />;
            })}
            {showPlatform && (
              boundaryGapX1 !== null && boundaryGapX2 !== null ? (
                <>
                  {/* escala/plataforma boundary — wall up to the start of
                      step 2's tread, then resumes past it. The gap over
                      step 2 shows that stretch is walkable between the two
                      without a level change. */}
                  <line x1={stairsOriginX} y1={stairsY} x2={boundaryGapX1} y2={stairsY} stroke={DRAW} strokeWidth="0.4" />
                  <line x1={boundaryGapX2} y1={stairsY} x2={stairsOriginX + stairsProtrusion} y2={stairsY} stroke={DRAW} strokeWidth="0.4" />
                </>
              ) : (
                // Fewer than 2 interior risers — no "step 2" tread exists, so draw the boundary whole.
                <line x1={stairsOriginX} y1={stairsY} x2={stairsOriginX + stairsProtrusion} y2={stairsY} stroke={DRAW} strokeWidth="0.4" />
              )
            )}
            {showBench && (
              benchGapX1 !== null && benchGapX2 !== null && benchGapX1 < benchGapX2 ? (
                <>
                  {/* escala/banc boundary — same step-2 gap as plataforma,
                      but clipped to benchEdgeX (see benchGapX1/2 above): if
                      the banc ends before the gap would, the "after" segment
                      resumes immediately and runs all the way to the
                      escala's own front edge, covering both the rest of the
                      banc's row and the open-pool stretch beyond it in one
                      solid line. */}
                  <line x1={stairsOriginX} y1={stairsY} x2={benchGapX1} y2={stairsY} stroke={DRAW} strokeWidth="0.4" />
                  <line x1={benchGapX2} y1={stairsY} x2={stairsOriginX + stairsProtrusion} y2={stairsY} stroke={DRAW} strokeWidth="0.4" />
                </>
              ) : (
                // Gap falls entirely beyond the banc (or fewer than 2 risers exist) — solid boundary throughout.
                <line x1={stairsOriginX} y1={stairsY} x2={stairsOriginX + stairsProtrusion} y2={stairsY} stroke={DRAW} strokeWidth="0.4" />
              )
            )}

            {/* Llarg cota. The combined block (escala+plataforma) always
                spans the pool's full wall height by design — stairsWidth +
                platformWidth == poolWidth in computeSuggestions() — so
                there's no room left above it inside the pool for an
                "above the block" cota like the escala-only one below. This
                one instead sits INSIDE the platform, a couple mm below its
                top edge, measuring downward, so it always stays inside the
                water area regardless of how little room is left. */}
            {showPlatform ? (
              <Dimension
                orientation="horizontal"
                objPos={platformY + 2}
                outward={1}
                from={stairsOriginX}
                to={stairsOriginX + stairsProtrusion}
                label={`${fmtM(stairsLengthM)} m`}
                fontSize={2.6}
                offset={1.4}
                gap={0.4}
                overshoot={0.6}
                tick={0.3}
                labelGap={1.3}
                color={DIM_INTERIOR}
              />
            ) : showBench ? (
              <>
                {/* Escala's own llarg cota moved out of this block entirely
                    — it now renders as an external cota below the pool (see
                    "escala llarg cota — banc case, external" near the
                    Length/Width cotas at the end of the svg), since sitting
                    on top of the riser drawing here read poorly. Only the
                    banc's llarg cota stays in its plataforma-style spot,
                    inside the banc block near its own top edge. */}
                <Dimension
                  orientation="horizontal"
                  objPos={benchY + 2}
                  outward={1}
                  from={stairsOriginX}
                  to={benchEdgeX}
                  label={`${fmtM(benchLengthM)} m`}
                  fontSize={2.6}
                  offset={1.4}
                  gap={0.4}
                  overshoot={0.6}
                  tick={0.3}
                  labelGap={1.3}
                  color={DIM_INTERIOR}
                />
              </>
            ) : isTotAmple ? (
              // No "inside" llarg cota for tot_ample either — same as the
              // banc case, it renders externally below the pool instead
              // (see the escala llarg cota block near Length/Width, now
              // also gated on isTotAmple).
              null
            ) : (
              <Dimension
                orientation="horizontal"
                objPos={stairsY}
                outward={-1}
                from={stairsOriginX}
                to={stairsOriginX + stairsProtrusion}
                label={`${fmtM(stairsLengthM)} m`}
                fontSize={2.6}
                offset={1.6}
                gap={0.5}
                overshoot={0.8}
                tick={0.35}
                labelGap={1.6}
                color={DIM_INTERIOR}
              />
            )}
            {/* Ample cota — escala */}
            <Dimension
              orientation="vertical"
              objPos={stairsOriginX + stairsProtrusion}
              outward={1}
              from={stairsY}
              to={stairsY + stairsAlongWall}
              label={`${fmtM(stairsWidthM)} m`}
              fontSize={2.6}
              offset={2}
              gap={0.6}
              overshoot={0.8}
              tick={0.35}
              labelGap={1.6}
              color={DIM_INTERIOR}
            />
            {/* Tread width detail — the first step's own tread (rectX to
                firstTreadX), moved here from ProfileView (where it used to
                sit right against the waterline/wave with no clean room once
                the corona pushed things around — see ProfileView's riser
                detail cota comment). Same "single representative step"
                idea and same fixed 0.30m label (fmtM(0.3) — no real field
                backs this value, it's schematic regardless of the pool's
                actual computed tread width, per the same explicit
                confirmation ProfileView's version used). Positioned INSIDE
                the escala block near its bottom edge (objPos=stairsY+
                stairsAlongWall−1.5, outward=−1 i.e. pointing up into the
                box) rather than the top: the top edge doubles as the
                escala/plataforma or escala/banc boundary line in those
                cases, so the bottom stays clear in all 4 interiorStairsType
                variants. Well clear of the Ample cota above (that one's on
                the FAR edge, x=rectX+stairsProtrusion, whereas this sits
                against the near wall) and of the riser lines (0.3 stroke,
                not a cota). Guarded on stepsCount>=2 (showTreadDetailCota):
                with only 1 step there's no first riser line to bound the
                tread against. Small detail-cota sizing, matching
                ProfileView's own detailFontSize/detailOffset/etc. */}
            {showTreadDetailCota && (
              <Dimension
                orientation="horizontal"
                objPos={stairsY + stairsAlongWall - 1.5}
                outward={-1}
                from={stairsOriginX}
                to={firstTreadX}
                label={`${fmtM(0.3)} m`}
                fontSize={1.8}
                offset={1}
                gap={0.6}
                overshoot={0.4}
                tick={0.2}
                labelGap={0.8}
                color={DIM_INTERIOR}
              />
            )}
            {/* Ample cota — plataforma, same reference line as the escala
                one (same objPos/offset), just adjoining it above. */}
            {showPlatform && (
              <Dimension
                orientation="vertical"
                objPos={stairsOriginX + stairsProtrusion}
                outward={1}
                from={platformY}
                to={stairsY}
                label={`${fmtM(platformWidthM)} m`}
                fontSize={2.6}
                offset={2}
                gap={0.6}
                overshoot={0.8}
                tick={0.35}
                labelGap={1.6}
                color={DIM_INTERIOR}
              />
            )}
            {/* Ample cota — banc. objPos anchors to the banc's own front
                edge (benchEdgeX) rather than the escala's, since the banc
                is often shorter than the escala (benchProtrusion <
                stairsProtrusion) and sharing the escala's edge left this
                cota visually detached from the banc drawing it labels. */}
            {showBench && (
              <Dimension
                orientation="vertical"
                objPos={benchEdgeX}
                outward={1}
                from={benchY}
                to={stairsY}
                label={`${fmtM(benchWidthM)} m`}
                fontSize={2.6}
                offset={2}
                gap={0.6}
                overshoot={0.8}
                tick={0.35}
                labelGap={1.6}
                color={DIM_INTERIOR}
              />
            )}
          </g>
        )}

        {/* Ext-stairs block — "Escala Exterior d'Obra", 'estandard' look
            only (plataforma/banc/tot_ample not supported here yet — see
            showExtStairs comment above; interiorStairsType is ignored for
            this block entirely). Rotated 90° from the carved-in escala
            above: treads stack downward (y) instead of sideways (x), risers
            are horizontal lines instead of vertical ones, growing from
            extOriginY (the vas's own bottom wall) instead of from a side
            wall. Same stepColor/hasDepthColor fallback logic reused as-is —
            only the axis differs, not the coloring.
            Tread-to-index mapping is DELIBERATELY reversed from the naive
            "i-1 offset from extOriginY" the carved-in block's own x formula
            would suggest copying: stepColor ramps light→dark as i goes
            1→stepsCount, and stepsCount must land on the tread touching
            OPEN WATER (so it matches lastStepColor/the flat zone right next
            to it — see stepColor's own comment). In the carved-in block
            that's the high-x end (open pool is at stairsOriginX+
            stairsProtrusion, away from the wall at stairsOriginX), so
            index i increasing with x already puts stepsCount there
            correctly. Here open water is the OPPOSITE end from the
            wall-side offset direction: extOriginY (low y, top of the
            block) is where it's continuous with the vas, while the wall
            (obra) is at high y (extOriginY+extProtrusionPx). Indexing y the
            same "low y ← i=1" way as the carved-in block's x would put
            i=1 (lightest) next to the open water and stepsCount (darkest)
            next to the wall — backwards, since open water needs the DARK
            end. Flipping the y formula to (stepsCount-i) instead of (i-1)
            fixes it: i=1 now lands at high y (wall, lightest) and
            i=stepsCount lands at low y (open water, darkest). */}
        {showExtStairs && (
          <g>
            {hasDepthColor ? (
              Array.from({ length: stepsCount }, (_, idx) => idx + 1).map((i) => (
                <rect
                  key={i}
                  x={extOriginX}
                  y={extOriginY + ((stepsCount - i) * extProtrusionPx) / stepsCount}
                  width={extAlongWallPx}
                  height={extProtrusionPx / stepsCount}
                  fill={stepColor(i)}
                />
              ))
            ) : (
              <rect x={extOriginX} y={extOriginY} width={extAlongWallPx} height={extProtrusionPx} fill={WATER} />
            )}
            {/* No separate outline rect here — unlike the carved-in block,
                every edge of this block (left/right/bottom) is already part
                of the L water polygon's own outer perimeter (see
                waterPathD), redrawn on top further down (same "redraw on
                top of the fills" pass the carved-in escala relies on for
                its own shared wall). The top edge is deliberately never
                stroked anywhere — it's the open boundary where this block's
                water is continuous with the main vas, no dividing wall. */}
            {/* Risers — horizontal now (constant y, spanning x). Unlike the
                carved-in block's own risers (which only need the
                stepsCount-1 INTERNAL dividers, because its own closing edge
                at the open-water side doubles as the last riser via the
                "combined outline" rect stroke — see that block's own
                comment), this block's open-water edge (y=extOriginY, the
                top) is deliberately never stroked by the L-polygon's own
                perimeter (see waterPathD's comment: no dividing wall there).
                That edge is still a real physical riser though — the last
                tread (i=stepsCount, darkest, flush with the flat zone's
                depth) still has its own riser face dropping onto the pool
                floor, exactly like every other tread does. So this loop
                covers i=0..stepsCount-1 (stepsCount lines total: the
                open-water closing riser at i=0, PLUS the stepsCount-1
                internal dividers) instead of the carved-in block's
                i=1..stepsCount-1 — i=stepsCount itself (the wall-side edge,
                y=extOriginY+extProtrusionPx) is intentionally excluded since
                that one's already covered by the L-polygon's own stroke. */}
            {Array.from({ length: stepsCount }, (_, i) => i).map((i) => {
              const y = extOriginY + (extProtrusionPx * i) / stepsCount;
              return <line key={i} x1={extOriginX} y1={y} x2={extOriginX + extAlongWallPx} y2={y} stroke={DRAW} strokeWidth="0.3" />;
            })}
            {/* Ample cota (extStairsWidth, along the wall) — horizontal,
                below the block's own corona. offset/gap reuse the same
                "clear the corona, short centered crossing" recipe
                stairsLengthExtOffset/stairsLengthExtGap already use for the
                banc/tot_ample external llarg cota elsewhere on this page
                (CORONA + a few mm, not the tiny in-block offset the interior
                escala's own Ample/plataforma/banc cotas use — those sit
                INSIDE the water area against a wall, this one sits OUTSIDE
                the ext-stairs block's own corona, needing real clearance
                past it). The Llarg cota (extStairsLength) moved out of this
                block entirely — it now shares the vas's own Width cota's
                line (same objPos/offset), see further down. */}
            <Dimension
              orientation="horizontal"
              objPos={extOriginY + extProtrusionPx}
              outward={1}
              from={extOriginX}
              to={extOriginX + extAlongWallPx}
              label={`${fmtM(data.extStairsWidth)} m`}
              fontSize={2.6}
              offset={stairsLengthExtOffset}
              gap={stairsLengthExtGap}
              overshoot={mainDimOvershoot}
              tick={0.3}
              labelGap={1.3}
              color={DIM_INTERIOR}
            />
            {/* Tread width detail — see extFirstTreadY/showExtTreadDetailCota
                above. Vertical orientation (span is along y here, the
                block's own tread axis), positioned INSIDE the block near its
                right edge (objPos=extAlongWallPx-1.5, outward=-1, pointing
                left/into the block) rather than centered, so it stays clear
                of the risers (0.3 stroke, not a cota) and of the Ample cota
                below (which sits OUTSIDE, south of the wall edge — this one
                never leaves the block's own interior). Same small sizing as
                the carved-in block's own tread-width detail cota
                (fontSize/offset/gap/overshoot/tick/labelGap all copied from
                there). horizontalLabel: same reasoning as ProfileView's own
                single-riser-height detail cota — a single tread's height is
                too short a span for the rotated label to read cleanly. */}
            {showExtTreadDetailCota && (
              <Dimension
                orientation="vertical"
                objPos={extOriginX + extAlongWallPx - 1.5}
                outward={-1}
                from={extFirstTreadY}
                to={extOriginY + extProtrusionPx}
                label={`${fmtM(0.3)} m`}
                fontSize={1.8}
                offset={1}
                gap={0.6}
                overshoot={0.4}
                tick={0.2}
                labelGap={0.8}
                horizontalLabel
                color={DIM_INTERIOR}
              />
            )}
          </g>
        )}

        {/* Vas outline, redrawn on top — see the vas fill's own comment
            above for why: this is the SAME border that used to be stroked
            directly on that fill, just moved to draw last (after the
            escala/plataforma/banc fills, which sit earlier and would
            otherwise cover part of it at the shared wall), so the
            perimeter reads as a uniform stroke width all the way around
            regardless of what's underneath it. showExtStairs strokes the
            6-vertex L water polygon instead of the plain vas rect, same as
            the fill pass above. */}
        {showExtStairs ? (
          <path d={waterPathD as string} fill="none" stroke={DRAW} strokeWidth="0.6" />
        ) : (
          <rect x={rectX} y={rectY} width={rectW} height={rectH} fill="none" stroke={DRAW} strokeWidth="0.6" />
        )}

        {/* Length — measures the vas (water body / rectX,rectY,rectW,rectH),
            not the outer corona rect: rectW/rectH are exactly
            length*scale/width*scale, i.e. the interior water area, while
            outerW/outerH additionally include the hatched corona margin
            around it. Same Dimension component as every other cota on this
            page, including the profile view's depth cotas.
            Offset is mainDimOffset (= CORONA + DIM_OFFSET) rather than the
            plain default: the objPos is now the vas edge (not the corona's
            outer edge as before), so without adding the corona's own width
            back in, the dimension line and its tick marks would land
            right at/inside the hatched corona instead of clearing it. This
            reproduces the exact clearance topMargin/leftMargin were already
            tuned for.
            tick/gap/overshoot use mainDimTick/mainDimGap/mainDimOvershoot
            (smaller tick, shorter overshoot than the shared defaults, and a
            gap sized so offset−gap ≈ overshoot) so the whole cota reads
            clearly detached from the corona while the crossing at each
            corner stays a short, centered mark — see their definitions
            above. */}
        <Dimension
          orientation="horizontal"
          objPos={rectY}
          outward={-1}
          from={rectX}
          to={rectX + rectW}
          label={`${fmtM(length)} m`}
          fontSize={4}
          offset={mainDimOffset}
          gap={mainDimGap}
          overshoot={mainDimOvershoot}
          tick={mainDimTick}
        />
        {/* Width — same vas-edge reasoning and offset as Length above. */}
        <Dimension
          orientation="vertical"
          objPos={rectX}
          outward={-1}
          from={rectY}
          to={rectY + rectH}
          label={`${fmtM(width)} m`}
          offset={mainDimOffset}
          fontSize={4}
          gap={mainDimGap}
          overshoot={mainDimOvershoot}
          tick={mainDimTick}
        />
        {/* Llarg cota — ext-stairs (extStairsLength), sharing the exact
            same line as Width above (same objPos=rectX, outward=-1, offset)
            instead of its own separate line on the block's right edge — a
            straight continuation downward past Width's own span
            (rectY..rectY+rectH), covering the protrusion's span
            (extOriginY..extOriginY+extProtrusionPx, and extOriginY===
            rectY+rectH so the two spans meet with no gap or overlap). Kept
            at the smaller interior-cota font/color (DIM_INTERIOR) rather
            than matching Width's own navy/fontSize=4 — it's still labelling
            the escala, not the vas, just positioned on the vas's sight-line
            for a clean, consistent, uncluttered layout. */}
        {showExtStairs && (
          <Dimension
            orientation="vertical"
            objPos={rectX}
            outward={-1}
            from={extOriginY}
            to={extOriginY + extProtrusionPx}
            label={`${fmtM(data.extStairsLength)} m`}
            offset={mainDimOffset}
            fontSize={2.6}
            gap={mainDimGap}
            overshoot={mainDimOvershoot}
            tick={mainDimTick}
            labelGap={1.6}
            color={DIM_INTERIOR}
          />
        )}
        {/* escala llarg cota — banc AND tot_ample cases, external. Drawn
            inside the escala block it either sits on top of the riser lines
            (banc) or has nowhere left to go since the block already spans
            the pool's full wall height (tot_ample) — both read poorly, so
            both render below the pool instead, lines outside the
            rect+corona like Length/Width, just spanning only the escala's
            own x-range (rectX to rectX+stairsProtrusion) instead of the
            whole pool.
            Offset/gap use stairsLengthExtOffset/stairsLengthExtGap rather
            than mainDimOffset/mainDimGap — sitting at the full main-cota
            offset left a lot of empty space between this cota and the
            corona, so it uses a shorter offset instead, with gap re-derived
            the same way (offset − overshoot) to keep the crossing centered
            and small at that shorter distance. overshoot itself is still
            shared with Length/Width (mainDimOvershoot) since both want the
            same short crossing length.
            fontSize/tick/labelGap stay at the small interior-cota values
            (matching benchLengthM's own llarg cota above) — those are pure
            visual-size props, independent of the offset/gap/overshoot
            family above. */}
        {showStairs && (showBench || isTotAmple) && (
          <Dimension
            orientation="horizontal"
            objPos={rectY + rectH}
            outward={1}
            from={stairsOriginX}
            to={stairsOriginX + stairsProtrusion}
            label={`${fmtM(stairsLengthM)} m`}
            fontSize={2.6}
            offset={stairsLengthExtOffset}
            gap={stairsLengthExtGap}
            overshoot={mainDimOvershoot}
            tick={0.3}
            labelGap={1.3}
            color={DIM_INTERIOR}
          />
        )}
      </svg>
      {(showStairs || showExtStairs) && (
        <div style={{ fontSize: "7.5pt", color: DRAW, fontStyle: "italic", marginTop: "1mm" }}>
          * Posició de l'escala esquemàtica — no correspon a la ubicació exacta d'obra.
        </div>
      )}
    </div>
  );
}

// How far into the remaining span (after the flat stairs-base zone) the
// deepest point sits, as a fraction from 0 (right at the end of the flat
// zone) to 1 (right at the opposite wall). No exact rule was given for this
// — kept as a named constant specifically so it's easy to retune without
// hunting through the geometry math. Raised from the initial 0.5 (dead
// center) to 0.75 per user feedback: the deepest point should read as
// closer to the opposite (non-stairs) wall, not centered in the pool.
const maxDepthPositionRatio = 0.75;

function ProfileView({ data }: { data: PdfData }) {
  const dMin = data.poolDepthMin;
  const dMax = data.poolDepthMax;
  if (typeof dMin !== "number" || typeof dMax !== "number" || dMin <= 0 || dMax <= 0) {
    return (
      <div style={{ fontSize: "9pt", fontStyle: "italic", color: DRAW }}>
        Dades de profunditat no disponibles per generar el tall lateral.
      </div>
    );
  }
  // The opposite (non-stairs) wall does NOT end at the mathematical
  // average of min/max depth — per the técnica's construction spec, it's
  // always built at a fixed dMax − 0.10m, for the desguàs (drain). This is
  // a construction constant, not a computed average — poolDepthAvg plays
  // no role in this view at all anymore.
  const drainDepth = dMax - 0.1;
  const length = data.poolLength && data.poolLength > 0 ? data.poolLength : 8;
  // Needed for computePlanRect (scale is jointly bound by both length AND
  // width in PlanView — see its Math.min), even though ProfileView itself
  // never draws anything using poolWidth directly.
  const width = data.poolWidth && data.poolWidth > 0 ? data.poolWidth : 4;
  // Same field/fallback PlanView uses for the escala's protrusion into the
  // pool (see stairsLengthM there) — the flat base zone at the stairs wall
  // is exactly that same real-world length.
  const stairsNums = parseMetersList(data.stairsDimensions);
  const stairsWidthM = stairsNums[0] > 0 ? stairsNums[0] : 0.9;
  const stairsLengthM = stairsNums[1] > 0 ? stairsNums[1] : stairsWidthM * 0.8;
  const stepsCount = computeInteriorStepsCount(dMin);

  // Vw MUST stay PLAN_VW (not just "the same number") — both this <svg> and
  // PlanView's render at width="182mm" with a viewBox of the same width, so
  // 1 viewBox unit = 1 physical mm on the page for both. That's what makes
  // reusing PlanView's rectX/rectW (below) as profX/profW actually line up
  // the two views' pool walls on the printed page, not just numerically.
  const Vw = PLAN_VW;
  // Wall alignment with PlanView — scale/rectX/rectW come from the exact
  // same computePlanRect(length, width) PlanView itself uses, instead of
  // this view computing its own independent horizontal fit. profX/profW
  // replace the old leftMargin/rightMargin/hScale-based layout entirely:
  // the pool footprint's horizontal position and width are now dictated by
  // PlanView, not chosen locally here. Deliberately ext-stairs-independent
  // (same as PlanView's own scale) — ProfileView never draws the
  // ext-stairs protrusion itself, only PlanView does.
  const { scale, rectX, rectW } = computePlanRect(length, width);
  const profX = rectX;
  const profW = rectW;
  const endX = profX + profW;
  // Corona, in section — deliberately its own constant, not the module-level
  // CORONA (=4, PlanView's ring thickness): a section cut reads better with
  // a visibly thinner slab than PlanView's plan-view ring does, so this is
  // roughly half of it.
  const PROFILE_CORONA = 2;
  // The corona physically cantilevers past the pool walls on both sides —
  // per the técnica, about 1.5cm of overhang — rather than sitting flush
  // with them. Converted from real metres to viewBox mm through the same
  // `scale` PlanView's own horizontal dimensions use (this IS a genuine
  // physical measurement of the pool, unlike PROFILE_CORONA above which is
  // just a drawing-thickness convention), so the overhang stays physically
  // accurate at any pool size/print scale.
  const CORONA_OVERHANG_M = 0.015;
  const coronaOverhangX = CORONA_OVERHANG_M * scale;
  // topMargin/bottomMargin only need to fit ProfileView's OWN vertical
  // content (the llarg cota now sits above the waterline, see below) —
  // they're independent of PlanView's own margins, unlike the horizontal
  // ones. availH (and so vScale, and the pool's own vertical proportions)
  // stays 42 regardless of exactly how topMargin/bottomMargin split the
  // remaining Vh between them. topMargin itself is grown by PROFILE_CORONA
  // (below) to fit the new corona block above waterlineY — same "grow the
  // canvas, don't compress what already works" approach used elsewhere on
  // this page, so the Length cota that already lives in this margin keeps
  // exactly the headroom it had before.
  const topMargin = 22 + PROFILE_CORONA;
  const bottomMargin = 9;
  const availH = 42;
  const Vh = topMargin + availH + bottomMargin;

  const vScale = availH / Math.max(dMax, 0.01);

  // waterlineY is the construction reference level — the corona's own top
  // edge, built straight, per the técnica's spec — NOT the actual water
  // surface. Every depth/riser/platform/llarg cota below still measures
  // from here: pool depths are built relative to the coping, not the
  // water, so they must keep referencing this level rather than
  // waterActualY. Only the visual water fill and wave (waterActualY, just
  // below) sit lower than this.
  const waterlineY = topMargin;
  const minY = waterlineY + dMin * vScale;
  const maxY = waterlineY + dMax * vScale;
  const drainY = waterlineY + drainDepth * vScale;
  // Real water surface — always 10cm below the corona's top edge
  // (waterlineY), per the técnica: the corona is built level and the water
  // sits below it, never coincident with it. Only used for the wave line
  // and the fill's own top edge (see fillPathD below).
  const waterActualY = waterlineY + 0.1 * vScale;

  // Floor profile, stairs wall → opposite wall:
  //  1. flat at dMin, stairsLengthM long (the stairs' structural base —
  //     must be level for construction, even though the visible steps
  //     within it descend from the waterline down to dMin — see the
  //     staircase overlay path below).
  //  2. slope down from the flat zone's end to a single vertex at dMax —
  //     no flat run at the bottom, just the one deepest point.
  //  3. slope up from that vertex to the opposite wall, ending at drainDepth
  //     (dMax − 0.10m) — a fixed construction height for the desguàs
  //     (drain), not the mín/màx average.
  // Previously clamped to half of profW like PlanView clamps
  // stairsProtrusion, but that was cutting the flat zone shorter here than
  // the escala actually draws in PlanView (same stairsLengthM, same
  // metres→mm scale, now shared exactly via computePlanRect) whenever the
  // pool was short or the escala relatively long — the two views no longer
  // matched geometrically. Relaxed to 0.9: still a safety net against
  // stairsLengthM consuming the *entire* profile (which would collapse the
  // slope/vertex/end segments that follow it into zero width), but
  // permissive enough that it only ever kicks in for genuinely extreme
  // input, not normal proportions.
  const flatWidth = Math.min(stairsLengthM * scale, profW * 0.9);
  const flatEndX = profX + flatWidth;
  const vertexX = flatEndX + maxDepthPositionRatio * (endX - flatEndX);

  // Profunditat mitjana marker — informative only (not a contour-line
  // cota), reintroduced per feedback after the earlier redesign dropped it.
  // Positioned ON the down-slope from (flatEndX,minY) to (vertexX,maxY),
  // at the point where depth along that straight segment equals
  // poolDepthAvg, found by linear interpolation (depth increases linearly
  // with t along the segment, from dMin at t=0 to dMax at t=1). Since
  // depthAvg is BY DEFINITION the midpoint of dMin/dMax, avgT always comes
  // out to exactly 0.5 — the interpolation is written out explicitly
  // anyway (rather than hardcoding 0.5) so the geometry stays correct if
  // this marker's definition ever changes to something other than the
  // strict average.
  const depthAvg = (dMin + dMax) / 2;
  const avgT = dMax > dMin ? (depthAvg - dMin) / (dMax - dMin) : 0.5;
  const avgMarkerX = flatEndX + avgT * (vertexX - flatEndX);
  const avgMarkerY = waterlineY + depthAvg * vScale;
  // Text baseline for the label, drawn lower than avgMarkerY (see the JSX
  // below) — offset straight down, avgMarkerX unchanged — so it sits clear
  // of the slope line instead of straddling it: at that x, the slope itself
  // is AT avgMarkerY, so anything with a larger y than that is already
  // outside the pool contour, in the blank margin below it. +8 keeps the
  // worst case (avgMarkerY at its max, i.e. depthAvg ≈ dMax) within
  // bottomMargin (9) with a little room to spare.
  const avgMarkerLabelY = avgMarkerY + 8;

  // Zero, deliberately — not just "small" like the first attempt (3mm)
  // still was. See the depth-max Dimension below: pos = objPos +
  // outward*offset is the x the dimension line/ticks actually render at;
  // with offset=0, pos === objPos === vertexX exactly, for any slope
  // steepness, with zero residual drift. gap is 0 too, for the same
  // reason — a nonzero gap would start the extension line away from
  // vertexX even though the dimension line itself sits exactly on it,
  // visually disconnecting the two. overshoot alone (still
  // mainDimOvershoot) is enough to give the extension line a short,
  // visible nub past the vertex.
  const vertexDimOffset = 0;
  const vertexDimGap = 0;
  // Drain-depth cota (right wall) needs to reliably fit within
  // PLAN_RIGHT_MARGIN (10mm) — see the comment on that Dimension below for
  // why that's tighter than mainDimOffset was designed for. 4mm offset + a
  // tightened 1.2mm labelGap + the rotated label's own small footprint
  // (fontSize is the Dimension default 3.6, unchanged here) comfortably
  // clears 10mm with margin to spare, even in the worst case.
  const edgeDimOffset = 4;
  const edgeDimGap = edgeDimOffset - mainDimOvershoot;

  // Fill shape (straight top — the wavy waterline is drawn separately on
  // top so the two don't overlap into a doubled edge) and its contour, which
  // deliberately excludes the top edge for the same reason.
  // Top edge of the fill sits at waterActualY (real water surface), not
  // waterlineY (corona top) — the 10cm gap between the two is left
  // unpainted, reading as the dry corona/wall strip above the water.
  // outlinePathD (the structural wall/floor contour) still starts and ends
  // at waterlineY: the walls themselves are built up to the corona, and
  // stay there in the drawing regardless of where the water sits.
  const fillPathD = `M ${profX} ${waterActualY} L ${endX} ${waterActualY} L ${endX} ${drainY} L ${vertexX} ${maxY} L ${flatEndX} ${minY} L ${profX} ${minY} Z`;
  const outlinePathD = `M ${profX} ${waterlineY} L ${profX} ${minY} L ${flatEndX} ${minY} L ${vertexX} ${maxY} L ${endX} ${drainY} L ${endX} ${waterlineY}`;

  // Staircase overlay — riser+tread zigzag from the waterline down to dMin,
  // spanning exactly the flat zone (see stairsProfilePath: by construction
  // it lands at flatEndX/minY regardless of step count). Purely a visual
  // detail drawn over the already-flat floor, same idea as PlanView's riser
  // lines over its escala rect; doesn't affect fillPathD/outlinePathD.
  // totalRisers = stepsCount + 1: computeInteriorStepsCount already subtracts one
  // riser "because the pool floor counts as the last step" (see its own
  // doc comment) — added back here since every riser, including that last
  // one down onto the floor, needs to actually be drawn.
  const totalRisers = stepsCount + 1;
  // totalRisers risers span the full flat zone width using only
  // totalRisers-1 treads (see stairsProfilePath) — the last riser has no
  // trailing tread, it lands directly at flatEndX/minY where the slope
  // starts. Guarded for the (unrealistic for a real pool) totalRisers<=1
  // edge case, where there are no treads to space out at all.
  const stairsTreadW = totalRisers > 1 ? flatWidth / (totalRisers - 1) : 0;
  const riserH = (minY - waterlineY) / totalRisers;
  const stairsProfileD = stairsProfilePath(profX, waterlineY, stairsTreadW, riserH, totalRisers);

  // "escala amb plataforma" schematic overlay (side view) — same field
  // condition PlanView's isPlataforma/showPlatform use, but this view
  // doesn't need platformWidthM/platformAlongWall: those describe the
  // platform's extent ALONG the wall, an axis this side-on cut doesn't
  // show. Drawn as an inverted L: a raised shelf sitting at the level of
  // the SECOND step, then dropping to the escala floor. Reuses
  // stairsTreadW/riserH/totalRisers as-is (the exact values the zigzag
  // above is built from) rather than recomputing the second step's
  // position independently, so the two can't drift apart:
  //  - after riser 1 the zigzag is at (profX+stairsTreadW, waterlineY+riserH);
  //  - riser 2 then drops it, AT THAT SAME x, to waterlineY+2*riserH —
  //    exactly platformStartX/platformLevelY below. That's "the point
  //    corresponding to the second step, at the x where the second riser
  //    falls" per spec.
  // From there the shelf runs flat to flatEndX (where the slope starts,
  // same point the last riser of the main zigzag also lands on) and falls
  // straight down to minY (the escala floor level).
  const isPlataformaProfile = data.interiorStairsType === "plataforma" && !!data.hasPlatform;
  const showPlatformProfile = isPlataformaProfile && totalRisers >= 2;
  const platformLevelY = waterlineY + 2 * riserH;
  const platformStartX = profX + stairsTreadW;
  const platformProfileD = `M ${platformStartX} ${platformLevelY} L ${flatEndX} ${platformLevelY} L ${flatEndX} ${minY}`;

  // Platform height cota — plataforma case only. platformHeight is the
  // third value in data.platformDimensions ("W x L x H", see
  // budgetSave.ts), same field/order isPlataforma above already parses the
  // first two (width/length) from — parsed again here rather than reusing a
  // shared array since this component only needs the height and keeping the
  // read local to where it's used is clearer than threading a 3rd index
  // through an unrelated width var.
  const platformHeightNums = isPlataformaProfile ? parseMetersList(data.platformDimensions) : [];
  const platformHeightM = platformHeightNums[2] > 0 ? platformHeightNums[2] : undefined;
  const showPlatformHeightCota = showPlatformProfile && platformHeightM !== undefined;

  // Escala llarg cota — ALWAYS shown (all 4 interiorStairsType values),
  // unlike the plataforma-only shelf above: it measures the escala's own
  // flat base zone (profX to flatEndX), independent of whether a
  // plataforma/banc sits on top of it. External, below the pool contour —
  // same idea as PlanView's banc/tot_ample external stairsLength cota, and
  // deliberately the opposite side (below) from this view's own Length
  // cota (above the waterline, see below) so the two never compete for the
  // same space. Small interior-cota sizing (matches the plataforma-style
  // cotas), objPos=minY (the escala's own floor level, not the pool's
  // deepest point) since this cota only spans the escala's own x-range and
  // minY already sits well clear of maxY/Vh for any realistic depth.
  const showStairsLengthCota = !!data.hasInteriorStairs;

  // Single-step construction-detail cota — riser height for ONE
  // representative step, as opposed to the escala-llarg cota above which
  // measures the whole flat zone. Shown under the same condition
  // (hasInteriorStairs), for all 4 types. Needs a "second step" to exist
  // (totalRisers>1): this cota measures the SECOND riser specifically (see
  // the Dimension below for why), which only exists past that guard.
  // (The equivalent tread-width detail cota now lives in PlanView instead
  // — see showTreadDetailCota there — since here it sat right against the
  // waterline/wave with nowhere clean to go once the corona pushed things
  // around; PlanView's escala-in-plan drawing has a natural empty first-step
  // box for it.)
  //
  // Riser height uses the ACTUAL computed value for this pool
  // (dMin/totalRisers — the very same division riserH itself, passed into
  // stairsProfilePath above, is built from) rather than hardcoding 0.20:
  // the 0.20m baked into computeInteriorStepsCount's formula is a target/nominal
  // riser height, and Math.round there means a specific pool's
  // dMin/totalRisers doesn't always land on exactly 0.20 once rounded —
  // showing the real number keeps this cota consistent with the riser
  // actually drawn, never off by a centimeter or two from it. Every riser
  // is the same height, so measuring the second one instead of the first
  // (see the Dimension below) doesn't change this value.
  const riserHeightM = dMin / totalRisers;
  const showStepDetailCota = showStairsLengthCota && totalRisers > 1;

  // Deliberately smaller than the small-interior sizing used elsewhere in
  // this view (fontSize 2.6/offset 1.4, e.g. the platform height/escala
  // llarg cotas above) so these two read as an even finer, more specific
  // annotation and don't visually compete with the zigzag they sit right
  // next to.
  const detailFontSize = 1.8;
  const detailOffset = 1;
  const detailOvershoot = 0.4;
  const detailGap = detailOffset - detailOvershoot;
  const detailTick = 0.2;
  const detailLabelGap = 0.8;

  return (
    <svg viewBox={`0 0 ${Vw} ${Vh}`} width={`${Vw}mm`} height={`${Vh}mm`} style={{ display: "block" }}>
      <defs>
        {/* Same tiled-piece pattern PlanView's own corona ring uses
            (geometry/colors copied 1:1 from there). The joint SPACING
            (pattern width, the piece's "long" dimension) deliberately stays
            tied to the module-level CORONA — i.e. the SAME absolute value
            PlanView's own pattern uses (CORONA*2) — rather than scaling
            down with PROFILE_CORONA the way an earlier version did
            (PROFILE_CORONA*2). Both views render at 1 viewBox unit = 1
            physical page mm, so shrinking width together with thickness
            didn't just make the strip thinner, it also doubled the joint
            frequency per mm of page — the pieces read as visibly more
            cramped here than in PlanView, not just narrower. Keeping width
            at the plan's own absolute scale (only height/thickness uses
            PROFILE_CORONA) restores the same visual joint "rhythm" in both
            views, at the cost of the piece's own short:long proportion no
            longer matching the ~1:2 real coronament format here — a
            deliberate trade-off for cross-view consistency. Defined again
            here, local to this <svg>, rather than referenced across the two
            views' separate root <svg> elements: each page's <svg> gets
            serialized to its own image independently when the PDF is
            rendered, so a cross-svg url(#corona-tiles) reference wouldn't
            resolve at export time even though it can work in a live browser
            preview. In section the corona always runs horizontally (this is
            a single straight cut through it, not a ring with corners to
            turn), so only the horizontal variant (vertical joints) is
            needed — no equivalent of PlanView's corona-tiles-vertical
            here. */}
        <pattern id="corona-tiles" patternUnits="userSpaceOnUse" width={CORONA * 2} height={PROFILE_CORONA}>
          <rect width={CORONA * 2} height={PROFILE_CORONA} fill="#e8dcc0" />
          <line x1="0" y1="0" x2="0" y2={PROFILE_CORONA} stroke="#b8a67e" strokeWidth="0.3" />
        </pattern>
        {/* Water fill — vertical depth gradient, reusing the SAME 3 anchors
            PlanView's own water coloring settled on (see the module-level
            WATER_STEP_LIGHT/WATER_STEP_DARK/WATER_BODY_DEEP definitions and
            PlanView's water-gradient), not WATER_SHALLOW: after PlanView's
            last redesign, WATER_SHALLOW is only its no-depth-data fallback
            color, no longer tied to "shallow" anywhere in the real
            gradient — WATER_STEP_LIGHT is the actual lightest tone the page
            uses for shallow water. Unlike PlanView's own horizontal
            gradient, this doesn't need to trace flatEndX/vertexX/drain
            proportionally — it's a single straight top-to-bottom read (the
            water only gets deeper going down in a section cut, no
            horizontal component to it), so a plain 3-stop vertical gradient
            is enough: light at the surface, WATER_STEP_DARK (the same tone
            PlanView's own escala-floor/flat-zone reaches) at the shallow
            floor, WATER_BODY_DEEP at the true deepest point (maxY, the
            vertex) — mirroring PlanView's own light→mid→deep progression
            tier for tier. x1/x2 identical (purely vertical); y1/y2 span
            waterActualY (the real water surface) to maxY (the deepest
            floor point) — everything below maxY, if any, just holds the
            final stop's color, per SVG's normal gradient extend
            behavior. */}
        <linearGradient id="water-fill-gradient" gradientUnits="userSpaceOnUse" x1={profX} y1={waterActualY} x2={profX} y2={maxY}>
          <stop offset="0%" stopColor={WATER_STEP_LIGHT} />
          <stop offset="55%" stopColor={WATER_STEP_DARK} />
          <stop offset="100%" stopColor={WATER_BODY_DEEP} />
        </linearGradient>
      </defs>
      {/* Pool contour in section */}
      <path d={fillPathD} fill="url(#water-fill-gradient)" stroke="none" />
      <path d={outlinePathD} fill="none" stroke={DRAW} strokeWidth="0.6" strokeLinejoin="round" />
      {/* Corona, in section — the straight top edge at waterlineY is the
          corona's own real construction level (replacing what used to be a
          wavy "water surface" line drawn right at the wall top, which
          wasn't accurate: the técnica builds the corona level and dead
          straight, and the water always sits 10cm below it, never flush
          with it — see waterActualY/the wave below). Tiled fill (no stroke
          of its own) plus a separate outline on top, fill="none" — same
          two-layer convention PlanView's own corona ring uses (fill
          segments first, one unbroken border drawn over them after), so the
          tile joints don't get double-stroked at the block's own edge.
          x/width extend coronaOverhangX past profX/endX on both sides — the
          corona physically cantilevers past the pool walls (see
          coronaOverhangX's own comment above), so it should read as
          visibly wider than the pool contour at both ends, not flush with
          it. */}
      <rect
        x={profX - coronaOverhangX}
        y={waterlineY - PROFILE_CORONA}
        width={profW + 2 * coronaOverhangX}
        height={PROFILE_CORONA}
        fill="url(#corona-tiles)"
      />
      <rect
        x={profX - coronaOverhangX}
        y={waterlineY - PROFILE_CORONA}
        width={profW + 2 * coronaOverhangX}
        height={PROFILE_CORONA}
        fill="none"
        stroke={DRAW}
        strokeWidth="0.5"
      />
      <line x1={profX} y1={waterlineY} x2={endX} y2={waterlineY} stroke={DRAW} strokeWidth="0.6" />
      {/* Staircase, in section — same stroke style as the main contour. */}
      <path d={stairsProfileD} fill="none" stroke={DRAW} strokeWidth="0.6" strokeLinejoin="round" />
      {/* "Escala amb plataforma" shelf, in section — schematic secondary
          element, not part of the structural contour: same DRAW color but
          half the contour's strokeWidth (0.3 vs 0.6) so it visually reads
          as an overlay/annotation rather than a structural edge. */}
      {showPlatformProfile && (
        <path d={platformProfileD} fill="none" stroke={DRAW} strokeWidth="0.3" strokeLinejoin="round" />
      )}
      {/* Platform height cota — plataforma case only, alongside the shelf's
          own vertical drop (flatEndX, platformLevelY→minY). Small
          interior-cota sizing, matching the plataforma llarg cota in
          PlanView (fontSize/offset/gap/overshoot/tick/labelGap all copied
          from there) — offset=1.4 puts it just to the right of the drop
          line, not fighting it for the same pixels. */}
      {showPlatformHeightCota && (
        <Dimension
          orientation="vertical"
          objPos={flatEndX}
          outward={1}
          from={platformLevelY}
          to={minY}
          label={`${fmtM(platformHeightM!)} m`}
          fontSize={2.6}
          offset={1.4}
          gap={0.4}
          overshoot={0.6}
          tick={0.3}
          labelGap={1.3}
          color={DIM_INTERIOR}
        />
      )}
      {/* Real waterline — subtle wave instead of a ruled edge, reads as
          water. Drawn at waterActualY (10cm below the corona's straight top
          edge, waterlineY — see its own comment above), matching fillPathD's
          own top edge so the wave sits right at the painted water's surface
          instead of floating above or cutting into it. Spans exactly profX
          to profX + profW, matching the wall x-positions in outlinePathD, so
          it never pokes out past the vessel's sides. */}
      <path d={wavePath(profX, waterActualY, profW, 0.6, 11)} fill="none" stroke={DRAW} strokeWidth="0.5" />

      {/* Profunditat mitjana — informative marker only, not a dimension
          line. avgMarkerX/avgMarkerY (the point ON the down-slope where
          depth === depthAvg) only fix the horizontal position; the tick and
          label are drawn at avgMarkerLabelY instead, below that point, so
          they land outside the pool contour rather than sitting on top of
          the slope line — a short dashed leader connects the two so it's
          still clear which point on the slope this refers to. Navy
          (DIM_INTERIOR) to read as an annotation rather than part of the
          contour/cota system (which stays DRAW-gray/mainDim-navy
          respectively). */}
      <line
        x1={avgMarkerX}
        y1={avgMarkerY}
        x2={avgMarkerX}
        y2={avgMarkerLabelY - 3}
        stroke={DIM_INTERIOR}
        strokeWidth="0.3"
        strokeDasharray="1 0.8"
      />
      <text x={avgMarkerX + 1.5} y={avgMarkerLabelY} fontSize="2.6" fill={DIM_INTERIOR} fontFamily="Inter, sans-serif">
        {`PM: ${fmtM(depthAvg)} m`}
      </text>

      {/* Llarg — same mainDim* sizing/style as PlanView's Length cota, so
          the two views read as the same "family" of cota. Sits above the
          waterline/wave (objPos=waterlineY, outward=-1, i.e. upward) rather
          than below the contour — moved up per feedback, since below meant
          competing with the deepest point for space. Lets the plan and
          profile "match" as two real cuts of the same object, per the
          geometry-matching goal (from/to = profX/endX are now literally
          PlanView's own rectX/rectX+rectW). objPos stays waterlineY, not
          waterActualY: this measures the pool's plan footprint at the
          corona/reference level, unrelated to the water. Clears the new
          corona block above it without any adjustment — mainDimOffset
          (=CORONA+DIM_OFFSET=11, the module-level CORONA, not this view's
          own thinner PROFILE_CORONA) already reserves more room than the
          corona block's actual PROFILE_CORONA(=2mm) thickness. */}
      <Dimension
        orientation="horizontal"
        objPos={waterlineY}
        outward={-1}
        from={profX}
        to={endX}
        label={`${fmtM(length)} m`}
        fontSize={4}
        offset={mainDimOffset}
        gap={mainDimGap}
        overshoot={mainDimOvershoot}
        tick={mainDimTick}
      />

      {/* Depth min/max/avg — all three now share PlanView's main-cota sizing
          (mainDimTick/mainDimGap/mainDimOvershoot/mainDimOffset, module-level
          constants defined near DIM_LABEL_GAP_H) instead of the Dimension
          defaults, so they read at the same size/proportion as the plan's
          Length/Width cotas rather than the old, visually heavier default
          tick/gap/overshoot. */}
      {/* Depth min — stairs wall, left */}
      <Dimension
        orientation="vertical"
        objPos={profX}
        outward={-1}
        from={waterlineY}
        to={minY}
        label={`${fmtM(dMin)} m`}
        offset={mainDimOffset}
        gap={mainDimGap}
        overshoot={mainDimOvershoot}
        tick={mainDimTick}
      />
      {/* Depth max — at the vertex (vertexX, maxY), wherever
          maxDepthPositionRatio puts it, not at a wall. objPos is the
          vertex's own x; from/to span waterlineY→maxY exactly like depth
          min's from/to span waterlineY→minY at its own wall x.
          Offset is deliberately NOT mainDimOffset though, unlike the other
          two depth cotas: depth min/avg measure genuine vertical walls
          (constant x over their whole height), so shifting their visible
          dimension line sideways by `offset` never changes what's being
          measured. vertexX is a single point on a slope, not a wall — any
          horizontal offset drags the visible line off the vertex and onto
          the ascending slope past it (the original bug report). A first
          fix shrank offset to 3mm, which reduced but didn't eliminate the
          drift — any offset>0 still moves pos away from vertexX. offset=0
          (vertexDimOffset) removes the drift entirely: pos = objPos +
          outward*0 = vertexX exactly, regardless of slope steepness. gap=0
          too, so the extension line starts exactly at vertexX instead of
          floating away from it now that pos no longer does.
          tick/overshoot stay the shared mainDim* ones — those don't move
          `pos` itself, only offset does, so they're still safe to match
          the plan's main-cota sizing. color=DIM_INTERIOR (navy) instead of
          the default gray DIM_MAIN: this cota now sits right at the
          deepest, darkest point of the new water-fill gradient, where the
          gray default read poorly against the blue background — navy
          matches the rest of this page's interior/secondary cotas
          (escala/plataforma/banc) and stands out better there. */}
      <Dimension
        orientation="vertical"
        objPos={vertexX}
        outward={1}
        from={waterlineY}
        to={maxY}
        label={`${fmtM(dMax)} m`}
        offset={vertexDimOffset}
        gap={vertexDimGap}
        overshoot={mainDimOvershoot}
        tick={mainDimTick}
        color={DIM_INTERIOR}
      />
      {/* Drain depth (desguàs) — opposite wall, right. NOT poolDepthAvg: per
          the técnica's construction spec, this wall is always built at a
          fixed dMax − 0.10m for the drain, unrelated to the mín/màx
          average (poolDepthAvg plays no role in this view — the old
          center-of-pool dashed "profunditat mitjana" marker was already
          removed in an earlier redesign, and the wall itself briefly used
          the average as its endpoint before this correction).
          Offset is NOT mainDimOffset here, unlike depth min — endX is now
          PlanView's own rectX+rectW, and the space to its right, up to
          Vw(=PLAN_VW), is only ever guaranteed to be PLAN_RIGHT_MARGIN
          (10mm): PlanView's own rightMargin is smaller than leftMargin
          (its Width cota sits on the left, so the right side was never
          stress-tested against a cota needing room there). At
          mainDimOffset(11)+label that would already overflow the 10mm
          worst case (a long, narrow pool where scale ends up length-bound
          with zero centering slack). edgeDimOffset/edgeDimGap below are
          sized to comfortably clear a 10mm margin instead. */}
      <Dimension
        orientation="vertical"
        objPos={endX}
        outward={1}
        from={waterlineY}
        to={drainY}
        label={`${fmtM(drainDepth)} m`}
        offset={edgeDimOffset}
        gap={edgeDimGap}
        overshoot={mainDimOvershoot}
        tick={mainDimTick}
        labelGap={1.2}
      />
      {/* Escala llarg cota — external, below the pool contour. Shown for
          all 4 interiorStairsType values (see showStairsLengthCota above),
          not just plataforma/banc — it measures the escala's flat base
          zone itself. objPos=minY (the escala's own floor level, well
          clear of maxY/Vh — see showStairsLengthCota's comment), outward=1
          (downward), the opposite side from the Length cota above
          (objPos=waterlineY, outward=-1), so the two never overlap. Same
          small interior-cota sizing as the platform height cota above. */}
      {showStairsLengthCota && (
        <Dimension
          orientation="horizontal"
          objPos={minY}
          outward={1}
          from={profX}
          to={flatEndX}
          label={`${fmtM(stairsLengthM)} m`}
          fontSize={2.6}
          offset={1.4}
          gap={0.4}
          overshoot={0.6}
          tick={0.3}
          labelGap={1.3}
          color={DIM_INTERIOR}
        />
      )}
      {/* Riser height detail — measures the SECOND riser rather than the
          first, at a spot with no other cota nearby. objPos=profX+
          stairsTreadW is the x of that second riser (exactly where the
          zigzag's own stroke already runs, from waterlineY+riserH down to
          waterlineY+2*riserH — see stairsProfilePath/totalRisers above).
          outward=1 (offset to the RIGHT) puts this cota in the THIRD step's
          box — x roughly [profX+2*stairsTreadW, profX+3*stairsTreadW] — a
          completely empty area with nothing else drawn in it. Guarded by
          totalRisers>1 (showStepDetailCota) since a "second riser" only
          exists once there are at least 2. horizontalLabel: this span is
          only ~riserH tall (a single step), too short for the rotated label
          Dimension normally uses — the glyphs came out cramped and the
          trailing "m" touched the step's own stroke. Unrotated text just
          needs horizontal room instead, which the empty third-step box has
          plenty of.
          (The tread-width detail cota that used to sit alongside this one,
          on the first tread, was moved to PlanView — see
          showTreadDetailCota there — since here it sat right against the
          waterline/wave with no clean room once the corona pushed things
          around.) */}
      {showStepDetailCota && (
        <Dimension
          orientation="vertical"
          objPos={profX + stairsTreadW}
          outward={1}
          from={waterlineY + riserH}
          to={waterlineY + 2 * riserH}
          label={`${fmtM(riserHeightM)} m`}
          fontSize={detailFontSize}
          offset={detailOffset}
          gap={detailGap}
          overshoot={detailOvershoot}
          tick={detailTick}
          labelGap={detailLabelGap}
          horizontalLabel
          color={DIM_INTERIOR}
        />
      )}
    </svg>
  );
}

export function PagePlanol({ data }: { data: PdfData }) {
  return (
    <section style={pdfPageStyle}>
      {/* Header */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          padding: "14mm 14mm 0 14mm",
        }}
      >
        <h1
          style={{
            fontFamily: '"Tenor Sans", serif',
            fontWeight: 400,
            fontSize: "46pt",
            color: NAVY,
            letterSpacing: 4,
            margin: 0,
            lineHeight: 1,
          }}
        >
          PLÀNOL TÈCNIC
        </h1>
        <PdfLogo size={85} />
      </div>

      {/* Divider */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          height: 6,
          background: NAVY,
          margin: "10mm 14mm 8mm 0",
          marginLeft: "0mm",
          width: "calc(100% - 36mm)",
        }}
      />

      <div style={{ padding: "0 14mm", position: "relative", zIndex: 1 }}>
        <SectionLabel>VISTA EN PLANTA</SectionLabel>
        <PlanView data={data} />

        <div style={{ marginTop: "6mm" }}>
          <SectionLabel>VISTA DE PERFIL — TALL LONGITUDINAL</SectionLabel>
          <ProfileView data={data} />
        </div>
      </div>
    </section>
  );
}
