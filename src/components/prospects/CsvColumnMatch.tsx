"use client";

import {
  CSV_MATCH_FIELDS,
  type CsvColumnChoice,
  type CsvColumnMapping,
  type CsvMatchFieldId,
} from "@/lib/prospects/csvColumnMatch";

export function CsvColumnMatch({
  headers,
  samples,
  mapping,
  onChange,
}: {
  headers: string[];
  samples: string[][];
  mapping: CsvColumnMapping;
  onChange: (mapping: CsvColumnMapping) => void;
}) {
  function setChoice(index: number, choice: CsvColumnChoice) {
    const next = mapping.slice();
    next[index] = choice;
    onChange(next);
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
          <tr>
            <th className="px-3 py-2">Their column</th>
            <th className="px-3 py-2">Sample</th>
            <th className="px-3 py-2">Our field</th>
          </tr>
        </thead>
        <tbody>
          {headers.map((header, index) => {
            const choice = mapping[index] ?? "skip";
            const taken = new Set(
              mapping.filter(
                (field, fieldIndex): field is CsvMatchFieldId =>
                  field !== "skip" && fieldIndex !== index
              )
            );
            const sample = (samples[index] ?? []).slice(0, 2).join(" · ");
            return (
              <tr key={`${header}-${index}`} className="border-t border-slate-100">
                <td className="px-3 py-2 font-medium text-slate-900">{header}</td>
                <td className="max-w-[10rem] truncate px-3 py-2 text-slate-500">
                  {sample || "—"}
                </td>
                <td className="px-3 py-2">
                  <select
                    aria-label={`Field for ${header}`}
                    value={choice}
                    onChange={(event) =>
                      setChoice(index, event.target.value as CsvColumnChoice)
                    }
                    className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900"
                  >
                    <option value="skip">Skip</option>
                    {CSV_MATCH_FIELDS.filter(
                      (field) => field.id === choice || !taken.has(field.id)
                    ).map((field) => (
                      <option key={field.id} value={field.id}>
                        {field.label}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
