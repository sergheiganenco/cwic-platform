// Gamification Panel - Quality champion stats and badges
import React from 'react';
import { Trophy, Target, Zap, Shield, Award, TrendingUp, Flame } from 'lucide-react';
import { Card, CardContent } from '@components/ui/Card';
import { Badge } from '@components/ui/Badge';
import { Progress } from '@components/ui/Progress';
import type { QualityRule } from '@services/api/quality';

interface GamificationPanelProps {
  rules: QualityRule[];
}

export const GamificationPanel: React.FC<GamificationPanelProps> = ({ rules }) => {
  // Calculate stats
  const stats = {
    rulesCreated: rules.length,
    issuesPrevented: rules.reduce((sum, r) => sum + (r.last_result?.issues_found || 0), 0),
    autoFixesApplied: Math.floor(rules.length * 0.7), // Simulated
    streak: 23 // Days of quality monitoring
  };

  const badges = [
    { id: 'guardian', name: 'Guardian', icon: Shield, earned: stats.rulesCreated >= 10, requirement: '10 rules' },
    { id: 'detective', name: 'Detective', icon: Target, earned: stats.issuesPrevented >= 100, requirement: '100 issues found' },
    { id: 'speedster', name: 'Speedster', icon: Zap, earned: stats.streak >= 7, requirement: '7 day streak' },
    { id: 'master', name: 'Master', icon: Award, earned: stats.rulesCreated >= 50, requirement: '50 rules' }
  ];

  const earnedBadges = badges.filter(b => b.earned);
  const level = Math.floor(stats.rulesCreated / 10) + 1;
  const progressToNextLevel = ((stats.rulesCreated % 10) / 10) * 100;

  return (
    <Card className="bg-gradient-to-br from-purple-50 to-blue-50 border-purple-200">
      <CardContent className="p-4">
        {/* Level & Progress */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                <Trophy className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="text-sm font-bold text-gray-900">Level {level}</div>
                <div className="text-xs text-gray-600">Quality Champion</div>
              </div>
            </div>
          </div>
          <Progress value={progressToNextLevel} className="h-2" />
          <div className="text-xs text-gray-600 mt-1">
            {10 - (stats.rulesCreated % 10)} rules to level {level + 1}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-white rounded-lg p-3">
            <div className="text-lg font-bold text-purple-600">{stats.rulesCreated}</div>
            <div className="text-xs text-gray-600">Rules Created</div>
          </div>
          <div className="bg-white rounded-lg p-3">
            <div className="text-lg font-bold text-red-600">{stats.issuesPrevented.toLocaleString()}</div>
            <div className="text-xs text-gray-600">Issues Found</div>
          </div>
          <div className="bg-white rounded-lg p-3">
            <div className="text-lg font-bold text-green-600">{stats.autoFixesApplied}</div>
            <div className="text-xs text-gray-600">Auto-fixes</div>
          </div>
          <div className="bg-white rounded-lg p-3 flex items-center gap-2">
            <Flame className="w-4 h-4 text-orange-500" />
            <div>
              <div className="text-lg font-bold text-orange-600">{stats.streak}</div>
              <div className="text-xs text-gray-600">Day Streak</div>
            </div>
          </div>
        </div>

        {/* Badges */}
        <div>
          <div className="text-xs font-semibold text-gray-700 mb-2">Badges Earned</div>
          <div className="flex flex-wrap gap-2">
            {badges.map(badge => {
              const Icon = badge.icon;
              return (
                <div
                  key={badge.id}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs ${
                    badge.earned
                      ? 'bg-yellow-100 text-yellow-800 border border-yellow-300'
                      : 'bg-gray-100 text-gray-400 border border-gray-200 opacity-50'
                  }`}
                  title={badge.requirement}
                >
                  <Icon className="w-3 h-3" />
                  <span className="font-medium">{badge.name}</span>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
