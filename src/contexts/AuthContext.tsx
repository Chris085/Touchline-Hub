import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User, 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  FacebookAuthProvider,
  updateProfile as updateFirebaseAuthProfile,
  signOut as firebaseSignOut,
  sendEmailVerification
} from 'firebase/auth';
import { doc, onSnapshot, setDoc, deleteDoc } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType, messaging, getToken, onMessage } from '../firebase';

export type Role = 'coach' | 'parent' | 'player' | null;

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: Role;
  teamId?: string;
  joinedTeams?: { teamId: string; role: Role; teamName: string }[];
  subscriptionStatus?: 'active' | 'inactive';
  trialStartDate?: string;
  trialEndDate?: string;
  trialDaysRemaining?: number;
  codeType?: 'full' | 'trial';
  stripeCustomerId?: string;
  fcmToken?: string;
  dashboardShortcuts?: string[];
  notificationPreferences?: {
    matchScheduled: boolean;
    matchUpdate: boolean;
    attendanceReminder: boolean;
    trainingReminder: boolean;
    liveMatchUpdates: boolean;
  };
  isReadOnly?: boolean | string;
  isVerified?: boolean;
  verificationToken?: string;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isSubscribed: boolean;
  selectedSeason: string | null;
  setSelectedSeason: (season: string | null) => void;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, name: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithFacebook: () => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  switchTeam: (teamId: string) => Promise<void>;
  deleteProfile: () => Promise<void>;
  isAdmin: boolean;
  emailVerified: boolean;
  reloadUser: () => Promise<void>;
  sendVerificationEmail: () => Promise<void>;
  isAppReadOnly: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [selectedSeason, setSelectedSeason] = useState<string | null>('all');
  const [emailVerified, setEmailVerified] = useState<boolean>(false);
  const [isCoachReadOnly, setIsCoachReadOnly] = useState<boolean>(false);
  const [isTeamReadOnly, setIsTeamReadOnly] = useState<boolean>(false);
  const [isCoachUnverified, setIsCoachUnverified] = useState<boolean>(false);

  const isSubscribed = !!(
    profile?.subscriptionStatus === 'active' || 
    user?.email === 'chrisjeal9@gmail.com' ||
    (profile?.trialEndDate && new Date(profile.trialEndDate) > new Date()) ||
    profile?.codeType === 'full'
  );

  const isAdmin = !!(
    user?.email === 'chrisjeal9@gmail.com' || 
    user?.uid === 'V45Buf6eA5ggg2JUFShJpj48y2y2'
  );
  
  const isEmailVerified = emailVerified || profile?.isVerified === true;

  const isTrialExpired = !!(
    profile?.role === 'coach' &&
    profile?.subscriptionStatus !== 'active' &&
    profile?.trialEndDate &&
    new Date(profile.trialEndDate) <= new Date() &&
    profile.email !== 'chrisjeal9@gmail.com'
  );

  const isAppReadOnly = !!(
    (profile?.role === 'coach' && (profile?.isReadOnly === 'true' || profile?.isReadOnly === true || isTrialExpired || !isEmailVerified)) ||
    (profile?.role && profile?.role !== 'coach' && (isCoachReadOnly || isCoachUnverified)) ||
    isTeamReadOnly
  );

  if (error) {
    throw error;
  }

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;
    let unsubscribeTeam: (() => void) | null = null;
    let unsubscribeCoach: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setEmailVerified(currentUser?.emailVerified || false);
      
      if (unsubscribeProfile) unsubscribeProfile();
      if (unsubscribeTeam) unsubscribeTeam();
      if (unsubscribeCoach) unsubscribeCoach();

      if (currentUser) {
        const userRef = doc(db, 'users', currentUser.uid);
        
        unsubscribeProfile = onSnapshot(userRef, async (docSnap) => {
          if (docSnap.exists()) {
            const userData = docSnap.data() as UserProfile;
            
            // If we have a teamId, listen to the team too for shared subscription
            if (userData.teamId) {
              if (unsubscribeTeam) unsubscribeTeam();
              
              const teamRef = doc(db, 'teams', userData.teamId);
              unsubscribeTeam = onSnapshot(teamRef, (teamSnap) => {
                let mergedProfile = { ...userData };
                
                if (teamSnap.exists()) {
                  const teamData = teamSnap.data();
                  setIsTeamReadOnly(teamData.isReadOnly === 'true' || teamData.isReadOnly === true);
                  
                  // If team has active subscription, all members are active
                  console.log(`[AuthContext] Team ${userData.teamId} data:`, teamData);
                  if (teamData.subscriptionStatus === 'active') {
                    console.log("[AuthContext] Team has active subscription, inheriting status.");
                    mergedProfile.subscriptionStatus = 'active';
                  } else {
                    console.log("[AuthContext] Team subscription not active. Using user's own status:", userData.subscriptionStatus);
                  }
                  
                  if (teamData.trialEndDate) {
                    const teamTrialEnd = new Date(teamData.trialEndDate);
                    const userTrialEnd = mergedProfile.trialEndDate ? new Date(mergedProfile.trialEndDate) : new Date(0);
                    
                    if (teamTrialEnd > userTrialEnd) {
                      console.log("[AuthContext] Inheriting team trial end date:", teamData.trialEndDate);
                      mergedProfile.trialEndDate = teamData.trialEndDate;
                    }
                  }
                  
                  if (teamData.seasonTag) {
                    setSelectedSeason(prev => prev === 'all' ? teamData.seasonTag : prev);
                  }

                  // Listen to coach profile to check if read-only is true or isVerified is false
                  if (teamData.coachId && userData.role !== 'coach') {
                    if (unsubscribeCoach) unsubscribeCoach();
                    unsubscribeCoach = onSnapshot(doc(db, 'users', teamData.coachId), (coachSnap) => {
                      if (coachSnap.exists()) {
                        const coachData = coachSnap.data();
                        setIsCoachReadOnly(coachData.isReadOnly === 'true' || coachData.isReadOnly === true);
                        setIsCoachUnverified(!coachData.isVerified);
                      } else {
                        setIsCoachReadOnly(false);
                        setIsCoachUnverified(false);
                      }
                    }, (err) => {
                      console.error("Error listening to coach profile:", err);
                      setIsCoachReadOnly(false);
                      setIsCoachUnverified(false);
                    });
                  } else {
                    if (unsubscribeCoach) {
                      unsubscribeCoach();
                      unsubscribeCoach = null;
                    }
                    setIsCoachReadOnly(false);
                    setIsCoachUnverified(false);
                  }
                } else {
                  setIsTeamReadOnly(false);
                }
                
                // Special check for admin email
                if (mergedProfile.email === 'chrisjeal9@gmail.com') {
                  mergedProfile.subscriptionStatus = 'active';
                }
                
                setProfile(mergedProfile);
                setLoading(false);
              }, (err) => {
                console.error("Error listening to team:", err);
                setProfile(userData);
                setLoading(false);
              });
            } else {
              // No team, just use user data
              if (unsubscribeCoach) {
                unsubscribeCoach();
                unsubscribeCoach = null;
              }
              setIsCoachReadOnly(false);
              setIsCoachUnverified(false);
              setIsTeamReadOnly(false);
              let finalProfile = { ...userData };
              if (finalProfile.email === 'chrisjeal9@gmail.com') {
                finalProfile.subscriptionStatus = 'active';
              }
              setProfile(finalProfile);
              setLoading(false);
            }
          } else {
            // Create a basic profile if it doesn't exist
            const newProfile: UserProfile = {
              uid: currentUser.uid,
              email: currentUser.email || '',
              displayName: currentUser.displayName || '',
              photoURL: currentUser.photoURL || '',
              role: null,
              subscriptionStatus: currentUser.email === 'chrisjeal9@gmail.com' ? 'active' : 'inactive'
            };
            try {
              await setDoc(userRef, newProfile);
              // Profile will be set by the onSnapshot listener
            } catch (createError) {
              handleFirestoreError(createError, OperationType.CREATE, `users/${currentUser.uid}`);
            }
          }
        }, (err) => {
          handleFirestoreError(err, OperationType.GET, `users/${currentUser.uid}`);
          setLoading(false);
        });
      } else {
        setProfile(null);
        setIsCoachReadOnly(false);
        setIsTeamReadOnly(false);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
      if (unsubscribeTeam) unsubscribeTeam();
      if (unsubscribeCoach) unsubscribeCoach();
    };
  }, []);

  // Handle FCM Token Registration
  useEffect(() => {
    if (!user || !messaging) return;

    const preferences = profile?.notificationPreferences || {
      matchScheduled: false,
      matchUpdate: false,
      attendanceReminder: false,
      trainingReminder: false,
      liveMatchUpdates: false
    };

    const isOptedIn = Object.values(preferences).some(val => val === true);

    if (!isOptedIn) return;

    const requestPermission = async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          // Get token
          const token = await getToken(messaging, {
            vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY
          });
          
          if (token) {
            console.log('[AuthContext] FCM Token:', token);
            // Save token to user profile if it's different
            if (profile && profile.fcmToken !== token) {
              await updateProfile({ fcmToken: token });
            }
          }
        }
      } catch (err) {
        console.error('[AuthContext] Error requesting notification permission:', err);
      }
    };

    requestPermission();

    // Listen for foreground messages
    const unsubscribeMessage = onMessage(messaging, (payload) => {
      console.log('[AuthContext] Foreground message received:', payload);
      // You could show a toast here if you want
    });

    return () => unsubscribeMessage();
  }, [user, messaging, profile?.uid]);

  const signInWithEmail = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error("Error signing in with email", error);
      throw error;
    }
  };

  const signUpWithEmail = async (email: string, password: string, name: string) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await updateFirebaseAuthProfile(userCredential.user, { displayName: name });
    } catch (error) {
      console.error("Error signing up with email", error);
      throw error;
    }
  };

  const signInWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Error signing in with Google", error);
      throw error;
    }
  };

  const signInWithFacebook = async () => {
    try {
      const provider = new FacebookAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Error signing in with Facebook", error);
      throw error;
    }
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!user) return;
    try {
      // Defensive rule: never allow setting/overriding isVerified and verificationToken from the app
      delete updates.isVerified;
      delete updates.verificationToken;

      const docRef = doc(db, 'users', user.uid);
      const currentProfile: any = profile ? { ...profile } : {
        uid: user.uid,
        email: user.email || '',
        displayName: user.displayName || '',
        photoURL: user.photoURL || '',
        role: null,
      };
      
      delete currentProfile.isVerified;
      delete currentProfile.verificationToken;

      const updatedProfile = { ...currentProfile, ...updates };
      
      delete updatedProfile.isVerified;
      delete updatedProfile.verificationToken;

      await setDoc(docRef, updatedProfile, { merge: true });
      setProfile({ ...(profile || {}), ...updates } as UserProfile);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const switchTeam = async (teamId: string) => {
    if (!user || !profile?.joinedTeams) return;
    const team = profile.joinedTeams.find(t => t.teamId === teamId);
    if (!team) return;

    try {
      const docRef = doc(db, 'users', user.uid);
      await setDoc(docRef, { 
        teamId: team.teamId, 
        role: team.role 
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const deleteProfile = async () => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid));
      setProfile(null);
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}`);
      } catch (e) {
        setError(e as Error);
      }
    }
  };

  const reloadUser = async () => {
    if (auth.currentUser) {
      await auth.currentUser.reload();
      const freshUser = auth.currentUser;
      setUser(freshUser);
      setEmailVerified(freshUser.emailVerified);
      
      if (freshUser.emailVerified) {
        try {
          const userRef = doc(db, 'users', freshUser.uid);
          const endDate = new Date();
          endDate.setMonth(endDate.getMonth() + 3);
          const trialEndDateStr = endDate.toISOString();
          
          await setDoc(userRef, {
            isReadOnly: false,
            trialEndDate: trialEndDateStr
          }, { merge: true });
          
          if (profile?.teamId) {
            const teamRef = doc(db, 'teams', profile.teamId);
            await setDoc(teamRef, {
              isReadOnly: false
            }, { merge: true });
          }
          console.log('[AuthContext] Successfully reloaded and unlocked verified user!');
        } catch (err) {
          console.error('[AuthContext] Error unlocking in reloadUser:', err);
        }
      }
    }
  };

  const sendVerificationEmail = async () => {
    if (auth.currentUser) {
      // 1. Try to send via our secure and reliable Resend custom email helper
      try {
        const response = await fetch('/api/send-verification-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            userId: auth.currentUser.uid,
            email: auth.currentUser.email
          })
        });

        if (response.ok) {
          console.log('[AuthContext] Verification email sent successfully via secure Resend helper');
          return;
        } else {
          const errData = await response.json().catch(() => ({ error: 'Unknown' }));
          console.warn('[AuthContext] Resend mail helper declined/not configured:', errData.error);
        }
      } catch (proxyErr) {
        console.warn('[AuthContext] Failed to connect to secure verification helper:', proxyErr);
      }

      // 2. Fall back to standard native client-only Firebase Verification if proxy failed
      try {
        console.log('[AuthContext] Falling back to standard Firebase verification email...');
        await sendEmailVerification(auth.currentUser);
      } catch (fbErr) {
        console.warn('Standard Firebase email verification failed or disabled:', fbErr);
        throw fbErr;
      }
    }
  };

  useEffect(() => {
    const checkAndUnlockVerifiedUser = async () => {
      if (user && isEmailVerified) {
        try {
          const userRef = doc(db, 'users', user.uid);
          
          const endDate = new Date();
          endDate.setMonth(endDate.getMonth() + 3);
          const trialEndDateStr = endDate.toISOString();
          
          let userNeedsUpdate = false;
          const userUpdates: Partial<UserProfile> = {};
          
          if (profile?.isReadOnly === true || profile?.isReadOnly === 'true') {
            userUpdates.isReadOnly = false;
            userNeedsUpdate = true;
          }
          
          if (!profile?.trialEndDate || profile?.isReadOnly === true || profile?.isReadOnly === 'true') {
            userUpdates.trialEndDate = trialEndDateStr;
            userNeedsUpdate = true;
          }
          
          if (userNeedsUpdate) {
            await setDoc(userRef, userUpdates, { merge: true });
            console.log('[AuthContext] Updated verified user isReadOnly and trialEndDate');
          }
          
          if (profile?.teamId && isAppReadOnly) {
            const teamRef = doc(db, 'teams', profile.teamId);
            await setDoc(teamRef, {
              isReadOnly: false
            }, { merge: true });
            console.log('[AuthContext] Set team isReadOnly to false');
          }
        } catch (error) {
          console.error('[AuthContext] Error unlocking verified user:', error);
        }
      }
    };
    
    checkAndUnlockVerifiedUser();
  }, [user, isEmailVerified, profile?.teamId, profile?.isReadOnly, isAppReadOnly]);

  return (
    <AuthContext.Provider value={{ 
      user, 
      profile, 
      loading, 
      isSubscribed, 
      isAdmin,
      selectedSeason,
      setSelectedSeason,
      signInWithEmail, 
      signUpWithEmail, 
      signInWithGoogle, 
      signInWithFacebook,
      signOut, 
      updateProfile, 
      switchTeam,
      deleteProfile,
      emailVerified: isEmailVerified,
      reloadUser,
      sendVerificationEmail,
      isAppReadOnly
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
