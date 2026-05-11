import { redirect } from "next/navigation";

/** Prefer the /score split test; this route keeps old links working. */
export default function BossExactPage() {
  redirect("/score");
}
