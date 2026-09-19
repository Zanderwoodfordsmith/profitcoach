import { Fraunces } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import { Play } from "lucide-react";
import { BCA_SUPPORT_EMAIL } from "@/config/businessContact";
import {
  ACADEMY_MOVED_LOGIN_NEXT,
  ACADEMY_MOVED_VIDEO_URL,
} from "@/config/academyMoved";
import { resolveAcademyMovedMedia } from "@/lib/academyMovedVideo";
import { buildLoginUrl } from "@/lib/auth/loginReturnPath";

const fraunces = Fraunces({
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata = {
  title: "The Academy Moved — The Profit Coach",
  description:
    "The Profit Coach academy is on the new platform. Watch the walkthrough, then log in.",
};

function VideoStage() {
  const media = resolveAcademyMovedMedia(ACADEMY_MOVED_VIDEO_URL);

  return (
    <div className="relative w-full overflow-hidden rounded-[1.25rem] bg-[#0a1828] shadow-[0_28px_80px_-24px_rgba(0,0,0,0.72)] ring-1 ring-white/12">
      <div className="relative aspect-video w-full">
        {media?.kind === "embed" ? (
          <iframe
            src={media.embedUrl}
            title="Academy walkthrough"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            className="absolute inset-0 h-full w-full border-0"
          />
        ) : media?.kind === "file" ? (
          <video
            src={media.src}
            controls
            playsInline
            preload="metadata"
            className="absolute inset-0 h-full w-full bg-black object-contain"
          >
            Your browser cannot play this video.
          </video>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[radial-gradient(ellipse_at_center,rgba(66,161,238,0.16)_0%,rgba(10,24,40,0)_62%)]">
            <span
              aria-hidden
              className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/20"
            >
              <Play className="ml-0.5 h-7 w-7 text-white" strokeWidth={1.75} />
            </span>
            <p className="max-w-[16rem] text-center text-sm leading-relaxed text-slate-300">
              Walkthrough video goes here. Log in below to get into the new
              academy now.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function NewAcademyPage() {
  const loginHref = buildLoginUrl(ACADEMY_MOVED_LOGIN_NEXT);

  return (
    <div className="relative min-h-screen bg-[#07111c] text-white selection:bg-sky-400/35 selection:text-white">
      <div className="sticky top-0 z-20 flex w-full flex-wrap items-center justify-center gap-x-4 gap-y-2 bg-[#f97316] px-4 py-2.5 sm:py-3">
        <Link
          href={loginHref}
          className="inline-flex shrink-0 items-center justify-center rounded-full bg-[#07111c] px-5 py-2 text-[14px] font-semibold text-white transition-colors hover:bg-[#0c1c2e] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#07111c] focus-visible:ring-offset-2 focus-visible:ring-offset-[#f97316] sm:text-[15px]"
        >
          Click here to log in
        </Link>
        <p className="text-left text-[14px] font-normal leading-snug text-[#07111c] sm:text-[15px]">
          <span className="font-semibold">Email:</span> same as before
          <br />
          <span className="font-semibold">Password:</span>{" "}
          <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 font-mono font-bold text-emerald-800">
            bcalogin
          </span>
        </p>
      </div>

      <div className="relative overflow-x-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 70% 45% at 50% 18%, rgba(66,161,238,0.22) 0%, rgba(7,17,28,0) 70%)",
          }}
        />

        <div className="relative mx-auto flex w-full max-w-[920px] flex-col items-center px-4 pb-16 pt-8 sm:px-6 sm:pt-10">
          <Image
            src="/brand/profit-coach-logo-white.svg"
            alt="The Profit Coach"
            width={220}
            height={48}
            priority
            className="h-10 w-auto sm:h-11"
          />

          <header className="mt-10 max-w-2xl text-center sm:mt-12">
            <h1
              className={`${fraunces.className} text-[2.15rem] leading-[1.12] tracking-tight text-white sm:text-[2.75rem]`}
            >
              The Academy Moved{" "}
              <span className="mt-1 block italic text-[#7ec8f5]">
                Here Is The New Home
              </span>
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-slate-300 sm:text-base">
              Same members, same materials, new platform. Watch the short
              walkthrough, then log in.
            </p>
          </header>

          <div className="mt-8 w-full sm:mt-10">
            <VideoStage />
          </div>

          <div className="mt-8 flex w-full max-w-md flex-col items-center gap-4 sm:mt-10">
            <Link
              href={loginHref}
              className="inline-flex w-full items-center justify-center rounded-full bg-white px-8 py-3.5 text-[15px] font-semibold text-[#07111c] shadow-[0_12px_32px_-12px_rgba(255,255,255,0.45)] transition-colors hover:bg-[#e8f4fc] focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#07111c]"
            >
              Log in to Profit Coach
            </Link>
            <p className="text-center text-sm leading-relaxed text-slate-400">
              Stuck?{" "}
              <a
                href={`mailto:${BCA_SUPPORT_EMAIL}`}
                className="font-medium text-[#7ec8f5] underline decoration-[#7ec8f5]/30 underline-offset-4 hover:text-sky-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
              >
                Email support
              </a>
              .
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
