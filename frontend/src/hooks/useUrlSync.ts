// src/hooks/useUrlSync.ts
import {
    AssetFilters,
    isValidAssetType,
    isValidClassification,
    isValidQuality,
    isValidSortBy,
    isValidSortOrder
} from '@/types/dataAssets';
import { useCallback, useMemo } from 'react';

interface UseUrlSyncOptions {
  defaultFilters: AssetFilters;
  searchParams: URLSearchParams;
  setSearchParams: (params: URLSearchParams) => void;
}

export const useUrlSync = ({ defaultFilters, searchParams, setSearchParams }: UseUrlSyncOptions) => {
  const filters = useMemo<AssetFilters>(() => {
    const urlFilters: AssetFilters = { ...defaultFilters };
    
    for (const [key, value] of searchParams.entries()) {
      if (!value || value.trim() === '') {
        continue;
      }

      switch (key) {
        case 'page':
        case 'limit': {
          const numericValue = parseInt(value, 10);
          if (!isNaN(numericValue) && numericValue > 0) {
            urlFilters[key] = numericValue;
          }
          break;
        }
        
        case 'search':
        case 'owner':
        case 'dataSourceId': {
          const trimmedValue = value.trim();
          if (trimmedValue.length > 0) {
            urlFilters[key] = trimmedValue;
          }
          break;
        }
        
        case 'type': {
          if (isValidAssetType(value.trim())) {
            urlFilters.type = value.trim() as AssetFilters['type'];
          }
          break;
        }
        
        case 'quality': {
          if (isValidQuality(value.trim())) {
            urlFilters.quality = value.trim() as AssetFilters['quality'];
          }
          break;
        }
        
        case 'classification': {
          if (isValidClassification(value.trim())) {
            urlFilters.classification = value.trim() as AssetFilters['classification'];
          }
          break;
        }
        
        case 'sortBy': {
          if (isValidSortBy(value.trim())) {
            urlFilters.sortBy = value.trim() as AssetFilters['sortBy'];
          }
          break;
        }
        
        case 'sortOrder': {
          if (isValidSortOrder(value.trim())) {
            urlFilters.sortOrder = value.trim() as AssetFilters['sortOrder'];
          }
          break;
        }
        
        case 'tags': {
          const tags = value.split(',')
            .map(tag => tag.trim())
            .filter(tag => tag.length > 0);
          if (tags.length > 0) {
            urlFilters.tags = tags;
          }
          break;
        }
        
        case 'dateRange': {
          try {
            const dateRange = JSON.parse(value);
            if (dateRange && 
                typeof dateRange === 'object' && 
                typeof dateRange.start === 'string' && 
                typeof dateRange.end === 'string' &&
                dateRange.start.trim() !== '' &&
                dateRange.end.trim() !== '') {
              urlFilters.dateRange = {
                start: dateRange.start.trim(),
                end: dateRange.end.trim()
              };
            }
          } catch {
            console.warn(`Invalid dateRange format in URL: ${value}`);
          }
          break;
        }
      }
    }
    
    return urlFilters;
  }, [searchParams, defaultFilters]);

  const updateFilters = useCallback((newFilters: Partial<AssetFilters>) => {
    const updatedFilters = { ...filters, ...newFilters };
    const newParams = new URLSearchParams();

    Object.entries(updatedFilters).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') {
        return;
      }

      switch (key) {
        case 'page':
        case 'limit': {
          if (typeof value === 'number' && value > 0) {
            newParams.set(key, value.toString());
          }
          break;
        }
        
        case 'search':
        case 'type':
        case 'owner':
        case 'quality':
        case 'classification':
        case 'dataSourceId':
        case 'sortBy':
        case 'sortOrder': {
          if (typeof value === 'string' && value.trim() !== '') {
            newParams.set(key, value.trim());
          }
          break;
        }
        
        case 'tags': {
          if (Array.isArray(value) && value.length > 0) {
            const validTags = value.filter(tag => 
              typeof tag === 'string' && tag.trim() !== ''
            );
            if (validTags.length > 0) {
              newParams.set(key, validTags.join(','));
            }
          }
          break;
        }
        
        case 'dateRange': {
          if (value && 
              typeof value === 'object' && 
              'start' in value && 
              'end' in value &&
              typeof value.start === 'string' &&
              typeof value.end === 'string' &&
              value.start.trim() !== '' &&
              value.end.trim() !== '') {
            try {
              newParams.set(key, JSON.stringify({
                start: value.start.trim(),
                end: value.end.trim()
              }));
            } catch (error) {
              console.error('Failed to serialize dateRange:', error);
            }
          }
          break;
        }
      }
    });

    setSearchParams(newParams);
  }, [filters, setSearchParams]);

  return { filters, updateFilters };
};