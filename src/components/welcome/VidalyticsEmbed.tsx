"use client";

import { useEffect } from "react";

type Props = {
  /** DOM id for the player mount, e.g. `vidalytics_embed_3IYlKg8mXKnmU9DF`. */
  embedId: string;
  /** Base embed URL ending with `/`, from the Vidalytics snippet. */
  embedBaseUrl: string;
  title?: string;
  className?: string;
};

/**
 * Official Vidalytics embed (div + loader). Matches the BCA site bootstrap
 * that plays reliably there.
 */
export function VidalyticsEmbed({
  embedId,
  embedBaseUrl,
  title = "Video",
  className,
}: Props) {
  useEffect(() => {
    const base = embedBaseUrl.endsWith("/") ? embedBaseUrl : `${embedBaseUrl}/`;

    // Official Vidalytics embed bootstrap (logic unchanged from their snippet).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (function (v: any, i: Document, d: string, a: string, l: string, y?: any, t?: any, c?: any, s?: any) {
      y = "_" + d.toLowerCase();
      c = d + "L";
      if (!v[d]) v[d] = {};
      if (!v[c]) v[c] = {};
      if (!v[y]) v[y] = {};
      const vl = "Loader";
      let vli = v[y][vl];
      let vsl = v[c][vl + "Script"];
      let vlf = v[c][vl + "Loaded"];
      const ve = "Embed";
      if (!vsl) {
        vsl = function (u: string, cb: () => void) {
          if (t) {
            cb();
            return;
          }
          s = i.createElement("script");
          s.type = "text/javascript";
          s.async = 1;
          s.src = u;
          s.onload = function () {
            vlf = 1;
            cb();
          };
          i.getElementsByTagName("head")[0].appendChild(s);
        };
        v[c][vl + "Script"] = vsl;
      }
      vsl(l + "loader.min.js", function () {
        if (!vli) {
          const vlc = v[c][vl];
          vli = new vlc();
          v[y][vl] = vli;
        }
        vli.loadScript(l + "player.min.js", function () {
          const vec = v[d][ve];
          t = new vec();
          t.run(a);
        });
      });
    })(window, document, "Vidalytics", embedId, base);
  }, [embedId, embedBaseUrl]);

  return (
    <div
      id={embedId}
      role="region"
      aria-label={title}
      className={className}
      style={{ width: "100%", position: "relative", paddingTop: "56.25%" }}
    />
  );
}
