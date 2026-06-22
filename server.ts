import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import Stripe from "stripe";
import { Resend } from "resend";
import admin from "firebase-admin";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
let db: any;

// Define a defensive wrapper for db.collection to intercept any writes to "users" collection
const wrapDb = (rawDb: any) => {
  if (!rawDb) return rawDb;
  return new Proxy(rawDb, {
    get(target, prop, receiver) {
      if (prop === 'collection') {
        return function(collectionPath: string) {
          const col = target.collection(collectionPath);
          if (collectionPath === 'users') {
            return new Proxy(col, {
              get(colTarget, colProp) {
                if (colProp === 'doc') {
                  return function(docId?: string) {
                    const docRef = colTarget.doc(docId);
                    return new Proxy(docRef, {
                      get(docTarget, docProp) {
                        if (docProp === 'update' || docProp === 'set') {
                          return function(data: any, ...args: any[]) {
                            if (data && typeof data === 'object') {
                              console.log("[Defensive Rule] Stripping isVerified and verificationToken from user doc write.");
                              delete data.isVerified;
                              delete data.verificationToken;
                            }
                            return docTarget[docProp](data, ...args);
                          };
                        }
                        return Reflect.get(docTarget, docProp);
                      }
                    });
                  };
                }
                return Reflect.get(colTarget, colProp);
              }
            });
          }
          return col;
        };
      }
      return Reflect.get(target, prop, receiver);
    }
  });
};

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
      const rawDb = getFirestore(admin.app(), firebaseConfig.firestoreDatabaseId || "(default)");
      db = wrapDb(rawDb);
      console.log("Firebase Admin initialized successfully with Defensive Write Interceptors");
    } else {
      console.error("firebase-applet-config.json not found");
    }
  } catch (error) {
    console.error("Failed to initialize Firebase Admin:", error);
  }
};
await initializeDb();

// Find the user's document for chrisjeal9@gmail.com and set their trialEndDate for 3 months after the current datetime.
const updateSpecificUserTrial = async () => {
  if (db) {
    try {
      const snapshot = await db.collection("users").where("email", "==", "chrisjeal9@gmail.com").get();
      if (!snapshot.empty) {
        const userDoc = snapshot.docs[0];
        const userId = userDoc.id;
        const endDate = new Date();
        endDate.setMonth(endDate.getMonth() + 3);
        const trialEndDateStr = endDate.toISOString();

        await db.collection("users").doc(userId).update({
          trialEndDate: trialEndDateStr,
          isReadOnly: false
        });
        console.log(`[Init] Set trialEndDate for ${userId} (chrisjeal9@gmail.com) to ${trialEndDateStr}`);

        const userData = userDoc.data();
        if (userData?.teamId) {
          await db.collection("teams").doc(userData.teamId).update({
            isReadOnly: false
          });
          console.log(`[Init] Automatically unlocked team document ${userData.teamId} for chrisjeal9@gmail.com`);
        }
      } else {
        console.log("[Init] User chrisjeal9@gmail.com not found in 'users' collection during server startup");
      }
    } catch (error) {
      console.error("[Init] Error performing startup update for chrisjeal9@gmail.com:", error);
    }
  }
};
// Run after db initialization is complete (delayed slightly to ensure Firestore connection is solid)
setTimeout(updateSpecificUserTrial, 1500);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "dummy_key");

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Common webhook handler logic
  const handleStripeWebhook = async (req: express.Request, res: express.Response) => {
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

          let currentPeriodEnd = "";
          if (session.subscription) {
            try {
              const stripeSub = await stripe.subscriptions.retrieve(session.subscription as string);
              currentPeriodEnd = new Date((stripeSub as any).current_period_end * 1000).toISOString();
            } catch (errSub) {
              console.error("Error retrieving Stripe subscription details:", errSub);
            }
          }

          const subRef = db.collection("subscriptions").doc(userId);
          const subSnap = await subRef.get();
          const existingData = subSnap.exists ? subSnap.data() : {};

          await subRef.set({
            userId,
            stripeCustomerId: session.customer as string,
            stripeSubscriptionId: session.subscription as string,
            status: "active",
            plan: "premium",
            trialStartDate: existingData?.trialStartDate || new Date().toISOString(),
            trialEndDate: existingData?.trialEndDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            currentPeriodEnd: currentPeriodEnd || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            createdAt: existingData?.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }, { merge: true });

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

            // Sync the subscriptions collection document
            const subRef = db.collection("subscriptions").doc(userId);
            let subStatus: "active" | "trial" | "expired" | "cancelled" = "active";
            if (status === "inactive") {
              subStatus = subscription.status === "canceled" ? "cancelled" : "expired";
            }

            await subRef.set({
              status: subStatus,
              updatedAt: new Date().toISOString()
            }, { merge: true });

            console.log(`Subscription status ${status} / ${subStatus} for user: ${userId}`);
          }
        } catch (dbError) {
          console.error("Error updating subscription status in Firestore:", dbError);
        }
      }
    }

    res.json({ received: true });
  };

  // Register both paths to the same raw body parser
  app.post("/api/webhook", bodyParser.raw({ type: "application/json" }), handleStripeWebhook);
  app.post("/api/stripe-webhook", bodyParser.raw({ type: "application/json" }), handleStripeWebhook);

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
        success_url: `${appUrl}/subscription?success=true`,
        cancel_url: `${appUrl}/subscription?canceled=true`,
        client_reference_id: userId,
        customer_email: email,
      });
      res.json({ url: session.url });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Create Stripe Customer Portal Session
  const handlePortalSession = async (req: express.Request, res: express.Response) => {
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
        return_url: `${appUrl}/subscription`,
      });

      res.json({ url: session.url });
    } catch (error: any) {
      console.error("Error creating portal session:", error);
      res.status(500).json({ error: error.message });
    }
  };

  app.post("/api/create-portal-session", handlePortalSession);
  app.post("/api/create-customer-portal", handlePortalSession);

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
    const { teamId, title, body, data, recipientIds, notificationType } = req.body;
    if (!db) return res.status(500).json({ error: "Database not initialized" });

    try {
      let tokens: string[] = [];
      
      if (recipientIds && recipientIds.length > 0) {
        // Send to specific users
        const usersSnapshot = await db.collection("users").where(admin.firestore.FieldPath.documentId(), "in", recipientIds).get();
        for (const doc of usersSnapshot.docs) {
          const userData = doc.data();
          if (userData.fcmToken) {
            if (notificationType) {
              const prefs = userData.notificationPreferences;
              if (prefs && prefs[notificationType] === true) {
                tokens.push(userData.fcmToken);
              }
            } else {
              tokens.push(userData.fcmToken);
            }
          }
        }
      } else if (teamId) {
        // Check team settings if applicable
        if (notificationType) {
          const teamDoc = await db.collection("teams").doc(teamId).get();
          const teamData = teamDoc.data();
          if (teamData?.notificationSettings && teamData.notificationSettings[notificationType] === false) {
            return res.json({ success: true, count: 0, message: "Disabled at team level" });
          }
        }

        // Send to entire team based on preferences
        const usersSnapshot = await db.collection("users").where("teamId", "==", teamId).get();
        for (const doc of usersSnapshot.docs) {
           const userData = doc.data();
           if (userData.fcmToken) {
              if (notificationType) {
                 const prefs = userData.notificationPreferences;
                 // OFF BY DEFAULT: user must explicitly opt in
                 if (prefs && prefs[notificationType] === true) {
                   tokens.push(userData.fcmToken);
                 }
              } else {
                 tokens.push(userData.fcmToken);
              }
           }
        }
      }

      if (tokens.length > 0) {
        await sendNotification(tokens, title, body, data);
        res.json({ success: true, count: tokens.length });
      } else {
        res.json({ success: true, count: 0, message: "No tokens found" });
      }
    } catch (error: any) {
      // Gracefully handle permission denied for preview environments where we lack IAM roles
      if (error.code === 7 || error.message.includes("PERMISSION_DENIED") || error.code === 'messaging/invalid-argument') {
        console.log("[Notification] Push notifications mocked in preview environment due to lack of IAM permissions.");
        return res.json({ success: false, error: "Push notifications mocked in preview environment due to lack of IAM permissions" });
      }
      console.error("[Notification] Error in /api/send-notification:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/contact", async (req, res) => {
    const { userId, userEmail, userName, message, type } = req.body;
    if (!db) return res.status(500).json({ error: "Database not initialized" });
    try {
      await db.collection("feedback").add({
        userId: userId || null,
        userEmail: userEmail || null,
        userName: userName || null,
        message,
        type,
        createdAt: new Date().toISOString()
      });

      console.log(`[Email System] Recorded contact us from ${userEmail}: [${type}] ${message}`);

      if (process.env.RESEND_API_KEY) {
        const resend = new Resend(process.env.RESEND_API_KEY);
        await resend.emails.send({
          from: 'onboarding@resend.dev', // Testing domain
          to: 'chrisjeal9@gmail.com', // Must be verified email when using testing domain
          subject: `New Pitch App ${type} from ${userName || userEmail || 'Unknown'}`,
          html: `
            <h3>New Contact Us Message</h3>
            <p><strong>Type:</strong> ${type}</p>
            <p><strong>From:</strong> ${userName || 'N/A'} (${userEmail || 'N/A'})</p>
            <p><strong>Message:</strong></p>
            <p>${message}</p>
          `
        });
        console.log(`[Email System] Successfully sent Resend email to chrisjeal9@gmail.com`);
      } else {
        console.log(`[Email System] RESEND_API_KEY is not configured. Email was not sent.`);
      }

      res.json({ success: true });
    } catch (err: any) {
      console.error("Error submitting contact form:", err);
      res.status(500).json({ error: err.message });
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
                    // OFF BY DEFAULT: only send if explicitly opted in
                    if (prefs && prefs.attendanceReminder === true) {
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

  // AI Endpoints
  const initGenAI = async () => {
    if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY environment variable not configured");
    const { GoogleGenAI } = await import('@google/genai');
    return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  };

  app.post("/api/generate-match-summary", async (req, res) => {
    try {
      const ai = await initGenAI();
      const { prompt } = req.body;
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });
      res.json({ text: response.text?.trim() || '' });
    } catch (error: any) {
      console.error("AI Generation Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/generate-formation-analysis", async (req, res) => {
    try {
      const ai = await initGenAI();
      const { prompt } = req.body;
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });
      res.json({ text: response.text?.trim() || '' });
    } catch (error: any) {
      console.error("AI Generation Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Notifications Trigger
  // Removed setupNotificationListeners() as we now explicitly call triggerNotification from the client
  // upon creation or modification.

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
        codeType: codeData.type,
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
