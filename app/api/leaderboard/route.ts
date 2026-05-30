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
    const results = await Promise.all(
      players.map(async (p) => {
        try {
          const { gameName, tagLine } = splitRiotId(p.riotId);
          
          // 1. On récupère le PUUID
          const account = await fetchRiot(`https://europe.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`);
          
          // 2. On récupère le profil de l'invocateur pour l'icône de profil
          const summoner = await fetchRiot(`https://euw1.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${account.puuid}`);
          const profileIconId = summoner.profileIconId || 29;

          // 3. On récupère les stats de classement SoloQ
          const rankedData = await fetchRiot(`https://euw1.api.riotgames.com/lol/league/v4/entries/by-puuid/${account.puuid}`);
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

          let divisionBonus = 0;
          let tierBonus = 0;

          const startIndexTier = TIER_ORDER.indexOf(p.startTier.toUpperCase());
          const currentIndexTier = TIER_ORDER.indexOf(currentTier.toUpperCase());

          if (currentAbs > startAbs && startIndexTier !== -1 && currentIndexTier !== -1) {
            const tiersCrossed = Math.max(0, currentIndexTier - startIndexTier);
            tierBonus = tiersCrossed * 150;

            const startRankIndex = RANK_ORDER.indexOf(p.startRank.toUpperCase());
            const currentRankIndex = RANK_ORDER.indexOf(currentRank.toUpperCase());
            
            const totalStartDivisions = (startIndexTier * 4) + startRankIndex;
            const totalCurrentDivisions = (currentIndexTier * 4) + currentRankIndex;
            const divisionsCrossed = Math.max(0, totalCurrentDivisions - totalStartDivisions);
            
            divisionBonus = divisionsCrossed * 50;
          }

          const winratePoints = challengeWinrate * 20;
          const finalScore = winratePoints + lpGainPoints + divisionBonus + tierBonus;

          return {
            name: p.name,
            profileIconId,
            wins: challengeWins,
            losses: challengeLosses,
            totalGames: challengeTotalGames,
            lp: currentLp,
            tier: currentTier,
            rank: currentRank,
            winrate: challengeWinrate,
            startDisplay: `${p.startTier} ${p.startRank}`,
            scoreDetails: {
              winratePoints,
              lpGainPoints,
              bonusPoints: divisionBonus + tierBonus,
              finalScore: challengeTotalGames >= 30 ? finalScore : 0,
              isInvalid: challengeTotalGames < 30
            }
          };
        } catch (err) {
          return { name: p.name, profileIconId: 29, wins: 0, losses: 0, totalGames: 0, lp: 0, tier: "ERROR", rank: "", winrate: 0, startDisplay: "Inconnu", scoreDetails: { winratePoints: 0, lpGainPoints: 0, bonusPoints: 0, finalScore: 0, isInvalid: true } };
        }
      })
    );

    const sortedResults = results.sort((a, b) => b.scoreDetails.finalScore - a.scoreDetails.finalScore);
    return NextResponse.json(sortedResults);
  } catch (e) {
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}