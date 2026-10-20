"use client";

import { changeRole } from "@/actions/anggota";
import { StatusSelect } from "@/components/status-select";

export function RoleSelect({ memberId, role, options }: { memberId: string; role: string; options: { value: string; label: string }[] }) {
  return <StatusSelect value={role} label="Peran" onChange={(v) => changeRole(memberId, v)} className="text-[13px] font-semibold" options={options} />;
}
