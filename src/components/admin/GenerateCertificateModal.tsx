"use client";

import type { CertificateType } from "@/lib/certificates/generateCertificatePdf";
import { Loader2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { supabaseClient } from "@/lib/supabaseClient";

type CoachOption = {
  id: string;
  label: string;
};

type GenerateCertificateModalProps = {
  open: boolean;
  coaches: CoachOption[];
  onClose: () => void;
};

const MONTH_OPTIONS = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
];

export function GenerateCertificateModal({
  open,
  coaches,
  onClose,
}: GenerateCertificateModalProps) {
  const [coachSearch, setCoachSearch] = useState("");
  const [selectedCoachId, setSelectedCoachId] = useState("");
  const [certificateType, setCertificateType] =
    useState<CertificateType>("business");
  const [month, setMonth] = useState(() => new Date().getMonth() + 1);
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const now = new Date();
    setCoachSearch("");
    setSelectedCoachId("");
    setCertificateType("business");
    setMonth(now.getMonth() + 1);
    setYear(now.getFullYear());
    setGenerating(false);
    setError(null);
  }, [open]);

  const filteredCoaches = useMemo(() => {
    const q = coachSearch.trim().toLowerCase();
    if (!q) return coaches;
    return coaches.filter((coach) => coach.label.toLowerCase().includes(q));
  }, [coachSearch, coaches]);

  const selectedCoach = coaches.find((coach) => coach.id === selectedCoachId);

  const handleGenerate = async () => {
    if (!selectedCoachId) {
      setError("Select a coach.");
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      const {
        data: { session },
      } = await supabaseClient.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Not signed in.");
      }

      const res = await fetch("/api/admin/coaches/certificate", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          coachId: selectedCoachId,
          certificateType,
          month,
          year,
        }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Could not generate certificate.");
      }

      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const filenameMatch = disposition.match(/filename="([^"]+)"/);
      const filename =
        filenameMatch?.[1] ??
        `${selectedCoach?.label ?? "coach"}-certificate.pdf`;

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate certificate.");
    } finally {
      setGenerating(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Generate certificate
            </h2>
            <p className="text-sm text-slate-500">
              Export a PDF certificate for a coach.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div className="space-y-2">
            <label
              htmlFor="certificate-coach-search"
              className="block text-sm font-medium text-slate-800"
            >
              Coach
            </label>
            <input
              id="certificate-coach-search"
              value={coachSearch}
              onChange={(e) => setCoachSearch(e.target.value)}
              placeholder="Search coaches…"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky-400"
            />
            <div className="max-h-44 overflow-y-auto rounded-lg border border-slate-200">
              {filteredCoaches.length ? (
                filteredCoaches.map((coach) => (
                  <label
                    key={coach.id}
                    className={`flex cursor-pointer items-center gap-2 border-b border-slate-100 px-3 py-2 text-sm last:border-b-0 hover:bg-slate-50 ${
                      selectedCoachId === coach.id ? "bg-sky-50" : ""
                    }`}
                  >
                    <input
                      type="radio"
                      name="certificate-coach"
                      checked={selectedCoachId === coach.id}
                      onChange={() => setSelectedCoachId(coach.id)}
                    />
                    {coach.label}
                  </label>
                ))
              ) : (
                <p className="px-3 py-4 text-sm text-slate-500">
                  No coaches match your search.
                </p>
              )}
            </div>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-slate-800">
              Certificate type
            </legend>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="radio"
                name="certificate-type"
                checked={certificateType === "business"}
                onChange={() => setCertificateType("business")}
              />
              Certified Business Coach
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="radio"
                name="certificate-type"
                checked={certificateType === "profit"}
                onChange={() => setCertificateType("profit")}
              />
              Certified Profit Coach
            </label>
          </fieldset>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label
                htmlFor="certificate-month"
                className="block text-sm font-medium text-slate-800"
              >
                Month
              </label>
              <select
                id="certificate-month"
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky-400"
              >
                {MONTH_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label
                htmlFor="certificate-year"
                className="block text-sm font-medium text-slate-800"
              >
                Year
              </label>
              <input
                id="certificate-year"
                type="number"
                min={2000}
                max={2100}
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky-400"
              />
            </div>
          </div>

          {error ? (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </p>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={generating || !selectedCoachId}
            onClick={() => void handleGenerate()}
            className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Download PDF
          </button>
        </div>
      </div>
    </div>
  );
}
