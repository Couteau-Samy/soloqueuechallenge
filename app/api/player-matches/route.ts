import { NextResponse } from "next/server";
import { players } from "@/data/players";

const API_KEY = process.env.RIOT_API_KEY;

async function fetchRiot(url: string) {
  const res = await fetch(url, {
    headers: { "X-Riot-Token": API_KEY || "" },
    next: { revalidate: 60 } // Cache d'une minute pour éviter le spam
  });
  if (!res.ok) throw new Error(`Riot API Error: ${res.status}`);
  return res.json();
}

export async function GET(request: Request) {
  if (!API_KEY) return NextResponse.json({ error: "API Key manquante" }, { status: 500 });

  const { searchParams } = new URL(request.url);
  const playerName = searchParams.get("name");

  const player = players.find((p) => p.name.toLowerCase() === playerName?.toLowerCase());
  if (!player) return NextResponse.json({ error: "Joueur non trouvé" }, { status: 404 });

  try {
    const [gameName, tagLine] = player.riotId.split("#");
    
    // 1. Récupérer le PUUID
    const account = await fetchRiot(
      `https://europe.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`
    );
    const puuid = account.puuid;

    // 2. Récupérer les ID des 3 derniers matchs SoloQ (Queue 420 = SoloQ)
    const matchIds = await fetchRiot(
      `https://europe.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?queue=420&start=0&count=3`
    );

    // 3. Récupérer les détails de chaque match en parallèle
    const matchesDetails = await Promise.all(
      matchIds.map(async (matchId: string) => {
        try {
          const match = await fetchRiot(`https://europe.api.riotgames.com/lol/match/v5/matches/${matchId}`);
          
          // Trouver le joueur en question dans la partie
          const participant = match.info.participants.find((p: any) => p.puuid === puuid);
          if (!participant) return null;

          // Trouver l'équipe du joueur pour calculer la Kill Participation
          const teamId = participant.teamId;
          const team = match.info.teams.find((t: any) => t.teamId === teamId);
          const teamTotalKills = team?.objectives?.champion?.kills || 1;

          // Calcul de la Kill Participation
          const kp = Math.round(((participant.kills + participant.assists) / teamTotalKills) * 100);

          return {
            matchId,
            win: participant.win,
            championName: participant.championName,
            kills: participant.kills,
            deaths: participant.deaths,
            assists: participant.assists,
            kp: kp,
            championIcon: `https://ddragon.leagueoflegends.com/cdn/14.10.1/img/champion/${participant.championName}.png`
          };
        } catch {
          return null;
        }
      })
    );

    // Filtrer les éventuels matchs corrompus ou nuls
    const cleanMatches = matchesDetails.filter((m) => m !== null);

    return NextResponse.json(cleanMatches);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur lors du chargement des matchs" }, { status: 500 });
  }
}