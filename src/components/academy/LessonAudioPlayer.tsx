"use client";

type Props = {
  src: string;
  title?: string;
  className?: string;
};

/** Compact listen strip under the lesson video — for car / on-the-go playback. */
export function LessonAudioPlayer({ src, title, className }: Props) {
  return (
    <div className={className}>
      <p className="text-kicker font-semibold uppercase text-slate-500">
        Listen
      </p>
      <audio
        className="mt-2 w-full"
        controls
        preload="metadata"
        src={src}
        title={title ? `Listen: ${title}` : "Lesson audio"}
      >
        Your browser does not support the audio element.
      </audio>
    </div>
  );
}
