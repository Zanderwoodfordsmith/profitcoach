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
 * Official Vidalytics embed (div + loader). Runs their published bootstrap
 * once the mount node is in the DOM.
 */
export function VidalyticsEmbed({
  embedId,
  embedBaseUrl,
  title = "Video",
  className,
}: Props) {
  useEffect(() => {
    const base = embedBaseUrl.endsWith("/") ? embedBaseUrl : `${embedBaseUrl}/`;

    (function (
      v: Window & typeof globalThis,
      i: Document,
      d: string,
      a: string,
      l: string,
      y?: string,
      t?: unknown,
      c?: string,
      s?: HTMLScriptElement
    ) {
      y = `_${d.toLowerCase()}`;
      c = `${d}L`;
      const bag = v as unknown as Record<string, Record<string, unknown>>;
      if (!bag[d]) bag[d] = {};
      if (!bag[c]) bag[c] = {};
      if (!bag[y]) bag[y] = {};

      const vl = "Loader";
      let vli = bag[y][vl] as
        | { loadScript: (u: string, cb: () => void) => void }
        | undefined;
      let vsl = bag[c][`${vl}Script`] as
        | ((u: string, cb: () => void) => void)
        | undefined;
      let vlf = bag[c][`${vl}Loaded`];
      const ve = "Embed";

      if (!vsl) {
        vsl = (u, cb) => {
          if (t) {
            cb();
            return;
          }
          s = i.createElement("script");
          s.type = "text/javascript";
          s.async = true;
          s.src = u;
          s.onload = () => {
            vlf = 1;
            bag[c!][`${vl}Loaded`] = 1;
            cb();
          };
          i.getElementsByTagName("head")[0].appendChild(s);
        };
        bag[c][`${vl}Script`] = vsl;
      }

      vsl(`${l}loader.min.js`, () => {
        if (!vli) {
          const LoaderCtor = bag[c!][vl] as
            | (new () => { loadScript: (u: string, cb: () => void) => void })
            | undefined;
          if (!LoaderCtor) return;
          vli = new LoaderCtor();
          bag[y!][vl] = vli;
        }
        vli.loadScript(`${l}player.min.js`, () => {
          const EmbedCtor = bag[d][ve] as
            | (new () => { run: (id: string) => void })
            | undefined;
          if (!EmbedCtor) return;
          t = new EmbedCtor();
          (t as { run: (id: string) => void }).run(a);
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
