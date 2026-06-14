import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";

export interface FormationMetrics {
  formationId: string;
  games: number;
  goalsFor: number;
  goalsAgainst: number;
  wins: number;
  losses: number;
}

export interface SimplifiedFormationMetric {
  formationId: string;
  winRate: number;
  goalDifference: number;
}

export interface AnalyticsResult {
  raw: Record<string, FormationMetrics>;
  summary: SimplifiedFormationMetric[];
}

export const getFormationAnalytics = async (seasonId: string, teamId: string): Promise<AnalyticsResult> => {
  const matchesRef = collection(db, "matches");
  const qMatches = query(matchesRef, where("seasonId", "==", seasonId), where("teamId", "==", teamId));
  
  let matchesSnapshot;
  try {
    matchesSnapshot = await getDocs(qMatches);
  } catch (error) {
    console.error("Failed to fetch matches for analytics:", error);
    return { raw: {}, summary: [] };
  }

  const rawData: Record<string, FormationMetrics> = {};

  for (const matchDoc of matchesSnapshot.docs) {
    const match = matchDoc.data();
    const matchId = matchDoc.id;
    const result = match.result; 

    let eventsSnapshot;
    try {
      const eventsRef = collection(db, "matches", matchId, "events");
      eventsSnapshot = await getDocs(eventsRef);
    } catch (error) {
      console.error(`Failed to fetch events for match ${matchId}:`, error);
      continue;
    }

    const formationsInMatch = new Set<string>();

    eventsSnapshot.forEach((eventDoc) => {
      const event = eventDoc.data();
      const formationId = event.formationId;

      if (!formationId) return;

      if (!rawData[formationId]) {
        rawData[formationId] = {
          formationId,
          games: 0,
          goalsFor: 0,
          goalsAgainst: 0,
          wins: 0,
          losses: 0
        };
      }

      formationsInMatch.add(formationId);

      if (event.type === "goal") {
        if (event.team === "us") {
          rawData[formationId].goalsFor += 1;
        } else {
          rawData[formationId].goalsAgainst += 1;
        }
      }
    });

    formationsInMatch.forEach((formationId) => {
      rawData[formationId].games += 1;
      
      if (result === "W" || result === "win") {
        rawData[formationId].wins += 1;
      } else if (result === "L" || result === "loss") {
        rawData[formationId].losses += 1;
      }
    });
  }

  const summary: SimplifiedFormationMetric[] = Object.values(rawData).map((metric) => {
    const winRate = metric.games > 0 ? Number((metric.wins / metric.games).toFixed(2)) : 0;
    const goalDifference = metric.goalsFor - metric.goalsAgainst;

    return {
      formationId: metric.formationId,
      winRate,
      goalDifference
    };
  });

  return {
    raw: rawData,
    summary
  };
};
