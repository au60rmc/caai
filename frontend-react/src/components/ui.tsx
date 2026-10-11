import {
  type ReactNode,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type TextareaHTMLAttributes,
  type SelectHTMLAttributes,
  useEffect,
  useRef,
  useState,
  useId,
  isValidElement,
  cloneElement,
} from "react";
import { cn, money } from "../lib/format";
import { Search, Inbox, X, CheckCircle2, AlertTriangle, XCircle, Calendar } from "lucide-react";

/* ---------- Button ---------- */
type Variant = "default" | "outline" | "secondary" | "ghost" | "destructive";
type Size = "default" | "sm" | "icon";
const variants: Record<Variant, string> = {
  default: "bg-primary text-primary-foreground shadow hover:bg-primary/90",
  outline: "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
  secondary: "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
  ghost: "hover:bg-accent hover:text-accent-foreground",
  destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
};
const sizes: Record<Size, string> = {
  default: "h-9 px-4 py-2",
  sm: "h-8 rounded-md px-3 text-xs",
  icon: "h-9 w-9",
};
export function Button({
  variant = "default",
  size = "default",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  );
}

/* ---------- Inputs ---------- */
export function Input({ className, type, placeholder, ...p }: InputHTMLAttributes<HTMLInputElement>) {
  const isDate = type === "date";
  return (
    <input
      type={type}
      placeholder={placeholder || (isDate ? "DD/MM/YYYY" : undefined)}
      className={cn(
        "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        isDate && "font-mono uppercase",
        className
      )}
      {...p}
    />
  );
}

export function DatePicker({
  value,
  onChange,
  className,
  disabled,
  readOnly,
  min,
  max,
  placeholder = "DD/MM/YYYY",
  id,
}: {
  value?: string;
  onChange?: (val: string) => void;
  className?: string;
  disabled?: boolean;
  readOnly?: boolean;
  min?: string;
  max?: string;
  placeholder?: string;
  id?: string;
}) {
  const pickerRef = useRef<HTMLInputElement>(null);

  const isoToDmy = (iso?: string) => {
    if (!iso) return "";
    const parts = iso.split("-");
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return iso;
  };

  const dmyToIso = (dmy: string) => {
    if (!dmy) return "";
    const cleaned = dmy.trim().replace(/[-.]/g, "/");
    const parts = cleaned.split("/");
    if (parts.length === 3) {
      let [d, m, y] = parts;
      if (y && y.length === 2) y = "20" + y;
      if (d && m && y && d.length <= 2 && m.length <= 2 && y.length === 4) {
        const day = d.padStart(2, "0");
        const month = m.padStart(2, "0");
        return `${y}-${month}-${day}`;
      }
    }
    return dmy;
  };

  const [textVal, setTextVal] = useState(() => isoToDmy(value));

  useEffect(() => {
    setTextVal(isoToDmy(value));
  }, [value]);

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setTextVal(raw);
    const parsedIso = dmyToIso(raw);
    if (/^\d{4}-\d{2}-\d{2}$/.test(parsedIso)) {
      onChange?.(parsedIso);
    }
  };

  const handleTextBlur = () => {
    const parsedIso = dmyToIso(textVal);
    if (/^\d{4}-\d{2}-\d{2}$/.test(parsedIso)) {
      onChange?.(parsedIso);
      setTextVal(isoToDmy(parsedIso));
    } else if (!textVal.trim()) {
      onChange?.("");
      setTextVal("");
    } else {
      setTextVal(isoToDmy(value));
    }
  };

  const handleOpenPicker = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled || readOnly) return;
    const el = pickerRef.current as any;
    if (el) {
      if (typeof el.showPicker === "function") {
        try {
          el.showPicker();
        } catch {
          el.click?.();
        }
      } else {
        el.click?.();
      }
    }
  };

  return (
    <div className={cn("relative flex items-center w-full", className)}>
      <input
        type="text"
        id={id}
        disabled={disabled}
        readOnly={readOnly}
        placeholder={placeholder}
        value={textVal}
        onChange={handleTextChange}
        onBlur={handleTextBlur}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 pr-9 text-sm shadow-sm transition-colors font-mono placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
      />
      <button
        type="button"
        tabIndex={-1}
        disabled={disabled || readOnly}
        onClick={handleOpenPicker}
        className="absolute right-2 p-1 text-muted-foreground hover:text-foreground disabled:opacity-50"
      >
        <Calendar className="h-4 w-4" />
      </button>
      <input
        ref={pickerRef}
        type="date"
        value={value || ""}
        min={min}
        max={max}
        disabled={disabled || readOnly}
        onChange={(e) => {
          const newIso = e.target.value;
          onChange?.(newIso);
          setTextVal(isoToDmy(newIso));
        }}
        className="sr-only opacity-0 absolute pointer-events-none"
        tabIndex={-1}
      />
    </div>
  );
}

export function Textarea({ className, ...p }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...p}
    />
  );
}

export function Select({ className, children, ...p }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "flex h-9 w-full items-center rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...p}
    >
      {children}
    </select>
  );
}

export function Checkbox({ className, ...p }: InputHTMLAttributes<HTMLInputElement>) {
  return <input type="checkbox" className={cn("h-4 w-4 accent-[var(--teal)] cursor-pointer", className)} {...p} />;
}

export function Field({
  label,
  required,
  children,
  className,
  error,
  hint,
  htmlFor,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
  error?: string;
  hint?: ReactNode;
  htmlFor?: string;
}) {
  const autoId = useId();
  const fieldId = htmlFor || autoId;

  const isFormElement =
    isValidElement(children) &&
    (typeof children.type === "function" ||
      (typeof children.type === "string" && ["input", "select", "textarea"].includes(children.type)));

  const isDivContainer = isValidElement(children) && typeof children.type === "string" && children.type === "div";

  let childWithProps = children;
  if (isFormElement && !isDivContainer) {
    childWithProps = cloneElement(children as React.ReactElement<any>, {
      id: (children.props as any).id || fieldId,
      "aria-label": (children.props as any)["aria-label"] || label,
      "aria-invalid": (children.props as any)["aria-invalid"] ?? (error ? true : undefined),
    });
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      {!isDivContainer ? (
        <label htmlFor={fieldId} className="text-xs font-medium text-muted-foreground block">
          {label}
          {required && <span className="text-destructive ml-0.5">*</span>}
        </label>
      ) : (
        <span className="text-xs font-medium text-muted-foreground block">
          {label}
          {required && <span className="text-destructive ml-0.5">*</span>}
        </span>
      )}
      {childWithProps}
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
      {hint}
    </div>
  );
}

/* ---------- Validation hint (red / yellow / green per spec 8.4) ---------- */
export function ValidationHint({
  level,
  message,
}: {
  level?: "ok" | "warning" | "error" | null;
  message?: string | null;
}) {
  if (!level || !message) return null;
  const Icon = level === "ok" ? CheckCircle2 : level === "warning" ? AlertTriangle : XCircle;
  return (
    <p className={cn("flex items-center gap-1 text-xs mt-1", `hint-${level}`)}>
      <Icon className="h-3.5 w-3.5 shrink-0" />
      {message}
    </p>
  );
}

/* ---------- Layout / page ---------- */
export function PageHeader({
  title,
  sub,
  actions,
  children,
}: {
  title: string;
  sub?: string;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="px-6 py-5 lg:px-8 max-w-[1440px] mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-3 pb-4 mb-5 ledger-rule">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight">{title}</h1>
          {sub && <p className="text-[13px] text-muted-foreground mt-0.5">{sub}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

export function Panel({
  title,
  right,
  children,
  className,
  pad = true,
}: {
  title?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  pad?: boolean;
}) {
  return (
    <section className={cn("card-panel", className)}>
      {(title || right) && (
        <header className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4 pb-3 ledger-rule">
          <div className="eyebrow">{title}</div>
          {right}
        </header>
      )}
      <div className={pad ? "p-5" : ""}>{children}</div>
    </section>
  );
}

export function SearchBox({
  value,
  onChange,
  placeholder = "Search",
  inputRef,
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputRef?: React.RefObject<HTMLInputElement>;
  "aria-label"?: string;
}) {
  return (
    <div className="relative w-full sm:w-64">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel || placeholder || "Search"}
        className="pl-8 h-9 bg-card flex w-full rounded-md border border-input px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />
    </div>
  );
}

/* ---------- Table ---------- */
export function TableWrap({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]">{children}</table>
    </div>
  );
}
export function Th({ children, right, className }: { children?: ReactNode; right?: boolean; className?: string }) {
  return (
    <th
      className={cn(
        "text-left font-semibold text-[11px] uppercase tracking-[0.08em] text-muted-foreground px-4 py-2.5 border-b border-border bg-muted/40",
        right && "text-right",
        className
      )}
    >
      {children}
    </th>
  );
}
export function Td({ children, right, className }: { children?: ReactNode; right?: boolean; className?: string }) {
  return (
    <td className={cn("px-4 py-2.5 border-b border-border/70 align-middle", right && "text-right", className)}>
      {children}
    </td>
  );
}
export function EmptyRow({ colSpan, text = "Nothing here yet." }: { colSpan: number; text?: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-12 text-center">
        <Inbox className="h-7 w-7 mx-auto text-muted-foreground/50 mb-2" />
        <p className="text-muted-foreground text-sm">{text}</p>
      </td>
    </tr>
  );
}

export function Money({ v, signed }: { v: number; signed?: boolean }) {
  return <span className={cn("fig tabular-nums", signed && v < 0 && "text-destructive")}>{money(v)}</span>;
}

type Tone = "ok" | "warn" | "bad" | "muted";
export function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  const map: Record<Tone, string> = {
    ok: "bg-[var(--teal-soft)] text-[var(--teal)]",
    warn: "bg-[var(--brass-soft)] text-[#8A6420]",
    bad: "bg-[var(--red-soft)] text-[var(--red)]",
    muted: "bg-muted text-muted-foreground",
  };
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold", map[tone])}>
      {children}
    </span>
  );
}

export function RowActions({
  onEdit,
  onDelete,
  onActivity,
  canEdit = true,
  canDelete = true,
}: {
  onEdit?: () => void;
  onDelete?: () => void;
  onActivity?: () => void;
  canEdit?: boolean;
  canDelete?: boolean;
}) {
  return (
    <div className="flex justify-end gap-1">
      {onActivity && (
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onActivity}>
          Activity
        </Button>
      )}
      {onEdit && canEdit && (
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onEdit}>
          Edit
        </Button>
      )}
      {onDelete && canDelete && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-destructive hover:text-destructive"
          onClick={onDelete}
        >
          Delete
        </Button>
      )}
    </div>
  );
}

/* ---------- Drawer (right sheet) ---------- */
export function Drawer({
  open,
  onClose,
  title,
  desc,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  desc?: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        className={cn(
          "absolute inset-y-0 right-0 bg-background shadow-lg flex min-w-0 w-[100vw] max-w-full flex-col fade-up",
          wide ? "sm:max-w-[860px]" : "sm:max-w-[560px]"
        )}
      >
        <div className="px-6 pt-5 pb-4 ledger-rule flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold">{title}</h2>
            {desc && <p className="text-sm text-muted-foreground mt-0.5">{desc}</p>}
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 min-w-0 overflow-x-hidden overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="px-6 py-4 border-t bg-muted/30 flex justify-end gap-2 flex-wrap">{footer}</div>}
      </div>
    </div>
  );
}

/* ---------- Modal (small centered) ---------- */
export function Modal({
  open,
  onClose,
  title,
  desc,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  desc?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 w-full max-w-[460px] rounded-lg border bg-background p-6 shadow-lg fade-up">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold leading-none tracking-tight">{title}</h3>
            {desc && <p className="text-sm text-muted-foreground mt-1.5">{desc}</p>}
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 mt-5">{footer}</div>}
      </div>
    </div>
  );
}

/* ---------- Confirm dialog ---------- */
export function ConfirmDialog({
  open,
  onClose,
  title,
  desc,
  confirmLabel = "Delete",
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  desc?: string;
  confirmLabel?: string;
  onConfirm: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 w-full max-w-[420px] rounded-lg border bg-background p-6 shadow-lg">
        <h3 className="text-lg font-semibold leading-none tracking-tight">{title}</h3>
        {desc && <p className="text-sm text-muted-foreground mt-2">{desc}</p>}
        <div className="flex justify-end gap-2 mt-5">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-[var(--teal)]" />
    </div>
  );
}
