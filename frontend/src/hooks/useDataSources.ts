import type { RootState } from '@/store/store'
import type { DataSource } from '@/types/dataSources'
import { useSelector } from 'react-redux'

export function useDataSources(): {
  sources: DataSource[]
  isLoading: boolean
  error: unknown
} {
  const sources = useSelector((s: RootState) => s.dataSources?.sources ?? [])
  return { sources, isLoading: false, error: null }
}
