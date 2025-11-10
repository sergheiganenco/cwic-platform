import React, { createContext, useContext, useState, ReactNode } from 'react';

interface DataQualityFilters {
  selectedServer?: string;
  selectedDatabase?: string;
  selectedDatabases?: string[];
  dateRange?: {
    from: Date;
    to: Date;
  };
}

interface DataQualityContextType {
  filters: DataQualityFilters;
  setFilters: (filters: Partial<DataQualityFilters>) => void;
  resetFilters: () => void;
}

const DataQualityContext = createContext<DataQualityContextType | undefined>(undefined);

export const useDataQualityFilters = () => {
  const context = useContext(DataQualityContext);
  if (!context) {
    throw new Error('useDataQualityFilters must be used within DataQualityProvider');
  }
  return context;
};

interface DataQualityProviderProps {
  children: ReactNode;
}

export const DataQualityProvider: React.FC<DataQualityProviderProps> = ({ children }) => {
  const [filters, setFiltersState] = useState<DataQualityFilters>({});

  const setFilters = (newFilters: Partial<DataQualityFilters>) => {
    setFiltersState(prev => ({ ...prev, ...newFilters }));
  };

  const resetFilters = () => {
    setFiltersState({});
  };

  return (
    <DataQualityContext.Provider value={{ filters, setFilters, resetFilters }}>
      {children}
    </DataQualityContext.Provider>
  );
};
