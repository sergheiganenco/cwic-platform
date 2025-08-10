import { createSlice } from '@reduxjs/toolkit'
const authSlice = createSlice({ name: 'auth', initialState: { user: null, token: null }, reducers: {} })
export default authSlice.reducer
