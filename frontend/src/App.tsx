import { Layout } from '@/components/layout'
import { AIAssistant } from '@/pages/AIAssistant'
import { Connections } from '@/pages/Connections'
import { Dashboard } from '@/pages/Dashboard'
import { DataCatalog } from '@/pages/DataCatalog'
import { DataLineage } from '@/pages/DataLineage'
import { DataQuality } from '@/pages/DataQuality'
import { Governance } from '@/pages/Governance'
import { Monitoring } from '@/pages/Monitoring'
import { Pipelines } from '@/pages/Pipelines'
import { Requests } from '@/pages/Requests'
import { Settings } from '@/pages/Settings'
import { Navigate, Route, Routes } from 'react-router-dom'

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/ai-assistant" element={<AIAssistant />} />
        <Route path="/data-catalog" element={<DataCatalog />} />
        <Route path="/data-quality" element={<DataQuality />} />
        <Route path="/data-lineage" element={<DataLineage />} />
        <Route path="/pipelines" element={<Pipelines />} />
        <Route path="/requests" element={<Requests />} />
        <Route path="/connections" element={<Connections />} />
        <Route path="/governance" element={<Governance />} />
        <Route path="/monitoring" element={<Monitoring />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Layout>
  )
}
