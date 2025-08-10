import { Badge } from '@components/ui/Badge'
import { Button } from '@components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/Card'
import { Input } from '@components/ui/Input'
import { Select } from '@components/ui/Select'
import * as React from 'react'

export const Settings: React.FC = () => {
  // example local state; wire to your services/store as needed
  const [profile, setProfile] = React.useState({ name: '', email: '' })
  const [theme, setTheme] = React.useState<'system' | 'light' | 'dark'>('system')
  const [notif, setNotif] = React.useState(true)

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Profile</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="Name"
            value={profile.name}
            onChange={(e) => setProfile(p => ({ ...p, name: e.target.value }))}
          />
          <Input
            placeholder="Email"
            value={profile.email}
            onChange={(e) => setProfile(p => ({ ...p, email: e.target.value }))}
          />
          <div className="flex justify-end">
            <Button onClick={() => console.log('Save profile', profile)}>Save</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Appearance</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Select
            label="Theme"
            value={theme}
            onChange={(e) => setTheme(e.target.value as typeof theme)}
            options={[
              { label: 'System', value: 'system' },
              { label: 'Light', value: 'light' },
              { label: 'Dark', value: 'dark' },
            ]}
          />
          <div className="flex items-end">
            <Badge tone="neutral">Current: {theme}</Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Notifications</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={notif}
              onChange={(e) => setNotif(e.target.checked)}
              className="h-4 w-4"
            />
            Enable email notifications
          </label>
          <div className="flex justify-end">
            <Button variant="secondary" onClick={() => console.log('Save notifications', notif)}>
              Save
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default Settings
