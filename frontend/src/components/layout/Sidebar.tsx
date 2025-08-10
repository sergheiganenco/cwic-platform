import { ReactNode } from "react";
export function Sidebar(){ return (
  <aside className="bg-slate-900 text-white w-64 min-h-screen p-4">
    <div className="font-bold text-xl mb-6">CWIC</div>
    <nav className="space-y-2">
      <a className="block hover:bg-slate-800 rounded px-3 py-2" href="/">Dashboard</a>
      <a className="block hover:bg-slate-800 rounded px-3 py-2" href="/ai">AI Assistant</a>
      <a className="block hover:bg-slate-800 rounded px-3 py-2" href="/pipelines">Pipelines</a>
    </nav>
  </aside>
)}