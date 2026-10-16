"use client";

import { setDocumentStatus } from "@/actions/dokumen";
import { StatusSelect } from "@/components/status-select";

export function DocStatus({ id, status, name }: { id: string; status: string; name: string }) {
  return (
    <StatusSelect
      value={status}
      label={`Status ${name}`}
      onChange={(v) => setDocumentStatus(id, v)}
      options={[
        { value: "belum", label: "Belum", tone: "warn" },
        { value: "diproses", label: "Diproses", tone: "info" },
        { value: "lengkap", label: "Lengkap", tone: "ok" },
      ]}
    />
  );
}
