/**
 * Taula de diàmetres de canonada (PVC pressió) ja calculada a una velocitat
 * de referència de 2 m/s — no es recalcula la velocitat, només es fa lookup.
 * maxFlow = cabal màxim (m³/h) que suporta cada diàmetre sense superar 2 m/s.
 */
export const PIPE_DIAMETER_TABLE = [
  { diameter: 50, maxFlow: 14 },
  { diameter: 63, maxFlow: 22 },
  { diameter: 75, maxFlow: 32 },
  { diameter: 90, maxFlow: 46 },
  { diameter: 110, maxFlow: 68 },
  { diameter: 125, maxFlow: 88 },
  { diameter: 160, maxFlow: 145 },
  { diameter: 200, maxFlow: 226 },
] as const;

// L'empresa mai instal·la canonada per sota de 63mm, encara que el cabal sigui baix.
const MIN_PIPE_DIAMETER_MM = 63;

/**
 * Diàmetre de canonada recomanat (mm) segons el cabal instal·lat (m³/h).
 * Tria el diàmetre més petit de la taula que suporta el cabal, amb un mínim
 * forçat de 63mm.
 */
export function getRecommendedPipeDiameter(flowM3h: number): number {
  const match = PIPE_DIAMETER_TABLE.find((row) => row.maxFlow >= flowM3h);
  const diameter = match ? match.diameter : PIPE_DIAMETER_TABLE[PIPE_DIAMETER_TABLE.length - 1].diameter;
  return Math.max(diameter, MIN_PIPE_DIAMETER_MM);
}
