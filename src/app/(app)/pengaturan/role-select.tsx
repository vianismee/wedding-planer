"use client";

import { changeRole } from "@/actions/anggota";
import { StatusSelect } from "@/components/status-select";

export function RoleSelect({ memberId, role }: { memberId: string; role: string }) {
  return (
    <StatusSelect
      value={role}
      label="Peran"
      onChange={(v) => changeRole(memberId, v)}
      className="text-[13px] font-semibold"
      options={[
        { value: "pasangan", label: "Pasangan" },
        { value: "keluarga", label: "Keluarga" },
        { value: "panitia", label: "Panitia" },
      ]}
    />
  );
}
