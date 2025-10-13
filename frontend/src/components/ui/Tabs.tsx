// Simple Tabs component
import React, { createContext, useContext, useState } from 'react';

interface TabsContextType {
  activeTab: string;
  setActiveTab: (value: string) => void;
}

const TabsContext = createContext<TabsContextType>({
  activeTab: '',
  setActiveTab: () => {}
});

export const Tabs: React.FC<{
  value: string;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
  className?: string;
}> = ({ value, onValueChange, children, className }) => {
  return (
    <TabsContext.Provider value={{ activeTab: value, setActiveTab: onValueChange }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
};

export const TabsList: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className }) => {
  return (
    <div className={`flex space-x-1 border-b ${className || ''}`}>
      {children}
    </div>
  );
};

export const TabsTrigger: React.FC<{
  value: string;
  children: React.ReactNode;
  className?: string;
}> = ({ value, children, className }) => {
  const { activeTab, setActiveTab } = useContext(TabsContext);
  const isActive = activeTab === value;

  return (
    <button
      onClick={() => setActiveTab(value)}
      className={`
        px-4 py-2 text-sm font-medium transition-colors
        ${isActive
          ? 'text-blue-600 border-b-2 border-blue-600'
          : 'text-gray-600 hover:text-gray-900'
        }
        ${className || ''}
      `}
    >
      {children}
    </button>
  );
};

export const TabsContent: React.FC<{
  value: string;
  children: React.ReactNode;
  className?: string;
}> = ({ value, children, className }) => {
  const { activeTab } = useContext(TabsContext);

  if (activeTab !== value) return null;

  return <div className={className}>{children}</div>;
};