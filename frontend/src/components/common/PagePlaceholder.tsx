import type { ReactNode } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Info } from 'lucide-react';

type PagePlaceholderProps = {
  title: string;
  description: string;
  tagline?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
};

export function PagePlaceholder({
  title,
  description,
  tagline,
  icon,
  actions,
  children,
}: PagePlaceholderProps) {
  const iconNode = icon ?? <Info className="h-5 w-5 text-blue-600" />;

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-sm font-medium text-blue-600">
          {iconNode}
          {tagline ? <span>{tagline}</span> : null}
        </div>
        <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
        <p className="max-w-3xl text-sm text-gray-600">{description}</p>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base text-gray-900">What to expect</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-gray-600">
          <p>We are building this surface. In the meantime, track updates in the release notes or reach out to the platform team for early access.</p>
          {children}
        </CardContent>
      </Card>
    </section>
  );
}
