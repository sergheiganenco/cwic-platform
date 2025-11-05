// Revolutionary Rules Page - Three Panel Layout
import React from 'react';

interface ThreePanelLayoutProps {
  left: React.ReactNode;
  center: React.ReactNode;
  right?: React.ReactNode;
  leftWidth?: string;
  rightWidth?: string;
  className?: string;
}

export const ThreePanelLayout: React.FC<ThreePanelLayoutProps> = ({
  left,
  center,
  right,
  leftWidth = '20%',
  rightWidth = '30%',
  className = ''
}) => {
  const centerWidth = right
    ? `calc(100% - ${leftWidth} - ${rightWidth})`
    : `calc(100% - ${leftWidth})`;

  return (
    <div className={`flex h-full w-full gap-4 ${className}`}>
      {/* Left Navigator Panel */}
      <div
        className="flex-shrink-0 overflow-y-auto border-r border-gray-200 pr-4"
        style={{ width: leftWidth }}
      >
        {left}
      </div>

      {/* Center Canvas */}
      <div
        className="flex-grow overflow-y-auto"
        style={{ width: centerWidth }}
      >
        {center}
      </div>

      {/* Right Inspector Panel (Optional) */}
      {right && (
        <div
          className="flex-shrink-0 overflow-y-auto border-l border-gray-200 pl-4"
          style={{ width: rightWidth }}
        >
          {right}
        </div>
      )}
    </div>
  );
};
