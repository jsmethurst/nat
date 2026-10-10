"use client";

import { useRef } from "react";

export type StatusRow = { name: string; state: "ok" | "warn" | "bad"; detail: string };

export default function StatusButton({ rows }: { rows: StatusRow[] }) {
  const ref = useRef<HTMLDialogElement>(null);
  const problems = rows.filter((r) => r.state !== "ok").length;
  return (
    <>
      <button type="button" className="ghost" onClick={() => ref.current?.showModal()}>
        Status{problems > 0 && <span className="bang" aria-label={`${problems} need attention`}>!</span>}
      </button>
      <dialog ref={ref} className="status" onClick={(e) => e.target === ref.current && ref.current.close()}>
        <div className="row"><h3>Connections</h3><button type="button" className="ghost" onClick={() => ref.current?.close()}>Close</button></div>
        {rows.map((r) => (
          <div className="srow" key={r.name}>
            <span className={`dot ${r.state}`}>{r.state === "ok" ? "\u2713" : "!"}</span>
            <div><div className="title">{r.name}</div><div className="why">{r.detail}</div></div>
          </div>
        ))}
      </dialog>
    </>
  );
}
