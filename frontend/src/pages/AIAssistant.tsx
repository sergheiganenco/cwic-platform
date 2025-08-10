import { ChatInterface } from '@/components/features/ai-assistant/ChatInterface'
import { Card } from '@/components/ui/Card'
import React from 'react'

export const AIAssistant: React.FC = () => {
  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">AI Assistant</h1>
        <p className="text-gray-600">
          Ask me about field availability, data quality, pipeline management, or request creation.
          I can help you navigate your data platform and automate workflows.
        </p>
      </div>
      
      <Card className="h-[700px]">
        <ChatInterface />
      </Card>
    </div>
  )
}