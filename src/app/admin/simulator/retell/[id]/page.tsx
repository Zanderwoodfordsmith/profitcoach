"use client";

import { use } from "react";

import { RetellCall } from "@/components/simulator/RetellCall";

export default function AdminRetellCallPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <RetellCall id={id} />;
}
