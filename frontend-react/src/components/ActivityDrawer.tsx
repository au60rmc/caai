import { useEffect, useState } from "react";
import { History, PlusCircle, PenLine, Power, Trash2 } from "lucide-react";
import { api, envelopeResult } from "../lib/api";
import { fmtDateTime, cn } from "../lib/format";
import { Drawer, Spinner, Badge } from "./ui";

interface AuditEntry {
  id: string;
  entity: string;
  entityId: string;
  entityName: string;
  action: string;
  changes: Record<string, { old: any; new: any }> | null;
  actor: string | null;
  createdDate: string | null;
}

const ACTION_META: Record<string, { icon: any; tone: "ok" | "warn" | "bad" | "muted" }> = {
  CREATE: { icon: PlusCircle, tone: "ok" },
  UPDATE: { icon: PenLine, tone: "warn" },
  ACTIVATE: { icon: Power, tone: "ok" },
  DEACTIVATE: { icon: Power, tone: "bad" },
  DELETE: { icon: Trash2, tone: "bad" },
};

/** Activity tab per spec 4.2: created by, last modified, full audit history. */
export function ActivityDrawer({
  open,
  onClose,
  entity,
  entityId,
  title,
}: {
  open: boolean;
  onClose: () => void;
  entity: string;
  entityId: string | null;
  title: string;
}) {
  const [rows, setRows] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !entityId) return;
    setLoading(true);
    api
      .get(`/audit?entity=${encodeURIComponent(entity)}&id=${encodeURIComponent(entityId)}&limit=100`)
      .then((r) => setRows(envelopeResult<AuditEntry[]>(r) || []))
      .finally(() => setLoading(false));
  }, [open, entity, entityId]);

  return (
    <Drawer open={open} onClose={onClose} title={`Activity — ${title}`} desc="Immutable audit history for this record.">
      {loading ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <div className="py-16 text-center text-sm text-muted-foreground">
          <History className="h-7 w-7 mx-auto text-muted-foreground/50 mb-2" />
          No recorded activity yet.
        </div>
      ) : (
        <ol className="relative border-l border-border ml-3 space-y-5">
          {rows.map((r) => {
            const meta = ACTION_META[r.action] || ACTION_META.UPDATE;
            const Icon = meta.icon;
            return (
              <li key={r.id} className="ml-5">
                <span
                  className="absolute -left-[13px] h-[26px] w-[26px] rounded-full grid place-items-center border border-border bg-card"
                  style={{ color: "var(--teal)" }}
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge tone={meta.tone}>{r.action}</Badge>
                  <span className="text-[12px] text-muted-foreground">
                    {fmtDateTime(r.createdDate)} · {r.actor || "system"}
                  </span>
                </div>
                {r.changes && (
                  <div className="mt-2 rounded-md border border-border bg-muted/30 p-3 space-y-1">
                    {Object.entries(r.changes).map(([field, ch]) => (
                      <div key={field} className="text-[12px] grid grid-cols-[120px_1fr] gap-2">
                        <span className="mono text-muted-foreground truncate">{field}</span>
                        <span>
                          <span className={cn("line-through text-muted-foreground/70", ch.old == null && "hidden")}>
                            {String(ch.old)}
                          </span>{" "}
                          <span className="font-medium">{ch.new == null ? "—" : String(ch.new)}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </Drawer>
  );
}
