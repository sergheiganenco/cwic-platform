import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice } from '@reduxjs/toolkit';

type Request = { id: string; status: 'open' | 'in_progress' | 'completed' | string }
type RequestsState = { requests: Request[] }
const initialState: RequestsState = { requests: [] }

const requestsSlice = createSlice({
  name: 'requests',
  initialState,
  reducers: {
    setRequests(state, action: PayloadAction<Request[]>) {
      state.requests = action.payload
    },
  },
})

export const { setRequests } = requestsSlice.actions
export default requestsSlice.reducer
