import React from "react";

export function Sidebar() {
  return (
    <aside className="bg-slate-900 text-white w-64 min-h-screen p-4">
      <div className="flex items-center gap-2 mb-8">
        <div className="bg-blue-600 p-2 rounded-lg" />
        <div>
          <h1 className="text-xl font-bold">CWIC</h1>
          <p className="text-xs text-slate-400">Workflow Intelligence</p>
        </div>
      </div>
      <nav className="space-y-2">
        {["Dashboard","AI Assistant","Data Catalog","Data Quality","Pipelines","Requests","Connections","Settings"]
          .map((item) => (
          <button key={item}
            className="w-full text-left px-3 py-2 rounded-lg text-slate-300 hover:bg-slate-800">
            {item}
          </button>
        ))}
      </nav>
    </aside>
  );
}

export function Header() {
  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      <h2 className="text-2xl font-semibold">CWIC</h2>
    </header>
  );
}
