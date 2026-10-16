"use client";

import { setItemStatus } from "@/actions/seserahan";
import { StatusSelect } from "@/components/status-select";

export function ItemStatus({ id, status, name }: { id: string; status: string; name: string }) {
  return (
    <StatusSelect
      value={status}
      label={`Status ${name}`}
      onChange={(v) => setItemStatus(id, v)}
      options={[
        { value: "belum", label: "Belum", tone: "warn" },
        { value: "dipesan", label: "Dipesan", tone: "info" },
        { value: "terbeli", label: "Terbeli", tone: "ok" },
      ]}
    />
  );
}
