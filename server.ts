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
