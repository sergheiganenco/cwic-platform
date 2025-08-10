import type { RootState } from '@/store/store'
import { useSelector } from 'react-redux'

export function useRequests() {
  const requests = useSelector((s: RootState) => s.requests?.requests ?? [])
  return { requests, isLoading: false, error: null as unknown }
}
