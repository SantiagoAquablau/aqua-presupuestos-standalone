import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

/**
 * Editor for payment conditions ("Condicions de Pagament").
 * The PDF Resum page already parses `paymentConditions` line-by-line
 * (one row per line, format "NN % label"). This editor lets the user
 * add/remove/edit each row, then serializes back to that exact format
 * so nothing else in the pipeline has to change.
 */
type Row = { pct: string; label: string };

const DEFAULT_ROWS: Row[] = [
  { pct: "20", label: "acceptació de l'obra" },
  { pct: "25", label: "inici d'obra" },
  { pct: "25", label: "gunitat" },
  { pct: "25", label: "revestiment" },
  { pct: "5", label: "finalització de l'obra" },
];

function parse(text: string): Row[] {
  if (!text || !text.trim()) return DEFAULT_ROWS;
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const rows: Row[] = [];
  for (const line of lines) {
    const m = line.match(/^([\d.,]+)\s*%\s*(.*)$/);
    if (m) rows.push({ pct: m[1].replace(",", "."), label: m[2] });
    else rows.push({ pct: "", label: line });
  }
  return rows.length ? rows : DEFAULT_ROWS;
}

function serialize(rows: Row[]): string {
  return rows
    .filter((r) => r.pct.trim() || r.label.trim())
    .map((r) => `${r.pct || "0"} % ${r.label}`.trim())
    .join("\n");
}

export function PaymentConditionsEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [rows, setRows] = useState<Row[]>(() => parse(value));

  // Re-parse when a different draft is loaded (e.g. edit existing budget)
  useEffect(() => {
    setRows(parse(value));
  }, [value]);

  const total = useMemo(
    () => rows.reduce((s, r) => s + (parseFloat(r.pct.replace(",", ".")) || 0), 0),
    [rows],
  );

  const commit = (next: Row[]) => {
    setRows(next);
    onChange(serialize(next));
  };

  return (
    <div className="bg-card rounded-xl border border-border p-5 shadow-card space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground">Condicions de Pagament</h3>
        <div
          className={
            "text-sm tabular-nums " +
            (Math.abs(total - 100) < 0.01 ? "text-success" : "text-warning")
          }
          title="Suma dels percentatges"
        >
          Total: {total.toFixed(total % 1 === 0 ? 0 : 2)}%
        </div>
      </div>
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="number"
              inputMode="decimal"
              step="0.5"
              min="0"
              max="100"
              className="w-20 px-2 py-1.5 rounded-md border border-input bg-background text-sm text-right focus:outline-none focus:ring-2 focus:ring-ring/20"
              value={r.pct}
              onChange={(e) => {
                const next = [...rows];
                next[i] = { ...next[i], pct: e.target.value };
                commit(next);
              }}
            />
            <span className="text-sm text-muted-foreground">%</span>
            <input
              type="text"
              placeholder="ex.: acceptació de l'obra"
              className="flex-1 px-3 py-1.5 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/20"
              value={r.label}
              onChange={(e) => {
                const next = [...rows];
                next[i] = { ...next[i], label: e.target.value };
                commit(next);
              }}
            />
            <button
              type="button"
              onClick={() => commit(rows.filter((_, idx) => idx !== i))}
              className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              aria-label="Eliminar fila"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => commit([...rows, { pct: "", label: "" }])}
        className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-dashed border-border text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
      >
        <Plus className="w-4 h-4" /> Afegir fila
      </button>
      <p className="text-xs text-muted-foreground">
        Aquests percentatges es mostren en el PDF, a la pàgina <strong>Resum</strong>.
      </p>
    </div>
  );
}