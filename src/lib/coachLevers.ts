/**
 * Coach levers: Profit levers turned round for a coach. Four rates take
 * messages sent down to clients won, and because they multiply, small moves
 * on each cut the messages one client takes. Pure maths, so the page and its
 * tests share it.
 */

export type CoachLeverKey = "interest" | "book" | "fit" | "close";

export type CoachLevers = Record<CoachLeverKey, number>;

export type CoachLeverDef = {
  key: CoachLeverKey;
  label: string;
  /** One plain line on what it counts. */
  ask: string;
  /** Highest the drag goes, as a share. */
  max: number;
  step: number;
};

export const COACH_LEVERS: CoachLeverDef[] = [
  { key: "interest", label: "Say yes", ask: "Messages that get an interested reply", max: 0.05, step: 0.001 },
  { key: "book", label: "Book a call", ask: "Interested owners who book", max: 1, step: 0.01 },
  { key: "fit", label: "Good fit", ask: "Calls with someone you can help", max: 1, step: 0.01 },
  { key: "close", label: "Close", ask: "Good fits who become clients", max: 1, step: 0.01 },
];

/** Today: 10 interested, 5 book, 4 fit, 1 client. */
export const TODAY: CoachLevers = { interest: 0.01, book: 0.5, fit: 0.8, close: 0.25 };

/** With the new scripts: 10 interested, 8 book, 8 fit, 4 clients, and more yeses. */
export const WITH_SCRIPTS: CoachLevers = { interest: 0.025, book: 0.8, fit: 1, close: 0.5 };

/** Messages to clients: all four rates multiplied. */
export function clientsPerMessage(levers: CoachLevers): number {
  return levers.interest * levers.book * levers.fit * levers.close;
}

/** Messages one client takes. Null when a rate is 0. */
export function messagesPerClient(levers: CoachLevers): number | null {
  const rate = clientsPerMessage(levers);
  return rate > 0 ? 1 / rate : null;
}

/** What `messages` turn into at each step. */
export function funnelOf(levers: CoachLevers, messages: number) {
  const interested = messages * levers.interest;
  const calls = interested * levers.book;
  const fits = calls * levers.fit;
  return { messages, interested, calls, fits, clients: fits * levers.close };
}

/** 1,000 or 2.5: whole numbers get commas, small ones keep one decimal. */
export function formatCount(value: number): string {
  const rounded = value >= 100 ? Math.round(value) : Math.round(value * 10) / 10;
  return rounded.toLocaleString("en-GB");
}

export function formatRate(value: number): string {
  return `${Math.round(value * 1000) / 10}%`;
}
