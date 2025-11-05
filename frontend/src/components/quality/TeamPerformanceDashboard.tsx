import React from 'react';
import { Trophy, Star, TrendingUp, Award, Users, Zap, Target, Medal } from 'lucide-react';
import { motion } from 'framer-motion';

interface TeamMember {
  id: string;
  name: string;
  avatar?: string;
  issuesResolved: number;
  rulesCreated: number;
  scoreImprovement: number;
  rank: number;
}

interface Achievement {
  id: string;
  icon: string;
  title: string;
  description: string;
  earnedBy: number;
  total: number;
}

interface TeamPerformanceDashboardProps {
  teamMembers: TeamMember[];
  achievements: Achievement[];
  teamGoal?: {
    target: number;
    current: number;
    label: string;
  };
  period?: string;
}

export const TeamPerformanceDashboard: React.FC<TeamPerformanceDashboardProps> = ({
  teamMembers,
  achievements,
  teamGoal,
  period = 'This Week'
}) => {
  const topPerformers = teamMembers.sort((a, b) => a.rank - b.rank).slice(0, 5);

  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1: return 'bg-gradient-to-br from-yellow-400 to-yellow-600';
      case 2: return 'bg-gradient-to-br from-gray-400 to-gray-600';
      case 3: return 'bg-gradient-to-br from-orange-400 to-orange-600';
      default: return 'bg-gradient-to-br from-blue-400 to-blue-600';
    }
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1: return <Trophy className="w-5 h-5 text-white" />;
      case 2: return <Medal className="w-5 h-5 text-white" />;
      case 3: return <Award className="w-5 h-5 text-white" />;
      default: return <Star className="w-4 h-4 text-white" />;
    }
  };

  const getAchievementIcon = (iconName: string) => {
    const iconMap: { [key: string]: JSX.Element } = {
      'target': <Target className="w-6 h-6" />,
      'zap': <Zap className="w-6 h-6" />,
      'trophy': <Trophy className="w-6 h-6" />,
      'star': <Star className="w-6 h-6" />,
      'award': <Award className="w-6 h-6" />
    };
    return iconMap[iconName.toLowerCase()] || <Star className="w-6 h-6" />;
  };

  return (
    <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <div className="p-2 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg">
              <Users className="w-5 h-5 text-white" />
            </div>
            Team Performance
          </h2>
          <p className="text-sm text-gray-500 mt-1">{period}</p>
        </div>

        {/* Share Button */}
        <button className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors text-sm">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
          Share Report
        </button>
      </div>

      {/* Team Goal Progress */}
      {teamGoal && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-5 mb-6 border-2 border-green-200"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500 rounded-lg">
                <Target className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Team Goal</h3>
                <p className="text-sm text-gray-600">{teamGoal.label}</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-green-700">
                {teamGoal.current}/{teamGoal.target}
              </div>
              <div className="text-xs text-gray-500 uppercase tracking-wide mt-1">
                {Math.round((teamGoal.current / teamGoal.target) * 100)}% Complete
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-green-200 rounded-full h-4 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min((teamGoal.current / teamGoal.target) * 100, 100)}%` }}
              transition={{ duration: 1, delay: 0.2 }}
              className="h-full bg-gradient-to-r from-green-500 to-emerald-600 rounded-full flex items-center justify-end pr-2"
            >
              {teamGoal.current >= teamGoal.target && (
                <Trophy className="w-3 h-3 text-white" />
              )}
            </motion.div>
          </div>
        </motion.div>
      )}

      {/* Leaderboard */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-500" />
          Top Performers
        </h3>

        <div className="space-y-3">
          {topPerformers.map((member, index) => (
            <motion.div
              key={member.id}
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: index * 0.1 }}
              className="flex items-center gap-4 bg-gray-50 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              {/* Rank Badge */}
              <div className={`w-12 h-12 ${getRankColor(member.rank)} rounded-full flex items-center justify-center shadow-lg`}>
                {getRankIcon(member.rank)}
              </div>

              {/* Avatar */}
              <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white font-bold shadow-md">
                {member.avatar || member.name.substring(0, 2).toUpperCase()}
              </div>

              {/* Info */}
              <div className="flex-1">
                <div className="font-semibold text-gray-900 mb-1">{member.name}</div>
                <div className="flex gap-4 text-sm text-gray-600">
                  <span className="flex items-center gap-1">
                    <Zap className="w-4 h-4 text-green-500" />
                    {member.issuesResolved} resolved
                  </span>
                  <span className="flex items-center gap-1">
                    <Star className="w-4 h-4 text-blue-500" />
                    {member.rulesCreated} rules
                  </span>
                </div>
              </div>

              {/* Score Improvement */}
              <div className="text-right">
                <div className="flex items-center gap-1 text-green-600">
                  <TrendingUp className="w-4 h-4" />
                  <span className="text-lg font-bold">+{member.scoreImprovement}%</span>
                </div>
                <div className="text-xs text-gray-500">improvement</div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Achievements */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Award className="w-5 h-5 text-purple-500" />
          Team Achievements
        </h3>

        <div className="grid grid-cols-2 gap-4">
          {achievements.map((achievement, index) => (
            <motion.div
              key={achievement.id}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: index * 0.1 }}
              className={`rounded-lg p-4 border-2 ${
                achievement.earnedBy >= achievement.total
                  ? 'bg-gradient-to-br from-purple-50 to-pink-50 border-purple-300'
                  : 'bg-gray-50 border-gray-200'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${
                  achievement.earnedBy >= achievement.total
                    ? 'bg-purple-500 text-white'
                    : 'bg-gray-300 text-gray-600'
                }`}>
                  {getAchievementIcon(achievement.icon)}
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900 mb-1">{achievement.title}</h4>
                  <p className="text-xs text-gray-600 mb-2">{achievement.description}</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(achievement.earnedBy / achievement.total) * 100}%` }}
                        transition={{ duration: 0.5, delay: index * 0.1 + 0.3 }}
                        className={`h-full ${
                          achievement.earnedBy >= achievement.total
                            ? 'bg-purple-500'
                            : 'bg-blue-500'
                        }`}
                      />
                    </div>
                    <span className="text-xs font-semibold text-gray-600">
                      {achievement.earnedBy}/{achievement.total}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Call to Action */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-6 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4 border-2 border-blue-200"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500 rounded-lg">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-sm text-gray-700">
              <span className="font-semibold">Keep up the momentum!</span> Your team has improved data quality by an average of{' '}
              <span className="font-bold text-blue-700">
                {teamMembers.reduce((sum, m) => sum + m.scoreImprovement, 0) / teamMembers.length}%
              </span> this week.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
