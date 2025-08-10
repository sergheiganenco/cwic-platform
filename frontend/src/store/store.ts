import { configureStore } from '@reduxjs/toolkit'

import auth from './slices/authSlice'
import dataAssets from './slices/dataAssetsSlice'
import dataSources from './slices/dataSourcesSlice'
import notifications from './slices/notificationsSlice'
import pipelines from './slices/pipelinesSlice'
import quality from './slices/qualitySlice'
import requests from './slices/requestsSlice'
import ui from './slices/uiSlice'

export const store = configureStore({
  reducer: {
    auth,
    dataSources,
    dataAssets,
    quality,
    pipelines,
    requests,
    notifications,
    ui,
  },
  middleware: (gDM) => gDM({ serializableCheck: false, immutableCheck: true }),
  devTools: import.meta.env.DEV,
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
