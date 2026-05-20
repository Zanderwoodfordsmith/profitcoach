"use client";

type OpenTextStepProps = {
  value: string;
  onChange: (value: string) => void;
};

export function OpenTextStep({ value, onChange }: OpenTextStepProps) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={6}
      placeholder="Optional: share anything that would help us understand your situation..."
      className="block w-full resize-y rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-[#2D2F46] outline-none placeholder:text-slate-400 focus:border-[#438BCA] focus:ring-1 focus:ring-[#438BCA]"
    />
  );
}
