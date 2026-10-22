import { Check } from "lucide-react";
import { parseProposalBody } from "@/lib/proposals/types";

/** A section's plain text as paragraphs, small headings and ticked bullets. */
export function ProposalBody({ body }: { body: string }) {
  return (
    <div className="cxp-body">
      {parseProposalBody(body).map((block, i) =>
        block.kind === "ul" ? (
          <ul key={i} className="cxd-checks">
            {block.items.map((item) => (
              <li key={item}>
                <Check size={16} strokeWidth={2.5} aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        ) : block.kind === "h" ? (
          <h3 key={i} className="cxd-h3">
            {block.text}
          </h3>
        ) : (
          <p key={i}>{block.text}</p>
        )
      )}
    </div>
  );
}
