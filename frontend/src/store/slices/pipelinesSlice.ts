import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice } from '@reduxjs/toolkit';

type Pipeline = { id: string; status: 'running' | 'failed' | 'succeeded' | 'paused' | 'idle' }
type PipelinesState = { pipelines: Pipeline[] }
const initialState: PipelinesState = { pipelines: [] }

const pipelinesSlice = createSlice({
  name: 'pipelines',
  initialState,
  reducers: {
    setPipelines(state, action: PayloadAction<Pipeline[]>) {
      state.pipelines = action.payload
    },
  },
})

export const { setPipelines } = pipelinesSlice.actions
export default pipelinesSlice.reducer
