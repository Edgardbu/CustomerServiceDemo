"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Headphones, Loader2, ShieldCheck } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { TENANT_ID } from "@/lib/constants";
import { useToast } from "@/components/providers/toast-provider";
import { useBootstrapStore } from "@/stores/bootstrap-store";
import { useCurrentUserStore } from "@/stores/current-user-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const BOOTSTRAP_CONFLICT_MESSAGE =
  "Bootstrap already completed. Please log in or choose an existing user.";

interface BootstrapOwnerPageProps {
  redirectTo?: string;
}

export function BootstrapOwnerPage({
  redirectTo = "/settings/users",
}: BootstrapOwnerPageProps) {
  const router = useRouter();
  const { showSuccess } = useToast();
  const markBootstrapComplete = useBootstrapStore(
    (state) => state.markBootstrapComplete,
  );
  const setBootstrapUser = useCurrentUserStore((state) => state.setBootstrapUser);
  const refreshUsers = useCurrentUserStore((state) => state.refreshUsers);

  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bootstrapSecret, setBootstrapSecret] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting) return;

    const trimmedEmail = email.trim();
    const trimmedName = displayName.trim();

    if (!trimmedEmail || !trimmedName || !bootstrapSecret) {
      setError("All fields are required.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const owner = await api.bootstrapOwner({
        tenant_id: TENANT_ID,
        email: trimmedEmail,
        display_name: trimmedName,
        bootstrap_secret: bootstrapSecret,
      });

      setBootstrapSecret("");
      setBootstrapUser(owner);
      markBootstrapComplete();
      await refreshUsers();

      showSuccess(
        "Owner account created",
        `${owner.display_name} is now the workspace owner.`,
      );
      router.replace(redirectTo);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError(BOOTSTRAP_CONFLICT_MESSAGE);
        markBootstrapComplete();
        await refreshUsers();
      } else {
        setError(
          err instanceof Error ? err.message : "Failed to create owner account",
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-background via-background to-muted/30 px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-violet-500 text-primary-foreground shadow-sm">
            <Headphones className="size-6" />
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">
            Set up your workspace
          </h1>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            Create the first owner account to start managing your helpdesk
            workspace.
          </p>
        </div>

        <Card className="border-border/80 shadow-lg">
          <CardHeader className="border-b border-border/70 bg-muted/20">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-5 text-primary" />
              <CardTitle className="text-lg">Create first owner</CardTitle>
            </div>
            <CardDescription>
              This one-time setup creates the initial workspace owner. You will
              be signed in as this user for development.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="bootstrap-email">
                  Email
                </label>
                <Input
                  id="bootstrap-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="owner@company.com"
                  disabled={submitting}
                />
              </div>

              <div className="space-y-2">
                <label
                  className="text-sm font-medium"
                  htmlFor="bootstrap-display-name"
                >
                  Display name
                </label>
                <Input
                  id="bootstrap-display-name"
                  type="text"
                  autoComplete="name"
                  required
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="Workspace Owner"
                  disabled={submitting}
                />
              </div>

              <div className="space-y-2">
                <label
                  className="text-sm font-medium"
                  htmlFor="bootstrap-secret"
                >
                  Bootstrap secret
                </label>
                <Input
                  id="bootstrap-secret"
                  type="password"
                  autoComplete="off"
                  required
                  value={bootstrapSecret}
                  onChange={(event) => setBootstrapSecret(event.target.value)}
                  placeholder="Enter bootstrap secret"
                  disabled={submitting}
                />
                <p className="text-xs text-muted-foreground">
                  Provided by your platform administrator. It is not stored in
                  this browser.
                </p>
              </div>

              {error ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              ) : null}

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <ShieldCheck className="size-4" />
                )}
                Create first owner
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
