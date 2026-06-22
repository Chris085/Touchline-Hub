import React, { createContext, useContext, useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthContext';

export type SubscriptionStatus = 'trial' | 'active' | 'expired' | 'cancelled';

export interface SubscriptionData {
  userId: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  status: SubscriptionStatus;
  plan?: string;
  trialStartDate?: string;
  trialEndDate?: string;
  currentPeriodEnd?: string;
  createdAt?: string;
  updatedAt?: string;
  trialDaysRemaining?: number;
}

interface SubscriptionContextType {
  subscription: SubscriptionData | null;
  loading: boolean;
  status: SubscriptionStatus | null;
  daysRemaining: number;
  isTrial: () => boolean;
  isActive: () => boolean;
  isExpired: () => boolean;
  startTrial: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { user, profile } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);

  // Load subscription details
  useEffect(() => {
    if (!user) {
      setSubscription(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const subRef = doc(db, 'subscriptions', user.uid);
    const unsubscribe = onSnapshot(subRef, async (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        let subData: SubscriptionData = {
          userId: user.uid,
          stripeCustomerId: data.stripeCustomerId || '',
          stripeSubscriptionId: data.stripeSubscriptionId || '',
          status: data.status || 'trial',
          plan: data.plan || '',
          trialStartDate: data.trialStartDate || '',
          trialEndDate: data.trialEndDate || '',
          currentPeriodEnd: data.currentPeriodEnd || '',
          createdAt: data.createdAt || '',
          updatedAt: data.updatedAt || '',
          trialDaysRemaining: data.trialDaysRemaining ?? 30
        };

        // Determine status based on current date
        let updatedStatus = subData.status;
        const now = new Date();

        // Admin override
        if (user.email === 'chrisjeal9@gmail.com') {
          updatedStatus = 'active';
        } else if (subData.status === 'active') {
          updatedStatus = 'active';
        } else if (subData.trialEndDate) {
          const endDate = new Date(subData.trialEndDate);
          if (now < endDate) {
            updatedStatus = 'trial';
          } else {
            updatedStatus = 'expired';
          }
        } else {
          updatedStatus = 'trial'; // default fallback for coach
        }

        // Calculate trialDaysRemaining dynamically
        let daysLeft = 0;
        if (subData.trialEndDate) {
          const endDate = new Date(subData.trialEndDate);
          daysLeft = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
        }

        subData.status = updatedStatus;
        subData.trialDaysRemaining = daysLeft;

        // Sync back to db if status or days mismatch
        if (data.status !== updatedStatus || data.trialDaysRemaining !== daysLeft) {
          try {
            await updateDoc(subRef, {
              status: updatedStatus,
              trialDaysRemaining: daysLeft,
              updatedAt: new Date().toISOString()
            });
            // Update user profile status as well to match
            const userRef = doc(db, 'users', user.uid);
            await updateDoc(userRef, {
              subscriptionStatus: updatedStatus === 'active' ? 'active' : 'inactive',
              trialEndDate: subData.trialEndDate || null
            });
          } catch (err) {
            console.error("Error auto-updating subscription status in Firestore:", err);
          }
        }

        setSubscription(subData);
      } else {
        // If profile exists and is coach, but has no subscription document, let us auto-init
        if (profile?.role === 'coach') {
          try {
            const now = new Date();
            const trialStart = now.toISOString();
            const trialEnd = new Date();
            trialEnd.setDate(trialEnd.getDate() + 30);
            const trialEndDateString = trialEnd.toISOString();

            await setDoc(subRef, {
              userId: user.uid,
              status: 'trial',
              trialStartDate: trialStart,
              trialEndDate: trialEndDateString,
              trialDaysRemaining: 30,
              createdAt: trialStart,
              updatedAt: trialStart
            });

            // Update user profile status
            const userRef = doc(db, 'users', user.uid);
            await updateDoc(userRef, {
              subscriptionStatus: 'inactive',
              trialEndDate: trialEndDateString
            });
          } catch (err) {
            console.error("Could not automatically initialize subscription record:", err);
          }
        } else {
          setSubscription(null);
        }
      }
      setLoading(false);
    }, (error) => {
      console.error("Error fetching subscription context snap:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, profile?.role]);

  const startTrial = async () => {
    if (!user) return;
    const subRef = doc(db, 'subscriptions', user.uid);
    const now = new Date();
    const trialStart = now.toISOString();
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 30);
    const trialEndDateString = trialEnd.toISOString();

    await setDoc(subRef, {
      userId: user.uid,
      status: 'trial',
      trialStartDate: trialStart,
      trialEndDate: trialEndDateString,
      trialDaysRemaining: 30,
      createdAt: trialStart,
      updatedAt: trialStart
    });

    const userRef = doc(db, 'users', user.uid);
    await updateDoc(userRef, {
      subscriptionStatus: 'inactive',
      trialEndDate: trialEndDateString
    });
  };

  const status = subscription?.status || (user?.email === 'chrisjeal9@gmail.com' ? 'active' : null);
  const daysRemaining = subscription?.trialDaysRemaining ?? 0;

  const isTrial = () => status === 'trial';
  const isActive = () => status === 'active';
  const isExpired = () => status === 'expired';

  return (
    <SubscriptionContext.Provider value={{
      subscription,
      loading,
      status,
      daysRemaining,
      isTrial,
      isActive,
      isExpired,
      startTrial
    }}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
}
