import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

type Props = {
  value: string;
  className?: string;
};

export function BarcodeLabel({ value, className = "" }: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!svgRef.current || !value) return;
    try {
      JsBarcode(svgRef.current, value, {
        format: "CODE128",
        width: 2,
        height: 56,
        displayValue: true,
        fontSize: 14,
        margin: 8,
      });
    } catch {
      /* invalid value */
    }
  }, [value]);

  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_4px_24px_-6px_rgba(15,23,42,0.1)] ${className}`}
    >
      <svg ref={svgRef} className="mx-auto block max-w-full" />
      <p className="mt-3 text-center font-mono text-sm font-medium text-slate-600">{value}</p>
    </div>
  );
}
