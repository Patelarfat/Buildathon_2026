import React from "react";
import { Layers, AlertTriangle, CheckCircle2, Clock, Truck } from "lucide-react";
import { AssistantMaterialItem } from "@/lib/api";

interface MaterialCardProps {
  materials: AssistantMaterialItem[];
  className?: string;
}

export default function MaterialCard({ materials, className = "" }: MaterialCardProps) {
  if (!materials || materials.length === 0) return null;

  return (
    <div className={`space-y-2.5 ${className}`}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono uppercase tracking-wider font-extrabold text-slate-500 flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-[#D99A16]" />
          CRITICAL MATERIALS & SUPPLY STATUS ({materials.length})
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {materials.map((m, idx) => {
          const isProblem = m.status === "DELAYED" || m.status === "OUT_OF_STOCK" || m.status === "LOW_STOCK";

          const getStatusStyle = () => {
            switch (m.status) {
              case "DELAYED":
                return "bg-rose-100 text-rose-800 border-rose-300";
              case "OUT_OF_STOCK":
                return "bg-rose-100 text-rose-800 border-rose-300";
              case "LOW_STOCK":
                return "bg-amber-100 text-amber-800 border-amber-300";
              default:
                return "bg-emerald-100 text-emerald-800 border-emerald-300";
            }
          };

          return (
            <div
              key={idx}
              className={`p-3 rounded-xl border transition-all ${
                isProblem
                  ? "bg-amber-50/40 border-amber-200/80 hover:bg-amber-50/70"
                  : "bg-white border-slate-200 hover:border-slate-300"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-0.5">
                  <h4 className="text-xs font-bold text-slate-900">
                    {m.name}
                  </h4>
                  {m.category && (
                    <span className="text-[10px] font-mono text-slate-500">
                      {m.category}
                    </span>
                  )}
                </div>

                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border uppercase ${getStatusStyle()}`}>
                  {m.status.replace("_", " ")}
                </span>
              </div>

              {m.quantity !== null && m.quantity !== undefined && (
                <div className="mt-2 text-xs font-mono font-semibold text-slate-800">
                  Quantity: {m.quantity} {m.unit || "units"}
                </div>
              )}

              {m.notes && (
                <p className="mt-1 text-xs text-slate-600 leading-snug">
                  {m.notes}
                </p>
              )}

              {m.supplier && (
                <div className="mt-2 pt-1.5 border-t border-black/5 text-[11px] text-slate-500 flex items-center gap-1">
                  <Truck className="w-3 h-3 text-slate-400 shrink-0" />
                  <span>Supplier: <strong className="text-slate-700">{m.supplier}</strong></span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
