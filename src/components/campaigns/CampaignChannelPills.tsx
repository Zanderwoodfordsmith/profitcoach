import type { ReactNode } from "react";
import { LinkedInSolidIcon } from "@/components/icons/LinkedInSolidIcon";
import { WhatsAppGlyph } from "@/components/icons/WhatsAppGlyph";
import { InstagramGlyph } from "@/components/icons/InstagramGlyph";
import { MessengerGlyph } from "@/components/icons/MessengerGlyph";
import {
  campaignChannelsFromSteps,
  type CampaignChannel,
} from "@/lib/unipile/campaignStepTypes";

function EmailGlyph({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <circle cx="12" cy="12" r="12" fill="#0c5290" />
      <path
        fill="#fff"
        d="M6.6 8.2l5.4 3.5 5.4-3.5v7.6c0 .55-.45 1-1 1H7.6c-.55 0-1-.45-1-1V8.2zm9.9-1.2H7.5L12 10.4 16.5 7z"
      />
    </svg>
  );
}

const PILL: Record<
  CampaignChannel,
  {
    label: string;
    className: string;
    Icon: (props: { className?: string }) => ReactNode;
  }
> = {
  linkedin: {
    label: "LinkedIn",
    className: "bg-[#0A66C2]/10 text-[#0A66C2]",
    Icon: ({ className }) => <LinkedInSolidIcon className={className} />,
  },
  email: {
    label: "Email",
    className: "bg-[#0c5290]/10 text-[#0c5290]",
    Icon: EmailGlyph,
  },
  whatsapp: {
    label: "WhatsApp",
    className: "bg-[#25D366]/15 text-[#0f7a3f]",
    Icon: WhatsAppGlyph,
  },
  instagram: {
    label: "Instagram",
    className: "bg-[#E1306C]/10 text-[#C13584]",
    Icon: InstagramGlyph,
  },
  messenger: {
    label: "Messenger",
    className: "bg-[#0084FF]/10 text-[#0084FF]",
    Icon: MessengerGlyph,
  },
};

export function CampaignChannelPills({
  channels,
  stepTypes,
  campaignChannel,
  variant = "pills",
  className = "",
}: {
  channels?: readonly string[] | null;
  stepTypes?: readonly string[];
  campaignChannel?: string | null;
  variant?: "pills" | "stack";
  className?: string;
}) {
  const resolved =
    channels && channels.length > 0
      ? (channels.filter((c): c is CampaignChannel => c in PILL) as CampaignChannel[])
      : campaignChannelsFromSteps(stepTypes ?? [], campaignChannel);

  if (resolved.length === 0) return null;

  const label = `Sends on ${resolved.map((c) => PILL[c].label).join(", ")}`;

  if (variant === "stack") {
    return (
      <span
        className={`inline-flex items-center ${className}`}
        aria-label={label}
      >
        {resolved.map((channel, index) => {
          const pill = PILL[channel];
          return (
            <span
              key={channel}
              title={pill.label}
              className={`relative inline-flex h-[1.375rem] w-[1.375rem] items-center justify-center rounded-full bg-white ring-2 ring-white ${
                index > 0 ? "-ml-1.5" : ""
              }`}
              style={{ zIndex: index + 1 }}
            >
              <pill.Icon className="h-5 w-5" />
            </span>
          );
        })}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex flex-wrap items-center gap-1.5 ${className}`}
      aria-label={label}
    >
      {resolved.map((channel) => {
        const pill = PILL[channel];
        return (
          <span
            key={channel}
            className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${pill.className}`}
          >
            <pill.Icon className="h-3.5 w-3.5 shrink-0" />
            {pill.label}
          </span>
        );
      })}
    </span>
  );
}
