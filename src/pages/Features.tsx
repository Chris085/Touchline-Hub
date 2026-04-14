import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Calendar, 
  Users, 
  Activity, 
  Award, 
  Shield, 
  Newspaper, 
  MessageSquare,
  FileText,
  BarChart3,
  Clock,
  MapPin,
  UserCheck,
  CheckCircle2,
  Zap,
  LayoutGrid,
  Plus,
  Settings,
  Bell,
  Search
} from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';

interface Feature {
  id: string;
  name: string;
  description: string;
  icon: any;
  path: string;
  color: string;
  coachOnly?: boolean;
}

interface FeatureGroup {
  title: string;
  description: string;
  features: Feature[];
}

export function Features() {
  const navigate = useNavigate();
  const { profile, isAdmin } = useAuth();
  const isCoach = profile?.role === 'coach' || isAdmin;

  const groups: FeatureGroup[] = [
    {
      title: "Match Day",
      description: "Everything you need for game day success",
      features: [
        {
          id: 'live',
          name: 'Live Match Controller',
          description: 'Track goals, subs, and match time in real-time.',
          icon: Activity,
          path: '/live',
          color: 'bg-green-500'
        },
        {
          id: 'schedule',
          name: 'Team Schedule',
          description: 'View upcoming matches and training sessions.',
          icon: Calendar,
          path: '/',
          color: 'bg-blue-500'
        },
        {
          id: 'add-schedule',
          name: 'Add Schedule Entry',
          description: 'Create new matches or training sessions.',
          icon: Plus,
          path: '/?add=true',
          color: 'bg-green-500',
          coachOnly: true
        },
        {
          id: 'motm',
          name: 'MOTM Voting',
          description: 'Parents vote for their Man of the Match.',
          icon: Award,
          path: '/motm',
          color: 'bg-yellow-500'
        }
      ]
    },
    {
      title: "Team Management",
      description: "Keep your squad organized and ready",
      features: [
        {
          id: 'squad',
          name: 'Squad Management',
          description: 'Manage player profiles, numbers, and positions.',
          icon: Users,
          path: '/squad',
          color: 'bg-indigo-500'
        },
        {
          id: 'attendance',
          name: 'Attendance Tracking',
          description: 'Track who shows up for training and matches.',
          icon: UserCheck,
          path: '/',
          color: 'bg-emerald-500',
          coachOnly: true
        },
        {
          id: 'admin',
          name: 'Team Settings',
          description: 'Configure team details and invite codes.',
          icon: Shield,
          path: '/admin',
          color: 'bg-slate-500',
          coachOnly: true
        }
      ]
    },
    {
      title: "Communication",
      description: "Stay connected with your team",
      features: [
        {
          id: 'chat',
          name: 'Team Chat',
          description: 'Real-time messaging for coaches and parents.',
          icon: MessageSquare,
          path: '/chat',
          color: 'bg-purple-500'
        },
        {
          id: 'news',
          name: 'News Feed',
          description: 'Share updates, photos, and announcements.',
          icon: Newspaper,
          path: '/news',
          color: 'bg-orange-500'
        }
      ]
    },
    {
      title: "Insights & Performance",
      description: "Analyze and improve your team's game",
      features: [
        {
          id: 'notes',
          name: 'Coach Notes',
          description: 'Record observations and session plans.',
          icon: FileText,
          path: '/notes',
          color: 'bg-pink-500',
          coachOnly: true
        },
        {
          id: 'stats',
          name: 'Team Stats',
          description: 'View performance data and player metrics.',
          icon: BarChart3,
          path: '/',
          color: 'bg-cyan-500'
        }
      ]
    }
  ];

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <div className="space-y-12 max-w-5xl mx-auto pb-12">
      <div className="text-center space-y-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/10 border border-green-500/20 rounded-full text-green-500 text-xs font-bold uppercase tracking-widest mb-2"
        >
          <LayoutGrid size={14} />
          Feature Directory
        </motion.div>
        <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight">
          The Touchline <span className="text-green-500">Hub</span>
        </h1>
        <p className="text-slate-400 text-lg max-w-2xl mx-auto">
          Explore all the tools designed to help you manage your youth football team like a pro.
        </p>
      </div>

      <motion.div 
        variants={container}
        initial="hidden"
        animate="show"
        className="space-y-16"
      >
        {groups.map((group, groupIdx) => (
          <section key={groupIdx} className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="h-px flex-1 bg-slate-800"></div>
              <div className="text-center">
                <h2 className="text-2xl font-black text-white">{group.title}</h2>
                <p className="text-sm text-slate-500">{group.description}</p>
              </div>
              <div className="h-px flex-1 bg-slate-800"></div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {group.features.map((feature) => {
                const Icon = feature.icon;
                const isDisabled = feature.coachOnly && !isCoach;

                return (
                  <motion.div
                    key={feature.id}
                    variants={item}
                    whileHover={!isDisabled ? { y: -5, scale: 1.02 } : {}}
                    whileTap={!isDisabled ? { scale: 0.98 } : {}}
                    onClick={() => !isDisabled && navigate(feature.path)}
                    className={`relative group p-6 rounded-3xl border transition-all cursor-pointer overflow-hidden ${
                      isDisabled 
                        ? 'bg-slate-900/50 border-slate-800/50 opacity-60 grayscale cursor-not-allowed' 
                        : 'bg-slate-900 border-slate-800 hover:border-slate-700 hover:shadow-2xl hover:shadow-slate-950'
                    }`}
                  >
                    {/* Background Glow */}
                    <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full blur-3xl opacity-0 group-hover:opacity-20 transition-opacity ${feature.color}`} />
                    
                    <div className="relative z-10 space-y-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border shadow-inner ${
                        isDisabled 
                          ? 'bg-slate-800 border-slate-700 text-slate-600' 
                          : `${feature.color}/10 border-${feature.color.split('-')[1]}-500/20 text-${feature.color.split('-')[1]}-500`
                      }`}>
                        <Icon size={24} />
                      </div>
                      
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-lg font-bold text-white">{feature.name}</h3>
                          {feature.coachOnly && (
                            <Shield size={12} className="text-slate-500" />
                          )}
                        </div>
                        <p className="text-sm text-slate-400 leading-relaxed">
                          {feature.description}
                        </p>
                      </div>

                      <div className={`flex items-center gap-2 text-xs font-bold uppercase tracking-widest transition-colors ${
                        isDisabled ? 'text-slate-600' : `text-${feature.color.split('-')[1]}-500`
                      }`}>
                        {isDisabled ? 'Coach Only' : 'Explore Feature →'}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </section>
        ))}
      </motion.div>

      {/* Quick Stats / Summary Footer */}
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 sm:p-12 text-center space-y-8 relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 via-transparent to-blue-500/5" />
        
        <div className="relative z-10 space-y-4">
          <h2 className="text-3xl font-black text-white">Ready to elevate your team?</h2>
          <p className="text-slate-400 max-w-xl mx-auto">
            The Touchline Hub is constantly evolving with new features built specifically for grassroots football.
          </p>
          <div className="flex flex-wrap justify-center gap-4 pt-4">
            <div className="flex items-center gap-2 px-4 py-2 bg-slate-950 rounded-xl border border-slate-800 text-sm text-slate-300">
              <Zap size={16} className="text-yellow-500" />
              Real-time Updates
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-slate-950 rounded-xl border border-slate-800 text-sm text-slate-300">
              <CheckCircle2 size={16} className="text-green-500" />
              Secure Data
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-slate-950 rounded-xl border border-slate-800 text-sm text-slate-300">
              <Users size={16} className="text-blue-500" />
              Team Focused
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
