"use client";

import type { GuidePage } from "@/lib/practiceKnowledge/clientSessions";
import { ChevronDown } from "lucide-react";

export function SessionGuide({ guide }: { guide: GuidePage }) {
  return (
    <article className="space-y-8">
      <p className="text-[1.0625rem] leading-[1.55] text-[#475569]">{guide.note}</p>
      <div>
        {guide.cards.map((card, index) => (
          <details
            key={card.id}
            open={index === 0}
            className="group border-b border-slate-200/70"
          >
            <summary className={`flex cursor-pointer list-none items-start gap-3 py-5 [&::-webkit-details-marker]:hidden ${index === 0 ? "pt-0" : ""}`}>
              <ChevronDown
                aria-hidden
                className="mt-1 h-5 w-5 shrink-0 text-[#334155] transition-transform duration-150 group-open:rotate-180"
              />
              <span className="min-w-0">
                <span className="block text-[1.375rem] font-semibold leading-snug tracking-[-0.02em] text-[#0f172a]">
                  {card.title}
                </span>
                <span className="mt-1 block text-sm text-[#64748b]">{card.time}</span>
              </span>
            </summary>
            <div className="mb-5 ml-8 space-y-6 text-[1.0625rem] leading-[1.55] text-[#1e293b]">
              <p>{card.lede}</p>
              {card.sections.map((section) => (
                <section key={section.heading}>
                  <h3 className="text-[1.125rem] font-semibold tracking-[-0.02em] text-[#0f172a]">
                    {section.heading}
                  </h3>
                  {section.paragraphs?.map((paragraph) => (
                    <p key={paragraph} className="mt-2">
                      {paragraph}
                    </p>
                  ))}
                  {section.bullets ? (
                    <ul className="mt-2 list-disc space-y-1 pl-5 marker:text-[#94a3b8]">
                      {section.bullets.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  ) : null}
                  {section.links ? (
                    <ul className="mt-2 space-y-1">
                      {section.links.map((link) => (
                        <li key={link.href}>
                          <a
                            href={link.href}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[#0369a1] underline decoration-[#0369a1]/30 underline-offset-[3px] hover:decoration-current"
                          >
                            {link.label}
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {section.rows ? (
                    <div className="mt-3 overflow-x-auto rounded-[10px] border border-slate-200">
                      <table className="w-full min-w-[36rem] border-collapse text-left text-[0.9375rem] leading-snug">
                        <thead>
                          <tr className="bg-[#f8fafc] text-xs font-bold uppercase tracking-[0.06em] text-[#64748b]">
                            <th className="px-3 py-2 font-bold">Step</th>
                            <th className="px-3 py-2 font-bold">What you do</th>
                            <th className="px-3 py-2 font-bold">Ask</th>
                          </tr>
                        </thead>
                        <tbody>
                          {section.rows.map((row) => (
                            <tr key={row.name} className="border-t border-slate-200 align-top">
                              <td className="px-3 py-2 font-semibold text-[#0f172a]">{row.name}</td>
                              <td className="px-3 py-2">{row.detail}</td>
                              <td className="px-3 py-2 text-[#475569]">{row.ask}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </section>
              ))}
            </div>
          </details>
        ))}
      </div>
    </article>
  );
}
