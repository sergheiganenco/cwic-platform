import * as React from 'react'

export const Footer: React.FC = () => (
  <footer className="border-t border-gray-200 bg-white">
    <div className="mx-auto max-w-7xl px-6 py-4 text-xs text-gray-500 flex items-center justify-between">
      <span>© {new Date().getFullYear()} CWIC Platform</span>
      <span>v1.0.0</span>
    </div>
  </footer>
)
