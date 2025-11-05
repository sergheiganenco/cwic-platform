import { Card, CardContent } from '@/components/ui/Card'
import React from 'react'

export interface StatCardProps {
  icon: React.ElementType
  label: string
  value: number | string
  gradient: string
}

export function StatCard(props: StatCardProps) {
  const { icon: Icon, label, value, gradient } = props
  return (
    <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-white/95 backdrop-blur-xl hover:scale-105 cursor-pointer group">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`p-3 rounded-xl bg-gradient-to-br ${gradient} shadow-lg group-hover:shadow-xl transition-shadow`}>
            <Icon className="h-6 w-6 text-white" />
          </div>
          <div>
            <p className="text-xs text-gray-600 font-bold uppercase tracking-wider mb-0.5">{label}</p>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default StatCard

