import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import Stripe from "stripe";
import admin from "firebase-admin";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
let db: any;
const initializeDb = async () => {
  try {
    const configPath = path.join(process.cwd(), "firebase-applet-config.json");
    if (fs.existsSync(configPath)) {
      const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.applicationDefault(),
          projectId: firebaseConfig.projectId,
        });
      }
      // Use getFirestore from firebase-admin/firestore to specify databaseId if needed
      const { getFirestore } = await import("firebase-admin/firestore");
      db = getFirestore(admin.app(), firebaseConfig.firestoreDatabaseId || "(default)");
      console.log("Firebase Admin initialized successfully");
    } else {
      console.error("firebase-applet-config.json not found");
    }
  } catch (error) {
    console.error("Failed to initialize Firebase Admin:", error);
  }
};
await initializeDb();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "dummy_key");

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Stripe Webhook needs raw body
  app.post("/api/webhook", bodyParser.raw({ type: "application/json" }), async (req, res) => {
    const sig = req.headers["stripe-signature"]!;
    let event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET || "dummy_secret");
    } catch (err: any) {
      console.error(`Webhook Error: ${err.message}`);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.client_reference_id;
      if (userId && db) {
        try {
          await db.collection("users").doc(userId).update({
            subscriptionStatus: "active",
            stripeCustomerId: session.customer as string,
          });

          // Update team subscription status as well
          const userDoc = await db.collection("users").doc(userId).get();
          const userData = userDoc.data();
          if (userData?.teamId) {
            await db.collection("teams").doc(userData.teamId).update({
              subscriptionStatus: "active",
            });
          }

          await db.collection("subscriptions").add({
            userId,
            status: "active",
            stripeCustomerId: session.customer as string,
            stripeSubscriptionId: session.subscription as string,
            plan: "premium",
            createdAt: new Date().toISOString(),
          });
          console.log(`Subscription activated for user: ${userId}`);
        } catch (dbError) {
          console.error("Error updating subscription in Firestore:", dbError);
        }
      }
    }

    if (event.type === "customer.subscription.deleted" || event.type === "customer.subscription.updated") {
      const subscription = event.data.object as Stripe.Subscription;
      const status = subscription.status === "active" ? "active" : "inactive";
      
      if (db) {
        try {
          // Find the user with this stripe customer ID
          const usersSnapshot = await db.collection("users").where("stripeCustomerId", "==", subscription.customer).get();
          
          if (!usersSnapshot.empty) {
            const userDoc = usersSnapshot.docs[0];
            const userId = userDoc.id;
            const userData = userDoc.data();

            await db.collection("users").doc(userId).update({
              subscriptionStatus: status,
            });

            if (userData?.teamId) {
              await db.collection("teams").doc(userData.teamId).update({
                subscriptionStatus: status,
              });
            }
            console.log(`Subscription ${status} for user: ${userId}`);
          }
        } catch (dbError) {
          console.error("Error updating subscription status in Firestore:", dbError);
        }
      }
    }

    res.json({ received: true });
  });

  app.use(express.json());

  // Create Stripe Checkout Session
  app.post("/api/create-checkout-session", async (req, res) => {
    const { userId, email } = req.body;
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(500).json({ error: "Stripe secret key not configured" });
    }
    const appUrl = process.env.APP_URL || "http://localhost:3000";
    try {
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "gbp",
              product_data: {
                name: "The Touchline Hub - Premium Plan",
                description: "Full access to coaching tools and live stats",
              },
              unit_amount: 499, // £4.99 per month
              recurring: { interval: "month" },
            },
            quantity: 1,
          },
        ],
        mode: "subscription",
        success_url: `${appUrl}/?success=true`,
        cancel_url: `${appUrl}/?canceled=true`,
        client_reference_id: userId,
        customer_email: email,
      });
      res.json({ url: session.url });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Create Stripe Customer Portal Session
  app.post("/api/create-portal-session", async (req, res) => {
    const { userId } = req.body;
    if (!db) return res.status(500).json({ error: "Database not initialized" });
    
    try {
      const userDoc = await db.collection("users").doc(userId).get();
      const userData = userDoc.data();
      
      if (!userData?.stripeCustomerId) {
        return res.status(400).json({ error: "No active subscription found for this user" });
      }

      const appUrl = process.env.APP_URL || "http://localhost:3000";
      const session = await stripe.billingPortal.sessions.create({
        customer: userData.stripeCustomerId,
        return_url: `${appUrl}/`,
      });

      res.json({ url: session.url });
    } catch (error: any) {
      console.error("Error creating portal session:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Push Notification Helper
  const sendNotification = async (tokens: string[], title: string, body: string, data?: any) => {
    if (!tokens.length) return;
    
    const message = {
      notification: { title, body },
      data: data || {},
      tokens: tokens.filter(t => !!t),
    };

    try {
      const response = await admin.messaging().sendEachForMulticast(message);
      console.log(`[Notification] Successfully sent ${response.successCount} messages; ${response.failureCount} failed.`);
      
      // Handle failed tokens (e.g., remove invalid tokens from DB)
      if (response.failureCount > 0) {
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            console.error(`[Notification] Failed to send to token ${message.tokens[idx]}:`, resp.error);
          }
        });
      }
    } catch (error) {
      console.error("[Notification] Error sending multicast message:", error);
    }
  };

  // Send Notification Endpoint
  app.post("/api/send-notification", async (req, res) => {
    const { teamId, title, body, data, recipientIds } = req.body;
    if (!db) return res.status(500).json({ error: "Database not initialized" });

    try {
      let tokens: string[] = [];
      
      if (recipientIds && recipientIds.length > 0) {
        // Send to specific users
        const usersSnapshot = await db.collection("users").where(admin.firestore.FieldPath.documentId(), "in", recipientIds).get();
        tokens = usersSnapshot.docs.map((doc: any) => doc.data().fcmToken).filter((t: any) => !!t);
      } else if (teamId) {
        // Send to entire team
        const usersSnapshot = await db.collection("users").where("teamId", "==", teamId).get();
        tokens = usersSnapshot.docs.map((doc: any) => doc.data().fcmToken).filter((t: any) => !!t);
      }

      if (tokens.length > 0) {
        await sendNotification(tokens, title, body, data);
        res.json({ success: true, count: tokens.length });
      } else {
        res.json({ success: true, count: 0, message: "No tokens found" });
      }
    } catch (error: any) {
      console.error("[Notification] Error in /api/send-notification:", error);
      // Gracefully handle permission denied for preview environments where we lack IAM roles
      if (error.code === 7 || error.message.includes("PERMISSION_DENIED")) {
        return res.json({ success: false, error: "Push notifications mocked in preview environment due to lack of IAM permissions" });
      }
      res.status(500).json({ error: error.message });
    }
  });

  // Background task for unconfirmed schedule entries (runs every hour)
  setInterval(async () => {
    if (!db) return;
    console.log("[Background] Checking for unconfirmed schedule entries...");
    
    try {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      // Check matches and training sessions in the next 24 hours
      const eventsSnapshot = await db.collection("matches")
        .where("date", ">=", now.toISOString())
        .where("date", "<=", tomorrow.toISOString())
        .get();

      const allEvents = eventsSnapshot.docs;
      
      for (const eventDoc of allEvents) {
        const event = eventDoc.data();
        const eventId = eventDoc.id;
        const teamId = event.teamId;
        
        // Get all players for this team
        const playersSnapshot = await db.collection("players").where("teamId", "==", teamId).get();
        const players = playersSnapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
        
        // Get attendances for this event
        const attendancesSnapshot = await db.collection("attendances")
          .where("matchId", "==", eventId)
          .get();
        const attendances = attendancesSnapshot.docs.map((doc: any) => doc.data());
        
        const confirmedPlayerIds = attendances.map((a: any) => a.playerId);
        const unconfirmedPlayers = players.filter((p: any) => !confirmedPlayerIds.includes(p.id));
        
        if (unconfirmedPlayers.length > 0) {
          // Check team-level settings
          const teamDoc = await db.collection("teams").doc(teamId).get();
          const teamData = teamDoc.data();
          if (teamData?.notificationSettings && teamData.notificationSettings.attendanceReminder === false) {
             console.log(`[Notification] Sending disabled for team ${teamId} and type attendanceReminder`);
             continue;
          }

          // Find parents of unconfirmed players
          for (const player of unconfirmedPlayers) {
            const parentsSnapshot = await db.collection("users")
              .where("role", "==", "parent")
              .where("linkedPlayerIds", "array-contains", player.id)
              .get();
              
            const parentTokens: string[] = [];
            for (const doc of parentsSnapshot.docs) {
                const parentData = doc.data();
                if (parentData.fcmToken) {
                    const prefs = parentData.notificationPreferences;
                    if (!prefs || prefs.attendanceReminder !== false) {
                        parentTokens.push(parentData.fcmToken);
                    }
                }
            }
            
            if (parentTokens.length > 0) {
              await sendNotification(
                parentTokens,
                "Action Required: Match Confirmation",
                `Please confirm attendance for ${player.name} for the upcoming event: ${event.opponent || event.title}`,
                { eventId, type: 'reminder' }
              );
            }
          }
        }
      }
    } catch (error) {
      console.error("[Background] Error in unconfirmed entries check:", error);
    }
  }, 1000 * 60 * 60); // Every hour

  // Notifications Trigger
  const setupNotificationListeners = () => {
    if (!db) return;

    db.collection("matches").onSnapshot((snapshot: any) => {
      snapshot.docChanges().forEach((change: any) => {
        if (change.type === "added") {
          const match = change.doc.data();
          sendTeamNotification(match.teamId, "New Match Scheduled", `New match confirmed: ${match.opponent || 'TBC'}`, 'matchScheduled');
        }
        if (change.type === "modified") {
          const match = change.doc.data();
          sendTeamNotification(match.teamId, "Schedule Update", `Match schedule update: ${match.opponent || 'TBC'}`, 'matchUpdate');
        }
      });
    });
  };

  const sendTeamNotification = async (teamId: string, title: string, body: string, type: string) => {
     // 1. Get team settings
     const teamDoc = await db.collection("teams").doc(teamId).get();
     const teamData = teamDoc.data();
     if (teamData?.notificationSettings && teamData.notificationSettings[type] === false) {
       console.log(`[Notification] Sending disabled for team ${teamId} and type ${type}`);
       return;
     }

     const usersSnapshot = await db.collection("users").where("teamId", "==", teamId).get();
     
     // 2. Filter users based on preferences
     const tokens: string[] = [];
     for (const doc of usersSnapshot.docs) {
        const userData = doc.data();
        if (userData.fcmToken) {
           const prefs = userData.notificationPreferences;
           if (!prefs || prefs[type] !== false) {
             tokens.push(userData.fcmToken);
           }
        }
     }
     
     if (tokens.length > 0) {
       await sendNotification(tokens, title, body);
     }
  };

  setupNotificationListeners();


  // Validate Coach Code
  app.post("/api/validate-coach-code", async (req, res) => {
    const { code, userId } = req.body;
    if (!db) return res.status(500).json({ error: "Database not initialized" });
    try {
      const codesRef = db.collection("coachCodes");
      const snapshot = await codesRef.where("code", "==", code).where("isUsed", "==", false).get();

      if (snapshot.empty) {
        return res.status(400).json({ error: "Invalid or already used code" });
      }

      const codeDoc = snapshot.docs[0];
      const codeData = codeDoc.data();
      
      // Fetch user profile to get name/email for admin view
      const userDoc = await db.collection("users").doc(userId).get();
      const userData = userDoc.data();

      await codeDoc.ref.update({
        isUsed: true,
        usedBy: userId,
        usedByName: userData?.displayName || null,
        usedByEmail: userData?.email || null,
        usedAt: new Date().toISOString(),
      });

      const updates: any = {
        subscriptionStatus: "active",
      };

      if (codeData.type === 'trial') {
        const durationMonths = codeData.durationMonths || 3;
        const trialEndDate = new Date();
        trialEndDate.setMonth(trialEndDate.getMonth() + durationMonths);
        updates.trialEndDate = trialEndDate.toISOString();
        updates.isTrial = true;
      }

      await db.collection("users").doc(userId).update(updates);

      // Update team subscription status as well
      if (userData?.teamId) {
        await db.collection("teams").doc(userData.teamId).update(updates);
      }

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Populate Dummy Data
  app.post("/api/populate-dummy-data", async (req, res) => {
    const { userId, email } = req.body;
    if (email !== 'chrisjeal9@gmail.com') {
      return res.status(403).json({ error: "Unauthorized" });
    }
    if (!db) return res.status(500).json({ error: "Database not initialized" });

    try {
      const teamId = `team_${Date.now()}`;
      await db.collection("teams").doc(teamId).set({
        name: "Dummy Team",
        code: "123456",
        coachId: userId,
        matchDuration: 45,
        subscriptionStatus: "active"
      });

      await db.collection("users").doc(userId).update({
        teamId,
        role: "coach",
        subscriptionStatus: "active"
      });

      // Add players
      for (let i = 1; i <= 14; i++) {
          await db.collection("players").add({
              teamId,
              name: `Player ${i}`,
              number: i,
              position: i % 2 === 0 ? "Forward" : "Defender",
              inviteCode: `P-${i}${i}${i}${i}${i}${i}`
          });
      }

      // Add training sessions
      const now = new Date();
      for (let i = -5; i <= 5; i++) {
          const date = new Date(now);
          date.setDate(date.getDate() + i * 7);
          await db.collection("trainingSessions").add({
              teamId,
              title: `Training Session ${i > 0 ? 'Future' : 'Past'} ${i}`,
              date: date.toISOString(),
              location: "Main Pitch",
              notes: "Focus on passing and movement."
          });
      }

      // Add matches
      for (let i = -3; i <= 3; i++) {
          const date = new Date(now);
          date.setDate(date.getDate() + i * 14);
          await db.collection("matches").add({
              teamId,
              opponent: `Opponent ${i}`,
              date: date.toISOString(),
              location: i > 0 ? "Away" : "Home",
              result: i < 0 ? (i % 2 === 0 ? "Win" : "Loss") : null
          });
      }

      // Add news
      for (let i = 1; i <= 5; i++) {
          await db.collection("news").add({
              teamId,
              title: `News Post ${i}`,
              content: `This is dummy news post ${i}.`,
              authorId: userId,
              createdAt: new Date().toISOString()
          });
      }
      
      // Add messages
      for (let i = 1; i <= 5; i++) {
          await db.collection("messages").add({
              teamId,
              text: `Message ${i}`,
              senderId: userId,
              senderName: "Coach",
              createdAt: new Date().toISOString()
          });
      }

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
