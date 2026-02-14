/**
 * SVG wedge path for donut/ring segments.
 * Ported from BOSS Dashboard thank-you.js.
 */
export function wedgePath(
  cx: number,
  cy: number,
  rInner: number,
  rOuter: number,
  startAngle: number,
  endAngle: number
): string {
  const x1 = cx + rInner * Math.cos(startAngle);
  const y1 = cy + rInner * Math.sin(startAngle);
  const x2 = cx + rInner * Math.cos(endAngle);
  const y2 = cy + rInner * Math.sin(endAngle);
  const x3 = cx + rOuter * Math.cos(endAngle);
  const y3 = cy + rOuter * Math.sin(endAngle);
  const x4 = cx + rOuter * Math.cos(startAngle);
  const y4 = cy + rOuter * Math.sin(startAngle);
  const large = endAngle - startAngle > Math.PI ? 1 : 0;
  return (
    `M ${x1} ${y1} L ${x4} ${y4} A ${rOuter} ${rOuter} 0 ${large} 1 ${x3} ${y3} L ${x2} ${y2} A ${rInner} ${rInner} 0 ${large} 0 ${x1} ${y1} Z`
  );
}
