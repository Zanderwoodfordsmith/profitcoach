"use client";

import "./helpCentre.css";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  CalendarDays,
  ChevronRight,
  Gauge,
  MessageSquare,
  Newspaper,
  Plug,
  Receipt,
  Rocket,
  Search,
  Signpost,
  Users,
  type LucideIcon,
} from "lucide-react";

import { plainHelpAnswer as plain } from "@/lib/help/plainHelpAnswer";
import {
  HELP_ANSWERS,
  HELP_TOPICS,
  helpTopic,
  searchHelpAnswers,
  type HelpAnswer,
  type HelpTopicId,
} from "@/lib/help/helpAnswers";

const TOPIC_ICONS: Record<HelpTopicId, LucideIcon> = {
  "getting-started": Rocket,
  "linkedin-newsletter": Newspaper,
  "campaigns-prospects": Users,
  "boss-score": Gauge,
  "calls-calendar": CalendarDays,
  connections: Plug,
  money: Receipt,
  "where-things-moved": Signpost,
};

export const HELP_BASE = "/coach/support?tab=help";
const NEW_CHAT = "/coach/support?new=1";

export function helpHref(parts: { topic?: HelpTopicId | null; article?: string | null }): string {
  if (parts.article) return `${HELP_BASE}&a=${encodeURIComponent(parts.article)}`;
  if (parts.topic) return `${HELP_BASE}&topic=${parts.topic}`;
  return HELP_BASE;
}

type Props = {
  topic: string | null;
  article: string | null;
  /** Admins see which answers still wait on a fact, and where each came from. */
  admin: boolean;
};

export function HelpCentre({ topic, article, admin }: Props) {
  const answer = article ? HELP_ANSWERS.find((a) => a.id === article) ?? null : null;
  const topicId = (answer?.topic ?? topic) as HelpTopicId | null;
  const topicOk = topicId ? HELP_TOPICS.some((t) => t.id === topicId) : false;

  if (answer) return <ArticleView answer={answer} admin={admin} />;
  if (topicId && topicOk) return <TopicView topicId={topicId} admin={admin} />;
  return <HomeView admin={admin} />;
}

/* ---------- Home: band, search, topics, callout ---------- */

function HomeView({ admin }: { admin: boolean }) {
  const [q, setQ] = useState("");
  const results = useMemo(() => (q.trim().length >= 2 ? searchHelpAnswers(q, HELP_ANSWERS, 10) : []), [q]);
  const waiting = HELP_ANSWERS.filter((a) => a.needs);

  return (
    <div className="bp-doc flex flex-col gap-10 pb-16">
      <section className="hc-band px-6 py-14 sm:px-10 sm:py-16">
        <div className="mx-auto flex w-full max-w-2xl flex-col items-center text-center">
          <h1 className="hc-headline bp-display text-4xl font-semibold sm:text-5xl">How can we help?</h1>
          <p className="mt-3 max-w-md text-base text-white/80 sm:text-lg">
            Short answers to the things coaches ask, in plain words. Search, or pick a topic.
          </p>
          <label className="hc-search mt-8 px-5 py-3.5 sm:py-4">
            <Search className="h-5 w-5 shrink-0 text-[#8595a8]" aria-hidden />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search for an answer"
              aria-label="Search the help centre"
              autoComplete="off"
            />
          </label>
        </div>
      </section>

      {q.trim().length >= 2 ? (
        <section className="mx-auto w-full max-w-3xl" aria-live="polite">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[#55657a]">
            {results.length ? `${results.length} ${results.length === 1 ? "answer" : "answers"}` : "No answers yet"}
          </h2>
          {results.length ? (
            <ul className="mt-3 flex flex-col gap-2">
              {results.map((a) => (
                <li key={a.id}>
                  <Link href={helpHref({ article: a.id })} className="hc-results-item">
                    <span className="block text-[15px] font-semibold text-[#0b1b2e]">{a.question}</span>
                    <span className="mt-0.5 block text-xs text-[#8595a8]">{helpTopic(a.topic).name}</span>
                    <span className="mt-1.5 line-clamp-2 block text-sm text-[#55657a]">{plain(a.answer)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-base text-[#55657a]">
              Try different words, or{" "}
              <Link href={NEW_CHAT} className="font-medium text-[#0c5290] underline underline-offset-4">
                ask us in a chat
              </Link>
              . We reply within a working day.
            </p>
          )}
        </section>
      ) : (
        <>
          <section className="mx-auto w-full max-w-6xl">
            <h2 className="bp-display text-center text-2xl font-semibold text-[#0b1b2e]">Browse by topic</h2>
            <ul className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
              {HELP_TOPICS.map((t) => {
                const Icon = TOPIC_ICONS[t.id];
                const count = HELP_ANSWERS.filter((a) => a.topic === t.id && (admin || !a.needs)).length;
                return (
                  <li key={t.id}>
                    <Link href={helpHref({ topic: t.id })} className="hc-card h-full px-6 pb-7 pt-8">
                      <span className="hc-card-icon">
                        <Icon className="h-6 w-6" aria-hidden />
                      </span>
                      <span className="mt-5 flex min-h-[2.75rem] items-end justify-center text-base font-semibold leading-snug text-[#0b1b2e]">{t.name}</span>
                      <span className="mt-2 block text-sm leading-snug text-[#55657a]">{t.blurb}</span>
                      <span className="mt-auto block pt-5 text-xs font-medium text-[#8595a8]">
                        {count} {count === 1 ? "answer" : "answers"}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>

          <div className="mx-auto w-full max-w-6xl">
            <Callout compact />
          </div>

          {admin && waiting.length ? (
            <section className="mx-auto w-full max-w-5xl rounded-lg border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
              <p className="font-semibold">Admin: {waiting.length} answers still wait on a fact.</p>
              <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                {waiting.map((a) => (
                  <li key={a.id}>
                    <Link href={helpHref({ article: a.id })} className="underline underline-offset-4">
                      {a.question}
                    </Link>{" "}
                    <span className="text-amber-700">({a.needs === "zander" ? "Zander" : "Pam"})</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-amber-800">Coaches do not see these until the fact is confirmed.</p>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}

function Callout({ compact }: { compact?: boolean }) {
  return (
    <section className={`hc-callout mx-auto w-full ${compact ? "" : "max-w-5xl"} px-6 py-6 sm:px-8`}>
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <span className="hidden h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-[#0c5290] sm:grid">
            <MessageSquare className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <p className="text-lg font-semibold text-[#0b1b2e]">Can&apos;t find what you&apos;re looking for?</p>
            <p className="mt-0.5 text-sm text-[#55657a]">Start a chat with us. Pam and Zander both see it, and we reply within a working day.</p>
          </div>
        </div>
        <Link
          href={NEW_CHAT}
          className="inline-flex shrink-0 items-center gap-2 rounded-md bg-[#0c5290] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0a4578]"
        >
          Start a chat
        </Link>
      </div>
    </section>
  );
}

/* ---------- Topic: left list, right questions ---------- */

function TopicSidebar({ active, admin }: { active: HelpTopicId; admin: boolean }) {
  const [q, setQ] = useState("");
  const results = useMemo(() => (q.trim().length >= 2 ? searchHelpAnswers(q, HELP_ANSWERS, 8) : []), [q]);
  return (
    <aside className="order-last w-full border-t border-[#e8edf3] pt-8 lg:order-first lg:w-64 lg:shrink-0 lg:border-0 lg:pt-0">
      <label className="flex items-center gap-2 border-b border-[#e8edf3] pb-2 text-sm">
        <Search className="h-4 w-4 shrink-0 text-[#8595a8]" aria-hidden />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search for an answer"
          aria-label="Search the help centre"
          className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-[#8595a8]"
          autoComplete="off"
        />
      </label>
      {results.length ? (
        <ul className="mt-2 flex flex-col">
          {results.map((a) => (
            <li key={a.id}>
              <Link href={helpHref({ article: a.id })} className="block rounded-md px-2 py-1.5 text-sm text-[#0c5290] hover:bg-[#f2f7fc]">
                {a.question}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      <h2 className="mt-6 px-3 text-xs font-semibold uppercase tracking-wide text-[#8595a8]">Topics</h2>
      <ul className="mt-2 flex flex-col gap-0.5">
        {HELP_TOPICS.map((t) => {
          const count = HELP_ANSWERS.filter((a) => a.topic === t.id && (admin || !a.needs)).length;
          const current = t.id === active;
          return (
            <li key={t.id}>
              <Link href={helpHref({ topic: t.id })} className="hc-topic-link text-sm" aria-current={current ? "true" : undefined}>
                <span>{t.name}</span>
                <span className="flex items-center gap-1 text-xs text-[#8595a8]">
                  {count}
                  {current ? <ChevronRight className="h-3.5 w-3.5" aria-hidden /> : null}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

function Crumbs({ items }: { items: Array<{ label: string; href?: string }> }) {
  return (
    <nav aria-label="Where you are" className="flex flex-wrap items-center gap-1.5 text-sm text-[#55657a]">
      {items.map((it, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 ? <ChevronRight className="h-3.5 w-3.5 text-[#8595a8]" aria-hidden /> : null}
          {it.href ? (
            <Link href={it.href} className="text-[#0c5290] hover:underline hover:underline-offset-4">
              {it.label}
            </Link>
          ) : (
            <span className="text-[#1f2d3d]">{it.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

function TopicView({ topicId, admin }: { topicId: HelpTopicId; admin: boolean }) {
  const t = helpTopic(topicId);
  const Icon = TOPIC_ICONS[t.id];
  const list = HELP_ANSWERS.filter((a) => a.topic === t.id && (admin || !a.needs));
  return (
    <div className="bp-doc mx-auto w-full max-w-5xl pb-16">
      <Crumbs items={[{ label: "Help", href: HELP_BASE }, { label: t.name }]} />
      <header className="mt-5 flex items-start gap-4">
        <span className="hc-card-icon shrink-0">
          <Icon className="h-6 w-6" aria-hidden />
        </span>
        <div>
          <h1 className="bp-display text-3xl font-semibold text-[#0b1b2e]">{t.name}</h1>
          <p className="mt-1 text-base text-[#55657a]">{t.blurb}</p>
        </div>
      </header>
      <div className="mt-10 flex flex-col gap-10 lg:flex-row lg:gap-16">
        <TopicSidebar active={t.id} admin={admin} />
        <section className="min-w-0 flex-1">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[#8595a8]">
            {list.length} {list.length === 1 ? "answer" : "answers"}
          </h2>
          <ul className="mt-2">
            {list.map((a) => (
              <li key={a.id}>
                <Link href={helpHref({ article: a.id })} className="hc-q">
                  {a.question}
                  {admin && a.needs ? <NeedsBadge needs={a.needs} /> : null}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-10">
            <Callout compact />
          </div>
        </section>
      </div>
    </div>
  );
}

/* ---------- Article ---------- */

function ArticleView({ answer, admin }: { answer: HelpAnswer; admin: boolean }) {
  const t = helpTopic(answer.topic);
  const siblings = HELP_ANSWERS.filter((a) => a.topic === t.id && a.id !== answer.id && (admin || !a.needs)).slice(0, 6);
  return (
    <div className="bp-doc mx-auto w-full max-w-5xl pb-16">
      <Crumbs items={[{ label: "Help", href: HELP_BASE }, { label: t.name, href: helpHref({ topic: t.id }) }, { label: answer.question }]} />
      <div className="mt-6 flex flex-col gap-10 lg:flex-row lg:gap-16">
        <TopicSidebar active={t.id} admin={admin} />
        <article className="hc-article min-w-0 max-w-2xl flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#0c5290]">{t.name}</p>
          <h1 className="bp-display mt-2">{answer.question}</h1>
          {admin && answer.needs ? (
            <p className="mt-3 inline-flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm text-amber-900">
              Waiting on {answer.needs === "zander" ? "Zander" : "Pam"} to confirm this answer. Coaches do not see it yet.
            </p>
          ) : null}
          <div className="hc-rule mt-5 w-24" />
          <div className="mt-6">{renderAnswer(answer.answer)}</div>

          {siblings.length ? (
            <section className="mt-12 border-t border-[#e8edf3] pt-6">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-[#8595a8]">More on {t.name.toLowerCase()}</h2>
              <ul className="mt-2">
                {siblings.map((a) => (
                  <li key={a.id}>
                    <Link href={helpHref({ article: a.id })} className="hc-q !text-[15px]">
                      {a.question}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <div className="mt-10">
            <Callout compact />
          </div>

          {admin && answer.sources?.length ? (
            <p className="mt-6 text-xs text-[#8595a8]">Admin: from {answer.sources.join(", ")}.</p>
          ) : null}
        </article>
      </div>
    </div>
  );
}

function NeedsBadge({ needs }: { needs: "zander" | "pam" }) {
  return (
    <span className="ml-2 inline-block rounded-sm bg-amber-100 px-1.5 py-0.5 align-middle text-[11px] font-medium text-amber-900">
      needs {needs === "zander" ? "Zander" : "Pam"}
    </span>
  );
}

/* ---------- Answer text: paragraphs and [label](url) links ---------- */

const LINK = /\[([^\]]+)\]\(([^)]+)\)/g;

function renderAnswer(text: string): ReactNode {
  return text.split(/\n\s*\n/).map((para, i) => <p key={i}>{renderInline(para)}</p>);
}

function renderInline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(LINK)) {
    const start = m.index ?? 0;
    if (start > last) out.push(text.slice(last, start));
    const href = m[2];
    const external = /^https?:/.test(href);
    out.push(
      external ? (
        <a key={start} href={href} target="_blank" rel="noreferrer">
          {m[1]}
        </a>
      ) : (
        <Link key={start} href={href}>
          {m[1]}
        </Link>
      )
    );
    last = start + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

