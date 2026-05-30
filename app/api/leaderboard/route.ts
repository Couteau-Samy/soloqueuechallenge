import { NextResponse } from "next/server";
import { players } from "@/data/players";

const API_KEY = process.env.RIOT_API_KEY;

const TIER_BASES: Record<string, number> = {
  "IRON": 0, "BRONZE": 400, "SILVER": 800, "GOLD": 1200,
  "PLATINUM": 1600, "EMERALD": 2000, "DIAMOND": 2400, "MASTER": 2800
};

const RANK_BASES: Record<string, number> = { "IV": 0, "III": 100, "II": 200, "I": 300 };
const TIER_ORDER = ["IRON", "BRONZE", "SILVER", "GOLD", "PLATINUM", "EMERALD", "DIAMOND", "MASTER"];
const RANK_ORDER = ["IV", "III", "II", "I"];

function convertToAbsoluteLp(tier: string, rank: string, lp: number): number {
  const cleanTier = tier.toUpperCase();
  const baseLp = TIER_BASES[cleanTier] ?? 0;
  if (["MASTER", "GRANDMASTER", "CHALLENGER"].includes(cleanTier)) return baseLp + lp;
  const rankLp = RANK_BASES[rank.toUpperCase()] ?? 0;
  return baseLp + rankLp + lp;
}

function splitRiotId(riotId: string) {
  const [gameName, tagLine] = riotId.split("#");
  return { gameName, tagLine };
}

async function fetchRiot(url: string) {
  const res = await fetch(url, {
    headers: { "X-Riot-Token": API_KEY || "" },
    next: { revalidate: 300 }
  });
  if (!res.ok) throw new Error(`Riot Error ${res.status}`);
  return res.json();
}

export async function GET() {
  if (!API_KEY) return NextResponse.json({ error: "API Key missing" }, { status: 500 });

  try {
    const initialOrder = [...players]
      .map((p) => ({
        name: p.name,
        absStart: convertToAbsoluteLp(p.startTier, p.startRank, p.startLp)
      }))
      .sort((a, b) => b.absStart - a.absStart)
      .map((p) => p.name);

    const rawResults = await Promise.all(
      players.map(async (p) => {
        try {
          const { gameName, tagLine } = splitRiotId(p.riotId);
          
          const account = await fetchRiot(`https://europe.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`);
          const puuid = account.puuid;

          const summoner = await fetchRiot(`https://euw1.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`);
          const profileIconId = summoner.profileIconId || 29;

          const rankedData = await fetchRiot(`https://euw1.api.riotgames.com/lol/league/v4/entries/by-puuid/${puuid}`);
          const soloQ = rankedData.find((r: any) => r.queueType === "RANKED_SOLO_5x5") || null;
          
          const currentTier = soloQ?.tier || "UNRANKED";
          const currentRank = soloQ?.rank || "";
          const currentLp = soloQ?.leaguePoints || 0;
          
          const liveWins = soloQ?.wins || 0;
          const liveLosses = soloQ?.losses || 0;

          const challengeWins = Math.max(0, liveWins - p.startWins);
          const challengeLosses = Math.max(0, liveLosses - p.startLosses);
          const challengeTotalGames = challengeWins + challengeLosses;
          
          const challengeWinrate = challengeTotalGames > 0 
            ? Math.round((challengeWins / challengeTotalGames) * 100) 
            : 0;

          const startAbs = convertToAbsoluteLp(p.startTier, p.startRank, p.startLp);
          const currentAbs = convertToAbsoluteLp(currentTier, currentRank, currentLp);
          const lpGainPoints = currentAbs - startAbs;

          let divisionBonusOrMalus = 0;
          let tierBonusOrMalus = 0;

          const startIndexTier = TIER_ORDER.indexOf(p.startTier.toUpperCase());
          const currentIndexTier = TIER_ORDER.indexOf(currentTier.toUpperCase());

          if (startIndexTier !== -1 && currentIndexTier !== -1) {
            const TiersCrossed = currentIndexTier - startIndexTier;
            tierBonusOrMalus = TiersCrossed * 150;

            const startRankIndex = RANK_ORDER.indexOf(p.startRank.toUpperCase());
            const currentRankIndex = RANK_ORDER.indexOf(currentRank.toUpperCase());
            
            const totalStartDivisions = (startIndexTier * 4) + startRankIndex;
            const totalCurrentDivisions = (currentIndexTier * 4) + currentRankIndex;
            
            const divisionsCrossed = totalCurrentDivisions - totalStartDivisions;
            divisionBonusOrMalus = divisionsCrossed * 50;
          }

          const winratePoints = challengeWinrate * 20;
          const finalScore = winratePoints + lpGainPoints + divisionBonusOrMalus + tierBonusOrMalus;

          // --- CALCUL DES GAMES DE LA SEMAINE (LUNDI AU DIMANCHE) & STREAK ---
          let streak = "NONE";
          let gamesThisWeek = 0;
          
          try {
            // On récupère jusqu'à 20 matchs pour être sûr d'englober les sessions de la semaine
            const matchIds = await fetchRiot(`https://europe.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?queue=420&start=0&count=20`);
            
            if (matchIds && matchIds.length > 0) {
              // Calcul du timestamp du lundi en cours à 00h00:00
              const now = new Date();
              const day = now.getDay();
              const diffToMonday = now.getDate() - (day === 0 ? 6 : day - 1); // Gère le dimanche (0) correctement
              const mondayStart = new Date(now.setDate(diffToMonday));
              mondayStart.setHours(0, 0, 0, 0);
              const mondayTimestamp = mondayStart.getTime();

              const matchesDetails = await Promise.all(
                matchIds.slice(0, 15).map(async (id: string) => {
                  try {
                    const m = await fetchRiot(`https://europe.api.riotgames.com/lol/match/v5/matches/${id}`);
                    return {
                      win: m.info.participants.find((part: any) => part.puuid === puuid)?.win ?? null,
                      gameCreation: m.info.gameCreation
                    };
                  } catch { return null; }
                })
              );

              // 1. Compte uniquement les games jouées depuis lundi 00h00
              matchesDetails.forEach(m => {
                if (m && m.gameCreation >= mondayTimestamp) {
                  gamesThisWeek++;
                }
              });

              // 2. Calcul du streak basé sur les 3 matchs les plus récents
              const top3 = matchesDetails.slice(0, 3).map(m => m?.win);
              if (top3.length === 3 && top3.every(w => w !== null)) {
                if (top3.every(w => w === true)) streak = "FIRE";
                if (top3.every(w => w === false)) streak = "TILT";
              }
            }
          } catch (e) { console.error("Erreur historique hebdomadaire:", e); }

          return {
            name: p.name,
            profileIconId,
            wins: challengeWins,
            losses: challengeLosses,
            totalGames: challengeTotalGames,
            gamesThisWeek,
            lp: currentLp,
            tier: currentTier,
            rank: currentRank,
            winrate: challengeWinrate,
            startDisplay: `${p.startTier} ${p.startRank} (${p.startLp} LP)`,
            initialRankIndex: initialOrder.indexOf(p.name),
            streak,
            isMaxWinrate: false,
            isMaxGames: false,
            scoreDetails: {
              winratePoints,
              lpGainPoints,
              bonusPoints: divisionBonusOrMalus + tierBonusOrMalus,
              finalScore: finalScore,
              isBelowMinGames: challengeTotalGames < 30
            }
          };
        } catch (err) {
          return { name: p.name, profileIconId: 29, wins: 0, losses: 0, totalGames: 0, gamesThisWeek: 0, lp: 0, tier: "ERROR", rank: "", winrate: 0, startDisplay: "Inconnu", initialRankIndex: 0, streak: "NONE", isMaxWinrate: false, isMaxGames: false, scoreDetails: { winratePoints: 0, lpGainPoints: 0, bonusPoints: 0, finalScore: -9999, isBelowMinGames: true } };
        }
      })
    );

    let maxWinrate = 0;
    let maxGames = 0;

    rawResults.forEach(p => {
      if (p.totalGames > 0 && p.winrate > maxWinrate) maxWinrate = p.winrate;
      if (p.totalGames > maxGames) maxGames = p.totalGames;
    });

    const finalResults = rawResults.map(p => {
      return {
        ...p,
        isMaxWinrate: p.totalGames > 0 && p.winrate === maxWinrate,
        isMaxGames: p.totalGames > 0 && p.totalGames === maxGames
      };
    });

    const sortedResults = finalResults.sort((a, b) => b.scoreDetails.finalScore - a.scoreDetails.finalScore);
    return NextResponse.json(sortedResults);
  } catch (e) {
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}