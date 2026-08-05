"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

// Dynamically import Dashboard with SSR disabled to prevent Node.js build errors
const Dashboard = dynamic(() => import("@/components/dashboard/Dashboard"), {
  ssr: false,
  loading: () => (
    <div className="flex flex-col items-center justify-center h-screen w-screen bg-[#030712] text-indigo-400 gap-3 font-mono text-xs">
      <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
      <span>Loading MindForge Engine…</span>
    </div>
  ),
});

export default function Home() {
  return <Dashboard />;
}