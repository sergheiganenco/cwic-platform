import React from 'react'
import { ArrowLeft, Home, Search } from 'lucide-react'

import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { useNavigate } from 'react-router-dom'

const NotFound: React.FC = () => {
  const navigate = useNavigate()

  return (
    <div className="min-h-[70vh] flex items-center justify-center bg-gradient-to-b from-white via-gray-50 to-white p-6">
      <Card className="max-w-2xl w-full shadow-lg border border-gray-100">
        <CardContent className="p-10 text-center space-y-6">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-blue-600">
            <Search className="h-8 w-8" />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold text-gray-900">We couldn't find that page</h1>
            <p className="text-sm text-gray-600">
              The link may be broken, or the page might have been removed. You can return to the dashboard or open the
              command palette to navigate elsewhere.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button leftIcon={<Home className="h-4 w-4" />} onClick={() => navigate('/dashboard')}>
              Go to dashboard
            </Button>
            <Button
              variant="outline"
              leftIcon={<ArrowLeft className="h-4 w-4" />}
              onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/dashboard'))}
            >
              Back to previous page
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export { NotFound }
export default NotFound
