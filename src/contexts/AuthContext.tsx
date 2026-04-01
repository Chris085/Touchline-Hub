import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User, 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  updateProfile as updateFirebaseAuthProfile,
  signOut as firebaseSignOut 
} from 'firebase/auth';
import { doc, onSnapshot, setDoc, deleteDoc } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';

export type Role = 'coach' | 'parent' | 'player' | null;

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: Role;
  teamId?: string;
  subscriptionStatus?: 'active' | 'inactive';
  trialEndDate?: string;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, name: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  deleteProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  if (error) {
    throw error;
  }

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;
    let unsubscribeTeam: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (unsubscribeProfile) unsubscribeProfile();
      if (unsubscribeTeam) unsubscribeTeam();

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
                  
                  // Merge team subscription info if it's better than user's
                  if (teamData.subscriptionStatus === 'active') {
                    mergedProfile.subscriptionStatus = 'active';
                  }
                  if (teamData.trialEndDate) {
                    if (!mergedProfile.trialEndDate || new Date(teamData.trialEndDate) > new Date(mergedProfile.trialEndDate)) {
                      mergedProfile.trialEndDate = teamData.trialEndDate;
                    }
                  }
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
              subscriptionStatus: currentUser.email === 'chrisjeal9@gmail.com' ? 'active' : 'inactive',
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
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
      if (unsubscribeTeam) unsubscribeTeam();
    };
  }, []);

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

  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!user) return;
    try {
      const docRef = doc(db, 'users', user.uid);
      const currentProfile = profile || {
        uid: user.uid,
        email: user.email || '',
        displayName: user.displayName || '',
        photoURL: user.photoURL || '',
        role: null,
      };
      const updatedProfile = { ...currentProfile, ...updates };
      await setDoc(docRef, updatedProfile, { merge: true });
      setProfile(updatedProfile as UserProfile);
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

  return (
    <AuthContext.Provider value={{ user, profile, loading, signInWithEmail, signUpWithEmail, signInWithGoogle, signOut, updateProfile, deleteProfile }}>
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
