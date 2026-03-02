"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

type Account = {
  id: string | null;
  name: string;
  account_sid: string;
  phone_number: string;
  is_active: boolean;
  rate_limit_per_sec: number;
  created_at: string | null;
};

type Props = {
  accounts: Account[];
  providerName?: string;
  envVarsHint?: string;
};

/** Read-only list of messaging account(s) from environment. No add/edit — configure via .env */
export function TwilioAccountsList({ accounts, providerName = "Provider", envVarsHint }: Props) {
  return (
    <div className="space-y-4">
      <section className="overflow-x-auto rounded-lg border border-[var(--border-base-default)] bg-[var(--bg-base-default)]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Account SID</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Rate Limit</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {accounts.length > 0 ? (
              accounts.map((a) => (
                <TableRow key={a.id ?? "env"}>
                  <TableCell className="font-medium">{a.name}</TableCell>
                  <TableCell className="font-mono text-xs">{a.account_sid}</TableCell>
                  <TableCell>{a.phone_number || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={a.is_active ? "success" : "neutral"}>
                      {a.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>{a.rate_limit_per_sec}/s</TableCell>
                  <TableCell className="text-[var(--text-base-secondary)]">
                    {a.created_at ? new Date(a.created_at).toLocaleDateString() : "—"}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-[var(--text-base-secondary)]">
                  {envVarsHint ?? `Set MESSAGING_PROVIDER and provider-specific env vars (e.g. TWILIO_* or GUPSHUP_*) in .env to send messages.`}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </section>
    </div>
  );
}
