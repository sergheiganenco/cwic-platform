import type { Asset } from '@/types/dataAssets'
import type { PayloadAction } from '@reduxjs/toolkit'
import { createSlice } from '@reduxjs/toolkit'

type DataAssetsState = {
  assets: Asset[]
}
const initialState: DataAssetsState = { assets: [] }

const dataAssetsSlice = createSlice({
  name: 'dataAssets',
  initialState,
  reducers: {
    setAssets(state, action: PayloadAction<Asset[]>) {
      state.assets = action.payload
    },
  },
})

export const { setAssets } = dataAssetsSlice.actions
export default dataAssetsSlice.reducer
