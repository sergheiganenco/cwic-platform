// src/utils/filterHelpers.ts - Corrected version that works with your existing types
import {
    AssetFilters,
    isValidAssetType,
    isValidClassification,
    isValidQuality,
    isValidSortBy,
    isValidSortOrder
} from '@/types/dataAssets';

export const sanitizeFilterValue = (value: unknown): string | undefined => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  return undefined;
};

export const parseNumberFilter = (value: unknown): number | undefined => {
  if (typeof value === 'string') {
    const parsed = parseInt(value, 10);
    return !isNaN(parsed) && parsed > 0 ? parsed : undefined;
  }
  if (typeof value === 'number' && value > 0) {
    return value;
  }
  return undefined;
};

export const parseTagsFilter = (value: unknown): string[] | undefined => {
  if (typeof value === 'string') {
    const tags = value.split(',')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0);
    return tags.length > 0 ? tags : undefined;
  }
  if (Array.isArray(value)) {
    const tags = value
      .filter(item => typeof item === 'string')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0);
    return tags.length > 0 ? tags : undefined;
  }
  return undefined;
};

// Enhanced date validation
export const parseDateRangeFilter = (value: unknown): { start: string; end: string } | undefined => {
  if (!value) return undefined;

  // Handle string (JSON) input
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && 'start' in parsed && 'end' in parsed) {
        const start = sanitizeFilterValue(parsed.start);
        const end = sanitizeFilterValue(parsed.end);
        if (start && end) {
          // Basic date format validation
          const startDate = new Date(start);
          const endDate = new Date(end);
          if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime()) && startDate <= endDate) {
            return { start, end };
          }
        }
      }
    } catch {
      return undefined;
    }
  }

  // Handle object input
  if (typeof value === 'object' && value !== null && 'start' in value && 'end' in value) {
    const start = sanitizeFilterValue((value as any).start);
    const end = sanitizeFilterValue((value as any).end);
    if (start && end) {
      const startDate = new Date(start);
      const endDate = new Date(end);
      if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime()) && startDate <= endDate) {
        return { start, end };
      }
    }
  }

  return undefined;
};

// Helper function to validate entire filter object using your existing type guards
export const validateFilters = (filters: Partial<AssetFilters>): AssetFilters => {
  const validated: AssetFilters = {};

  // Validate and set page
  if (filters.page !== undefined) {
    const page = parseNumberFilter(filters.page);
    if (page) validated.page = page;
  }

  // Validate and set limit with reasonable bounds
  if (filters.limit !== undefined) {
    const limit = parseNumberFilter(filters.limit);
    if (limit && limit <= 1000) validated.limit = limit;
  }

  // Validate basic string fields
  validated.search = sanitizeFilterValue(filters.search);
  validated.owner = sanitizeFilterValue(filters.owner);
  validated.dataSourceId = sanitizeFilterValue(filters.dataSourceId);

  // Validate enum fields using your existing type guards
  if (filters.type !== undefined) {
    const type = sanitizeFilterValue(filters.type);
    if (isValidAssetType(type)) {
      validated.type = type;
    }
  }

  if (filters.quality !== undefined) {
    const quality = sanitizeFilterValue(filters.quality);
    if (isValidQuality(quality)) {
      validated.quality = quality;
    }
  }

  if (filters.classification !== undefined) {
    const classification = sanitizeFilterValue(filters.classification);
    if (isValidClassification(classification)) {
      validated.classification = classification;
    }
  }

  if (filters.sortBy !== undefined) {
    const sortBy = sanitizeFilterValue(filters.sortBy);
    if (isValidSortBy(sortBy)) {
      validated.sortBy = sortBy;
    }
  }

  if (filters.sortOrder !== undefined) {
    const sortOrder = sanitizeFilterValue(filters.sortOrder);
    if (isValidSortOrder(sortOrder)) {
      validated.sortOrder = sortOrder;
    }
  }

  // Validate tags
  if (filters.tags !== undefined) {
    const tags = parseTagsFilter(filters.tags);
    if (tags) validated.tags = tags;
  }

  // Validate date range
  if (filters.dateRange !== undefined) {
    const dateRange = parseDateRangeFilter(filters.dateRange);
    if (dateRange) validated.dateRange = dateRange;
  }

  return validated;
};

// Additional helper functions for URL handling
export const serializeFiltersToUrl = (filters: AssetFilters): URLSearchParams => {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }

    switch (key) {
      case 'page':
      case 'limit': {
        if (typeof value === 'number' && value > 0) {
          params.set(key, value.toString());
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
          params.set(key, value.trim());
        }
        break;
      }
      
      case 'tags': {
        if (Array.isArray(value) && value.length > 0) {
          const validTags = value.filter(tag => 
            typeof tag === 'string' && tag.trim() !== ''
          );
          if (validTags.length > 0) {
            params.set(key, validTags.join(','));
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
            typeof value.end === 'string') {
          try {
            params.set(key, JSON.stringify({
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

  return params;
};

export const deserializeFiltersFromUrl = (searchParams: URLSearchParams): AssetFilters => {
  const filters: AssetFilters = {};

  for (const [key, value] of searchParams.entries()) {
    if (!value || value.trim() === '') {
      continue;
    }

    switch (key) {
      case 'page':
      case 'limit': {
        const numericValue = parseNumberFilter(value);
        if (numericValue) {
          filters[key] = numericValue;
        }
        break;
      }

      case 'search':
      case 'owner':
      case 'dataSourceId': {
        const stringValue = sanitizeFilterValue(value);
        if (stringValue) {
          filters[key] = stringValue;
        }
        break;
      }

      case 'type': {
        const type = sanitizeFilterValue(value);
        if (isValidAssetType(type)) {
          filters.type = type;
        }
        break;
      }

      case 'quality': {
        const quality = sanitizeFilterValue(value);
        if (isValidQuality(quality)) {
          filters.quality = quality;
        }
        break;
      }

      case 'classification': {
        const classification = sanitizeFilterValue(value);
        if (isValidClassification(classification)) {
          filters.classification = classification;
        }
        break;
      }

      case 'sortBy': {
        const sortBy = sanitizeFilterValue(value);
        if (isValidSortBy(sortBy)) {
          filters.sortBy = sortBy;
        }
        break;
      }

      case 'sortOrder': {
        const sortOrder = sanitizeFilterValue(value);
        if (isValidSortOrder(sortOrder)) {
          filters.sortOrder = sortOrder;
        }
        break;
      }

      case 'tags': {
        const tags = parseTagsFilter(value);
        if (tags) {
          filters.tags = tags;
        }
        break;
      }

      case 'dateRange': {
        const dateRange = parseDateRangeFilter(value);
        if (dateRange) {
          filters.dateRange = dateRange;
        }
        break;
      }
    }
  }

  return filters;
};

// Helper to merge filters while maintaining type safety
export const mergeFilters = (baseFilters: AssetFilters, newFilters: Partial<AssetFilters>): AssetFilters => {
  const merged = { ...baseFilters, ...newFilters };
  return validateFilters(merged);
};

// Helper to check if filters are "empty" (only default values)
export const hasActiveFilters = (filters: AssetFilters, defaultFilters: AssetFilters = {}): boolean => {
  return Object.entries(filters).some(([key, value]) => {
    // Skip if value is undefined/null/empty
    if (value === undefined || value === null || value === '') return false;
    if (Array.isArray(value) && value.length === 0) return false;
    
    // Skip if it matches the default value
    const defaultValue = defaultFilters[key as keyof AssetFilters];
    if (value === defaultValue) return false;
    
    // Common defaults to ignore
    if (key === 'page' && value === 1) return false;
    if (key === 'limit' && value === 20) return false;
    if (key === 'sortBy' && value === 'updatedAt') return false;
    if (key === 'sortOrder' && value === 'desc') return false;
    
    return true;
  });
};

// Helper to get human-readable filter summary
export const getFilterSummary = (filters: AssetFilters): string[] => {
  const summary: string[] = [];

  if (filters.search) {
    summary.push(`Search: "${filters.search}"`);
  }
  if (filters.type) {
    summary.push(`Type: ${filters.type}`);
  }
  if (filters.quality) {
    summary.push(`Quality: ${filters.quality}`);
  }
  if (filters.classification) {
    summary.push(`Classification: ${filters.classification}`);
  }
  if (filters.owner) {
    summary.push(`Owner: ${filters.owner}`);
  }
  if (filters.dataSourceId) {
    summary.push(`Data Source: ${filters.dataSourceId}`);
  }
  if (filters.tags && filters.tags.length > 0) {
    summary.push(`Tags: ${filters.tags.join(', ')}`);
  }
  if (filters.dateRange) {
    summary.push(`Date Range: ${filters.dateRange.start} to ${filters.dateRange.end}`);
  }

  return summary;
};

// Helper to clear specific filter fields
export const clearFilterField = (filters: AssetFilters, field: keyof AssetFilters): AssetFilters => {
  const updated = { ...filters };
  delete updated[field];
  return updated;
};

// Helper to reset filters to defaults
export const resetFilters = (defaultFilters: AssetFilters = {}): AssetFilters => {
  return {
    page: 1,
    limit: 20,
    sortBy: 'updatedAt',
    sortOrder: 'desc',
    ...defaultFilters
  };
};