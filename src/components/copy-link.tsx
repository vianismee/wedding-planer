"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2 rounded-xl bg-ground py-1 pl-3.5 pr-1">
      <input
        readOnly
        value={url}
        aria-label="Link"
        onFocus={(e) => e.target.select()}
        className="min-w-0 flex-1 bg-transparent text-[13px] font-semibold outline-none"
      />
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
        className="hit-44 inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-ink px-3 text-[12px] font-bold text-white"
      >
        {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
        {copied ? "Tersalin" : "Salin"}
      </button>
    </div>
  );
}
