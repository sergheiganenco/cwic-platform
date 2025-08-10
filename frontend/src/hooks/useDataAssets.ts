import type { RootState } from '@/store/store'
import { useSelector } from 'react-redux'

export function useDataAssets() {
  const assets = useSelector((s: RootState) => s.dataAssets?.assets ?? [])
  return { assets, isLoading: false, error: null as unknown }
}
