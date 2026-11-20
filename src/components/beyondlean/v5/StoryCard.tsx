import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { CaseStudy } from "@/lib/beyondlean/content";
import { HOME } from "./parts";
import { shortText } from "./shortText";

/** One story in the two-column grid: photo with the number, then client over result. */
export function StoryCard({ study }: { study: CaseStudy }) {
  return (
    <Link href={`${HOME}/case-studies/${study.slug}`} className="v5-cs-card" data-reveal>
      <div className="v5-cs-card-media">
        {study.photo && <Image src={study.photo} alt="" fill sizes="(max-width: 900px) 100vw, 260px" />}
        <div className="v5-cs-figure">
          <strong>{study.figure}</strong>
        </div>
      </div>
      <div className="v5-cs-card-body">
        <h3 className="v5-cs-title">
          <span>{study.client}</span>{" "}
          <strong>
            {study.figure} {study.figureLabel}
          </strong>
        </h3>
        <p className="v5-cs-teaser">{shortText(study.summary, 120)}</p>
        <span className="v5-article-more">
          Read the case study <ArrowRight aria-hidden />
        </span>
      </div>
    </Link>
  );
}

