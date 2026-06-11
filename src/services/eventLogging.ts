import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

export const logEvent = async (matchId: string, event: any) => {
  try {
    await addDoc(collection(db, "matches", matchId, "events"), {
      ...event,
      createdAt: serverTimestamp()
    });
  } catch (err) {
    console.error("Event logging failed", err);
  }
};
