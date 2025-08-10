import type { RootState } from '@/store/store'
import { useSelector } from 'react-redux'

export function usePipelines() {
  const pipelines = useSelector((s: RootState) => s.pipelines?.pipelines ?? [])
  return { pipelines, isLoading: false, error: null as unknown }
}
