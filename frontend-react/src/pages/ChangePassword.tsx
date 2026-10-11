import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { Button, Input, Field } from "../components/ui";
import { useToast } from "../components/toast";

export function ChangePassword() {
  const { changePassword, logout } = useAuth();
  const nav = useNavigate();
  const { toast } = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (next.length < 8) return setError("New password must be at least 8 characters.");
    if (next !== confirm) return setError("Passwords do not match.");
    setBusy(true);
    const r = await changePassword(current, next);
    setBusy(false);
    if (!r.ok) return setError(r.message);
    toast({ title: "Password updated", tone: "success" });
    nav("/app/dashboard");
  }

  return (
    <main className="min-h-screen grid place-items-center p-4" style={{ background: "var(--ink)" }}>
      <div className="w-full max-w-sm">
        <div className="card-panel p-6">
          <h1 className="text-lg font-semibold">Change your password</h1>
          <p className="text-sm text-muted-foreground mb-5">
            For your security, set a new password before continuing.
          </p>
          <form onSubmit={onSubmit} className="space-y-4">
            <Field label="Current password" htmlFor="current-password">
              <Input id="current-password" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoFocus />
            </Field>
            <Field label="New password" htmlFor="new-password">
              <Input id="new-password" type="password" value={next} onChange={(e) => setNext(e.target.value)} />
            </Field>
            <p className="text-[11px] text-muted-foreground -mt-2">
              Min 8 chars with uppercase, lowercase, a number and one of !@#$%^&amp;*
            </p>
            <Field label="Confirm new password" htmlFor="confirm-password">
              <Input id="confirm-password" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </Field>
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Updating…" : "Update password"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={async () => {
                await logout();
                nav("/login");
              }}
            >
              Log out
            </Button>
          </form>
        </div>
      </div>
    </main>
  );
}
