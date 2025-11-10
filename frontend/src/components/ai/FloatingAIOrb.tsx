import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot,
  Sparkles,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  X,
  Maximize2,
  Minimize2,
  MessageSquare,
  Search,
  Zap,
  BarChart3
} from 'lucide-react';
import { toast } from 'sonner';

interface AIInsight {
  id: string;
  type: 'suggestion' | 'warning' | 'success' | 'info';
  title: string;
  message: string;
  action?: () => void;
  actionLabel?: string;
  timestamp: Date;
}

interface FloatingAIOrbProps {
  insights?: AIInsight[];
  onOpenChat?: () => void;
  onOpenCommand?: () => void;
}

export const FloatingAIOrb: React.FC<FloatingAIOrbProps> = ({
  insights = [],
  onOpenChat,
  onOpenCommand
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [currentInsightIndex, setCurrentInsightIndex] = useState(0);
  const [showInsights, setShowInsights] = useState(false);
  const [pulseIntensity, setPulseIntensity] = useState(1);

  // Simulate real-time activity pulse
  useEffect(() => {
    const interval = setInterval(() => {
      setPulseIntensity(Math.random() * 0.3 + 0.7); // 0.7 to 1.0
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Rotate through insights
  useEffect(() => {
    if (insights.length > 1) {
      const interval = setInterval(() => {
        setCurrentInsightIndex((prev) => (prev + 1) % insights.length);
      }, 8000);
      return () => clearInterval(interval);
    }
  }, [insights.length]);

  const currentInsight = insights[currentInsightIndex];

  const getInsightIcon = (type: AIInsight['type']) => {
    switch (type) {
      case 'suggestion':
        return Sparkles;
      case 'warning':
        return AlertTriangle;
      case 'success':
        return CheckCircle;
      default:
        return TrendingUp;
    }
  };

  const getInsightColor = (type: AIInsight['type']) => {
    switch (type) {
      case 'suggestion':
        return 'from-blue-500 to-indigo-600';
      case 'warning':
        return 'from-orange-500 to-red-600';
      case 'success':
        return 'from-green-500 to-emerald-600';
      default:
        return 'from-purple-500 to-pink-600';
    }
  };

  const quickActions = [
    {
      icon: MessageSquare,
      label: 'Chat',
      color: 'from-blue-500 to-indigo-600',
      action: () => {
        onOpenChat?.();
        toast.success('Opening AI Chat...');
      }
    },
    {
      icon: Search,
      label: 'Search',
      color: 'from-purple-500 to-pink-600',
      action: () => {
        onOpenCommand?.();
        toast.info('Opening Command Palette...');
      }
    },
    {
      icon: BarChart3,
      label: 'Insights',
      color: 'from-green-500 to-emerald-600',
      action: () => {
        setShowInsights(!showInsights);
      }
    },
    {
      icon: Zap,
      label: 'Quick Fix',
      color: 'from-orange-500 to-red-600',
      action: () => {
        toast.success('Running automated diagnostics...');
      }
    }
  ];

  return (
    <>
      {/* Main Floating Orb */}
      <motion.div
        className="fixed bottom-8 right-8 z-[9999]"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      >
        {/* Expanded State */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 20 }}
              className="absolute bottom-full right-0 mb-4 w-80"
            >
              {/* Insights Card */}
              {showInsights && currentInsight && (
                <motion.div
                  key={currentInsight.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="mb-4 bg-white/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 p-4"
                >
                  <div className="flex items-start gap-3">
                    {(() => {
                      const IconComponent = getInsightIcon(currentInsight.type);
                      const colorClass = getInsightColor(currentInsight.type);
                      return (
                        <div className={`p-2 rounded-xl bg-gradient-to-br ${colorClass}`}>
                          <IconComponent className="w-5 h-5 text-white" />
                        </div>
                      );
                    })()}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-gray-900 text-sm">
                        {currentInsight.title}
                      </h4>
                      <p className="text-xs text-gray-600 mt-1">
                        {currentInsight.message}
                      </p>
                      {currentInsight.action && (
                        <button
                          onClick={currentInsight.action}
                          className="mt-2 text-xs font-medium text-blue-600 hover:text-blue-700"
                        >
                          {currentInsight.actionLabel || 'Take Action'}
                        </button>
                      )}
                    </div>
                    <button
                      onClick={() => setShowInsights(false)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Insight Indicators */}
                  {insights.length > 1 && (
                    <div className="flex justify-center gap-1 mt-3">
                      {insights.map((_, index) => (
                        <div
                          key={index}
                          className={`h-1 rounded-full transition-all ${
                            index === currentInsightIndex
                              ? 'w-6 bg-blue-600'
                              : 'w-1 bg-gray-300'
                          }`}
                        />
                      ))}
                    </div>
                  )}
                </motion.div>
              )}

              {/* Quick Actions Menu */}
              <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-900 text-sm">Quick Actions</h3>
                  <button
                    onClick={() => setIsExpanded(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <Minimize2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {quickActions.map((action, index) => {
                    const IconComponent = action.icon;
                    return (
                      <motion.button
                        key={action.label}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 0.1 }}
                        onClick={action.action}
                        className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-gray-50 transition-colors group"
                      >
                        <div className={`p-2 rounded-lg bg-gradient-to-br ${action.color} group-hover:scale-110 transition-transform`}>
                          <IconComponent className="w-4 h-4 text-white" />
                        </div>
                        <span className="text-xs font-medium text-gray-700">
                          {action.label}
                        </span>
                      </motion.button>
                    );
                  })}
                </div>

                {/* Status Indicator */}
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">AI Status</span>
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                      <span className="text-green-600 font-medium">Active</span>
                    </div>
                  </div>
                  {insights.length > 0 && (
                    <div className="flex items-center justify-between text-xs mt-1">
                      <span className="text-gray-500">Insights</span>
                      <span className="text-blue-600 font-medium">{insights.length} new</span>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* The Orb Itself */}
        <motion.button
          onClick={() => setIsExpanded(!isExpanded)}
          className="relative"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
        >
          {/* Outer Glow Ring */}
          <motion.div
            className="absolute inset-0 rounded-full blur-xl"
            animate={{
              opacity: [0.3, 0.6, 0.3],
              scale: [1, 1.2, 1]
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: 'easeInOut'
            }}
            style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
            }}
          />

          {/* Middle Pulse Ring */}
          <motion.div
            className="absolute -inset-2 rounded-full border-2 border-blue-500/20"
            animate={{
              scale: [1, 1.4, 1],
              opacity: [0.5, 0, 0.5]
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeOut'
            }}
          />

          {/* Main Orb */}
          <motion.div
            className="relative w-16 h-16 rounded-full shadow-2xl overflow-hidden"
            animate={{
              rotate: 360,
              scale: [1, pulseIntensity, 1]
            }}
            transition={{
              rotate: {
                duration: 20,
                repeat: Infinity,
                ease: 'linear'
              },
              scale: {
                duration: 2,
                repeat: Infinity,
                ease: 'easeInOut'
              }
            }}
          >
            {/* Animated Gradient Background */}
            <motion.div
              className="absolute inset-0"
              animate={{
                background: [
                  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                  'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                  'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
                  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                ]
              }}
              transition={{
                duration: 10,
                repeat: Infinity,
                ease: 'easeInOut'
              }}
            />

            {/* Shimmer Effect */}
            <motion.div
              className="absolute inset-0"
              style={{
                background: 'linear-gradient(45deg, transparent 30%, rgba(255,255,255,0.3) 50%, transparent 70%)',
                backgroundSize: '200% 200%'
              }}
              animate={{
                backgroundPosition: ['0% 0%', '100% 100%']
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: 'linear'
              }}
            />

            {/* Bot Icon */}
            <div className="absolute inset-0 flex items-center justify-center">
              <motion.div
                animate={{
                  scale: [1, 1.1, 1],
                  rotate: [0, 5, -5, 0]
                }}
                transition={{
                  duration: 4,
                  repeat: Infinity,
                  ease: 'easeInOut'
                }}
              >
                <Bot className="w-8 h-8 text-white drop-shadow-lg" />
              </motion.div>
            </div>

            {/* Particle Effects */}
            {[...Array(3)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-1 h-1 bg-white rounded-full"
                style={{
                  left: `${20 + i * 30}%`,
                  top: `${20 + i * 20}%`
                }}
                animate={{
                  opacity: [0, 1, 0],
                  scale: [0, 1.5, 0],
                  y: [-20, 20]
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  delay: i * 0.7,
                  ease: 'easeOut'
                }}
              />
            ))}
          </motion.div>

          {/* Notification Badge */}
          <AnimatePresence>
            {insights.length > 0 && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center shadow-lg"
              >
                <motion.span
                  className="text-white text-xs font-bold"
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                >
                  {insights.length}
                </motion.span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Expand Indicator */}
          {!isExpanded && (
            <motion.div
              className="absolute -bottom-8 left-1/2 transform -translate-x-1/2"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Maximize2 className="w-3 h-3 text-gray-400" />
            </motion.div>
          )}
        </motion.button>
      </motion.div>
    </>
  );
};

export default FloatingAIOrb;
