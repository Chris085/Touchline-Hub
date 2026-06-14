
export type Role = 'coach' | 'parent' | 'player' | 'org_admin' | 'platform_admin';

export interface Organisation {
  id: string;
  name: string;
  type: 'team' | 'club';
  logoUrl?: string;
  subscriptionTier: 'free_team' | 'pro_team' | 'club';
  createdBy: string;
  createdAt: string;
}

export interface Team {
  id: string;
  name: string;
  organisationId: string;
  code: string;
  coachId: string;
  // ... other existing fields
}
