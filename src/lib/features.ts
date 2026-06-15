import { 
  Calendar, 
  Users, 
  Activity, 
  Award, 
  Shield, 
  FileText,
  BarChart3,
  UserCheck,
  Plus,
  Dumbbell
} from 'lucide-react';

export interface Feature {
  id: string;
  name: string;
  description: string;
  icon: any;
  path: string;
  color: string;
  coachOnly?: boolean;
}

export interface FeatureGroup {
  title: string;
  description: string;
  features: Feature[];
}

export const FEATURE_GROUPS: FeatureGroup[] = [
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
        id: 'training',
        name: 'Training Library',
        description: 'Manage and create training sessions and drills.',
        icon: Dumbbell,
        path: '/training',
        color: 'bg-emerald-500',
        coachOnly: true
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
        path: '/stats',
        color: 'bg-cyan-500'
      }
    ]
  }
];

export const ALL_FEATURES = FEATURE_GROUPS.flatMap(g => g.features);
