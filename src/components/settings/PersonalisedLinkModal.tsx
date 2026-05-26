"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { OutlinedTextField } from "@/components/settings/OutlinedFormField";
import {
  buildPersonalisedAssessmentLink,
  buildPersonalisedAssessmentProLink,
} from "@/lib/assessmentContactParams";
import { selectContactsWithOptionalPhone } from "@/lib/contactsSchemaSafeSelect";
import { splitFullName } from "@/lib/splitFullName";
import { supabaseClient } from "@/lib/supabaseClient";

export type PersonalisedLinkProduct = "boss-score" | "boss-pro";

type ProspectPickerRow = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  business_name: string | null;
};

type PersonalisedLinkModalProps = {
  open: boolean;
  product: PersonalisedLinkProduct | null;
  coachSlug: string;
  appOrigin: string;
  impersonatingCoachId?: string | null;
  onClose: () => void;
};

type ModalView = "list" | "new";

function productLabel(product: PersonalisedLinkProduct): string {
  return product === "boss-score" ? "Boss Score" : "Boss Pro";
}

export function PersonalisedLinkModal({
  open,
  product,
  coachSlug,
  appOrigin,
  impersonatingCoachId,
  onClose,
}: PersonalisedLinkModalProps) {
  const [view, setView] = useState<ModalView>("list");
  const [prospects, setProspects] = useState<ProspectPickerRow[]>([]);
  const [prospectsLoading, setProspectsLoading] = useState(false);
  const [prospectsError, setProspectsError] = useState<string | null>(null);
  const [prospectSearch, setProspectSearch] = useState("");
  const [selectedProspectId, setSelectedProspectId] = useState<string | null>(
    null
  );

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [businessName, setBusinessName] = useState("");

  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const resetForm = useCallback(() => {
    setView("list");
    setProspectSearch("");
    setSelectedProspectId(null);
    setFirstName("");
    setLastName("");
    setEmail("");
    setPhone("");
    setBusinessName("");
    setGeneratedLink(null);
    setGenerateError(null);
    setCopied(false);
    setProspectsError(null);
  }, []);

  useEffect(() => {
    if (!open) return;
    resetForm();
  }, [open, product, resetForm]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    async function loadProspects() {
      setProspectsLoading(true);
      setProspectsError(null);

      const {
        data: { user },
      } = await supabaseClient.auth.getUser();
      if (!user) {
        if (!cancelled) {
          setProspectsError("Sign in to load prospects.");
          setProspectsLoading(false);
        }
        return;
      }

      const roleRes = await fetch("/api/profile-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      const roleBody = (await roleRes.json().catch(() => ({}))) as {
        role?: string;
      };
      const effectiveId =
        roleBody.role === "admin" && impersonatingCoachId
          ? impersonatingCoachId
          : user.id;

      const { data, error } = await selectContactsWithOptionalPhone<{
        id: string;
        full_name: string;
        email: string | null;
        business_name: string | null;
        phone: string | null;
      }>(
        async (columns) =>
          supabaseClient
            .from("contacts")
            .select(columns)
            .eq("coach_id", effectiveId)
            .eq("type", "prospect")
            .order("created_at", { ascending: false }),
        "id, full_name, email, business_name, type, created_at"
      );

      if (cancelled) return;

      if (error) {
        setProspectsError("Could not load prospects.");
        setProspects([]);
      } else {
        setProspects(
          (data ?? []).map((row) => ({
            id: row.id,
            full_name: row.full_name,
            email: row.email,
            phone: row.phone,
            business_name: row.business_name,
          }))
        );
      }
      setProspectsLoading(false);
    }

    void loadProspects();
    return () => {
      cancelled = true;
    };
  }, [open, impersonatingCoachId]);

  const filteredProspects = useMemo(() => {
    const q = prospectSearch.trim().toLowerCase();
    if (!q) return prospects;
    return prospects.filter((p) => {
      const haystack = [p.full_name, p.email, p.business_name, p.phone]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [prospects, prospectSearch]);

  const selectedProspect = useMemo(
    () => prospects.find((p) => p.id === selectedProspectId) ?? null,
    [prospects, selectedProspectId]
  );

  function clearContactFields() {
    setFirstName("");
    setLastName("");
    setEmail("");
    setPhone("");
    setBusinessName("");
  }

  function applyProspect(prospect: ProspectPickerRow) {
    setSelectedProspectId(prospect.id);
    const { first_name, last_name } = splitFullName(prospect.full_name);
    setFirstName(first_name ?? "");
    setLastName(last_name ?? "");
    setEmail(prospect.email ?? "");
    setPhone(prospect.phone ?? "");
    setBusinessName(prospect.business_name ?? "");
    setGeneratedLink(null);
    setGenerateError(null);
    setCopied(false);
  }

  function openNewProspectForm() {
    setView("new");
    setSelectedProspectId(null);
    clearContactFields();
    setGeneratedLink(null);
    setGenerateError(null);
    setCopied(false);
  }

  function backToList() {
    setView("list");
    setSelectedProspectId(null);
    clearContactFields();
    setGeneratedLink(null);
    setGenerateError(null);
    setCopied(false);
  }

  function handleGenerate() {
    setGenerateError(null);
    setCopied(false);
    const slug = coachSlug.trim();
    if (!slug || !product) return;

    const emailVal = email.trim();
    if (!emailVal) {
      setGenerateError("Email is required to generate a personalised link.");
      setGeneratedLink(null);
      return;
    }

    const input = {
      coachSlug: slug,
      firstName,
      lastName,
      email: emailVal,
      phone,
      businessName,
      origin: appOrigin,
    };

    setGeneratedLink(
      product === "boss-score"
        ? buildPersonalisedAssessmentLink(input)
        : buildPersonalisedAssessmentProLink(input)
    );
  }

  async function handleCopy() {
    if (!generatedLink) return;
    try {
      await navigator.clipboard.writeText(generatedLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setGenerateError("Could not copy — select the link and copy manually.");
    }
  }

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open || !product) return null;

  const productTitle = productLabel(product);
  const canGenerate =
    view === "new" || (view === "list" && selectedProspectId != null);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="personalised-link-title"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2
              id="personalised-link-title"
              className="text-lg font-semibold text-slate-900"
            >
              Personalise {productTitle} link
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Pick a prospect or add someone new to generate a link that
              pre-fills their details.
              {product === "boss-score" ? (
                <span> Goes direct to the scorecard.</span>
              ) : null}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-md px-2 py-1 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          >
            Close
          </button>
        </div>

        {view === "list" ? (
          <div className="mt-5 space-y-3">
            <button
              type="button"
              onClick={openNewProspectForm}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-sky-300 bg-sky-50/60 px-4 py-2.5 text-sm font-medium text-sky-800 transition hover:border-sky-400 hover:bg-sky-50"
            >
              <span aria-hidden>+</span>
              Add new prospect
            </button>

            <OutlinedTextField
              id="prospect_search"
              label="Search"
              value={prospectSearch}
              onChange={(e) => setProspectSearch(e.target.value)}
              placeholder="Name, email, or business"
              wrapperClassName="w-full"
            />

            <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-200">
              {prospectsLoading ? (
                <p className="px-4 py-6 text-center text-sm text-slate-500">
                  Loading prospects…
                </p>
              ) : prospectsError ? (
                <p className="px-4 py-6 text-center text-sm text-rose-600">
                  {prospectsError}
                </p>
              ) : filteredProspects.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-slate-500">
                  {prospects.length === 0
                    ? "No prospects yet — add one above."
                    : "No matches for your search."}
                </p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {filteredProspects.map((prospect) => {
                    const selected = selectedProspectId === prospect.id;
                    return (
                      <li key={prospect.id}>
                        <button
                          type="button"
                          onClick={() => applyProspect(prospect)}
                          className={`flex w-full flex-col items-start gap-0.5 px-4 py-3 text-left transition hover:bg-slate-50 ${
                            selected
                              ? "bg-sky-50 ring-1 ring-inset ring-sky-200"
                              : ""
                          }`}
                        >
                          <span className="font-medium text-slate-900">
                            {prospect.full_name}
                          </span>
                          <span className="text-xs text-slate-500">
                            {[prospect.email, prospect.business_name]
                              .filter(Boolean)
                              .join(" · ") || "No email on file"}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {selectedProspect ? (
              <p className="text-sm text-slate-600">
                Selected:{" "}
                <span className="font-medium text-slate-900">
                  {selectedProspect.full_name}
                </span>
                {!selectedProspect.email ? (
                  <span className="text-amber-700">
                    {" "}
                    — add an email via Prospects before generating a link.
                  </span>
                ) : null}
              </p>
            ) : null}
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            <button
              type="button"
              onClick={backToList}
              className="text-sm font-medium text-sky-700 hover:text-sky-900 hover:underline"
            >
              ← Back to prospects
            </button>

            <div className="grid gap-4 sm:grid-cols-2">
              <OutlinedTextField
                id="personalised_first_name"
                label="First name"
                value={firstName}
                onChange={(e) => {
                  setFirstName(e.target.value);
                  setGeneratedLink(null);
                }}
                placeholder="John"
                wrapperClassName="w-full"
              />
              <OutlinedTextField
                id="personalised_last_name"
                label="Last name"
                value={lastName}
                onChange={(e) => {
                  setLastName(e.target.value);
                  setGeneratedLink(null);
                }}
                placeholder="Jones"
                wrapperClassName="w-full"
              />
              <OutlinedTextField
                id="personalised_email"
                label="Email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setGeneratedLink(null);
                }}
                placeholder="john@example.com"
                wrapperClassName="w-full sm:col-span-2"
              />
              <OutlinedTextField
                id="personalised_phone"
                label="Phone (optional)"
                type="tel"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  setGeneratedLink(null);
                }}
                placeholder="+44 7700 900123"
                wrapperClassName="w-full sm:col-span-2"
              />
              <OutlinedTextField
                id="personalised_business_name"
                label="Business name (optional)"
                value={businessName}
                onChange={(e) => {
                  setBusinessName(e.target.value);
                  setGeneratedLink(null);
                }}
                placeholder="BrightCo Marketing"
                wrapperClassName="w-full sm:col-span-2"
              />
            </div>
          </div>
        )}

        {generateError ? (
          <p className="mt-3 text-sm text-rose-600" role="alert">
            {generateError}
          </p>
        ) : null}

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={!canGenerate}
            className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Generate link
          </button>
        </div>

        {generatedLink ? (
          <div className="mt-5 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <label
              htmlFor="personalised_generated_link"
              className="block text-xs font-medium uppercase tracking-wide text-slate-500"
            >
              Your link
            </label>
            <textarea
              id="personalised_generated_link"
              readOnly
              rows={3}
              value={generatedLink}
              className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-800 shadow-sm"
            />
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
              <button
                type="button"
                onClick={() => void handleCopy()}
                className="font-medium text-sky-700 hover:text-sky-900 hover:underline"
              >
                {copied ? "Copied!" : "Copy link"}
              </button>
              <Link
                href={generatedLink}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-sky-700 hover:text-sky-900 hover:underline"
              >
                Preview
              </Link>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
