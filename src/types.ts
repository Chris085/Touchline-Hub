
export type Role = 'coach' | 'parent' | 'player' | 'org_admin' | 'platform_admin';

export interface Organisation {
  id: string;
  name: string;
  type: 'team' | 'club';
  logoUrl?: string;
  subscriptionTier: 'free_team' | 'pro_team' | 'club';
  createdBy: string;
  createdAt: string;
  invitationCode?: string;
  settings?: {
    subTeamsEnabled?: boolean;
    defaultMatchDuration?: number;
  };
  ownerUserId: string;
  transferOwnershipCode?: string;
}

export interface Team {
  id: string;
  name: string;
  organisationId: string;
  code: string;
  coachId: string;
  // ... other existing fields
}
