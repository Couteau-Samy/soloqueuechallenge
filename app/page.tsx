"use client";

import { useEffect, useState } from "react";

interface Player {
  name: string;
  profileIconId: number;
  wins: number;
  losses: number;
  totalGames: number;
  lp: number;
  tier: string;
  rank: string;
  winrate: number;
  startDisplay: string;
  initialRankIndex: number;
  streak: string;
  scoreDetails: {
    winratePoints: number;
    lpGainPoints: number;
    bonusPoints: number;
    finalScore: number;
    isBelowMinGames: boolean;
  };
}

interface MatchHistory {
  matchId: string;
  win: boolean;
  championName: string;
  kills: number;
  deaths: number;
  assists: number;
  kp: number;
  championIcon: string;
}

export default function Home() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);
  const [history, setHistory] = useState<Record<string, MatchHistory[]>>({});
  const [loadingHistory, setLoadingHistory] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch("/api/leaderboard")
      .then((res) => res.json())
      .then((data) => {
        setPlayers(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Erreur fetch leaderboard:", err);
        setLoading(false);
      });
  }, []);

  const handlePlayerClick = async (playerName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (expandedPlayer === playerName) {
      setExpandedPlayer(null);
      return;
    }
    setExpandedPlayer(playerName);
    if (history[playerName]) return;

    setLoadingHistory((prev) => ({ ...prev, [playerName]: true }));
    try {
      const res = await fetch(`/api/player-matches?name=${encodeURIComponent(playerName)}`);
      const data = await res.json();
      if (!data.error) {
        setHistory((prev) => ({ ...prev, [playerName]: data }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingHistory((prev) => ({ ...prev, [playerName]: false }));
    }
  };

  const getRankBadgeStyle = (index: number) => {
    if (index === 0) return { background: "#f1c40f", color: "#000" };
    if (index === 1) return { background: "#b2bec3", color: "#000" };
    if (index === 2) return { background: "#cd7f32", color: "#fff" };
    return { background: "rgba(255,255,255,0.08)", color: "#fff" };
  };

  const renderTrend = (currentIndex: number, initialIndex: number) => {
    const diff = initialIndex - currentIndex;
    if (diff > 0) return <span style={{ color: '#2ecc71', marginLeft: '6px', fontWeight: 'bold' }}>▲ +{diff}</span>;
    if (diff < 0) return <span style={{ color: '#e74c3c', marginLeft: '6px', fontWeight: 'bold' }}>▼ {diff}</span>;
    return <span style={{ color: '#aaa', marginLeft: '6px', fontWeight: 'normal' }}>=</span>;
  };

  if (loading) {
    return (
      <main style={styles.page}>
        <div style={styles.loadingContainer}>
          <div style={styles.spinner}></div>
          <p style={styles.subtitle}>Chargement global et analyse des profils...</p>
        </div>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      {/* HEADER */}
      <div style={styles.header}>
        <h1 style={styles.title}>🔥 MENDICK SOLOQ CHALLENGE</h1>
        <p style={styles.subtitle}>Du 1er Juin au 21 Juin • Cliquez sur une carte pour voir le détail complet 🎮</p>
      </div>

      {/* LEADERBOARD GRID */}
      <div style={styles.grid}>
        {players.map((p, i) => {
          const isTop1 = i === 0 && p.tier !== "ERROR";
          const details = p.scoreDetails;
          const isExpanded = expandedPlayer === p.name;

          const cardStyle = {
            ...styles.card,
            ...(isTop1 ? styles.top1Card : {}),
            ...(isExpanded ? styles.cardExpanded : {}),
          };

          const iconUrl = `https://ddragon.leagueoflegends.com/cdn/14.10.1/img/profileicon/${p.profileIconId}.png`;
          const scoreValueStyle = {
            fontSize: "28px", 
            fontWeight: "900", 
            color: details.isBelowMinGames ? "#e67e22" : "#f1c40f"
          };

          return (
            <div key={p.name} style={cardStyle} onClick={(e) => handlePlayerClick(p.name, e)}>
              
              {/* Badge de Position + Tendance */}
              <div style={{ ...styles.rankBadge, ...getRankBadgeStyle(i) }}>
                #{i + 1} {renderTrend(i, p.initialRankIndex)}
              </div>

              {/* EN-TÊTE : Image + Nom + Badges de Streaks */}
              <div style={styles.playerHeader}>
                <img 
                  src={iconUrl} 
                  alt={p.name} 
                  style={{ ...styles.avatar, borderColor: isTop1 ? '#f1c40f' : 'rgba(255, 255, 255, 0.15)' }} 
                />
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h2 style={styles.name}>{p.name}</h2>
                    {p.streak === "FIRE" && <span style={styles.streakFire}>🔥 EN FEU</span>}
                    {p.streak === "TILT" && <span style={styles.streakTilt}>💀 TILT</span>}
                  </div>
                  <div style={styles.liveRank}>
                    {p.tier} {p.rank} <span style={styles.liveLp}>({p.lp} LP)</span>
                  </div>
                </div>
              </div>

              {/* BLOC SCORE OFFICIEL */}
              <div style={styles.scoreContainer}>
                <div style={styles.scoreLabel}>SCORE ACTUEL</div>
                <div style={scoreValueStyle}>{details.finalScore} pts</div>
                {details.isBelowMinGames && (
                  <div style={{ fontSize: '10px', color: '#e67e22', marginTop: '4px', fontWeight: '600' }}>
                    ⚠️ &lt; 30 games jouées
                  </div>
                )}
              </div>

              <div style={styles.divider} />
              
              {/* STATS DÉTAILLÉES */}
              <div style={styles.statsContainer}>
                <div style={styles.statLine}>
                  <span style={styles.statLabel}>🎯 Points Winrate ({p.winrate}%)</span>
                  <span style={styles.statValue}>+{details.winratePoints}</span>
                </div>
                
                <div style={styles.statLine}>
                  <span style={styles.statLabel}>📈 Delta LP purs</span>
                  <span style={{ ...styles.statValue, color: details.lpGainPoints >= 0 ? '#2ecc71' : '#e74c3c' }}>
                    {details.lpGainPoints >= 0 ? `+${details.lpGainPoints}` : details.lpGainPoints}
                  </span>
                </div>
                
                <div style={styles.statLine}>
                  <span style={styles.statLabel}>⭐ Bonus / Malus Paliers</span>
                  <span style={{ ...styles.statValue, color: details.bonusPoints >= 0 ? '#f1c40f' : '#e74c3c' }}>
                    {details.bonusPoints >= 0 ? `+${details.bonusPoints}` : details.bonusPoints}
                  </span>
                </div>
                
                <div style={styles.statLine}>
                  <span style={styles.statLabel}>🎮 Total de parties</span>
                  <span style={{ ...styles.statValue, color: p.totalGames < 30 ? '#e67e22' : '#2ecc71' }}>
                    {p.totalGames} / 30 min <span style={{ color: '#aaa', fontWeight: 'normal', marginLeft: '6px' }}>({p.wins}W / {p.losses}L)</span>
                  </span>
                </div>
              </div>

              {/* ZONE DE L'HISTORIQUE AU CLIC */}
              {isExpanded && (
                <div style={styles.historySection} onClick={(e) => e.stopPropagation()}>
                  <div style={styles.divider} />
                  <h3 style={styles.historyTitle}>Dernières parties SoloQ</h3>
                  
                  {loadingHistory[p.name] && (
                    <div style={styles.historyLoading}>
                      <div style={styles.miniSpinner}></div>
                      <span>Analyse des replays Riot...</span>
                    </div>
                  )}

                  {!loadingHistory[p.name] && history[p.name] && (
                    <div style={styles.matchesList}>
                      {history[p.name].map((m, idx) => (
                        <div 
                          key={idx} 
                          style={{
                            ...styles.matchRow,
                            borderLeft: `4px solid ${m.win ? '#2ecc71' : '#e74c3c'}`,
                            background: m.win ? 'rgba(46, 204, 113, 0.05)' : 'rgba(231, 76, 60, 0.05)'
                          }}
                        >
                          <img src={m.championIcon} alt={m.championName} style={styles.championImg} />
                          <div style={styles.matchMeta}>
                            <span style={styles.championNameText}>{m.championName}</span>
                            <span style={styles.kdaText}>
                              {m.kills} / <span style={{ color: '#e74c3c' }}>{m.deaths}</span> / {m.assists}
                            </span>
                          </div>
                          <div style={styles.matchBadgeContainer}>
                            <span style={styles.kpBadge}>KP: {m.kp}%</span>
                            <span style={{ ...styles.winBadge, color: m.win ? '#2ecc71' : '#e74c3c' }}>
                              {m.win ? "VICTOIRE" : "DÉFAITE"}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div style={styles.startFooter}>
                Départ : <span style={{ color: '#fff' }}>{p.startDisplay}</span>
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}

const styles: any = {
  page: { background: "radial-gradient(circle at top, #16192b 0%, #090a10 100%)", color: "#f5f6fa", minHeight: "100vh", padding: "60px 20px", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" },
  loadingContainer: { display: "flex", flexDirection: "column", justify_content: "center", alignItems: "center", minHeight: "60vh", gap: "20px" },
  spinner: { width: "40px", height: "40px", border: "4px solid rgba(255,255,255,0.1)", borderTop: "4px solid #f1c40f", borderRadius: "50%", animation: "spin 1s linear infinite" },
  miniSpinner: { width: "16px", height: "16px", border: "2px solid rgba(255,255,255,0.1)", borderTop: "2px solid #f1c40f", borderRadius: "50%", animation: "spin 1s linear infinite" },
  header: { textAlign: "center", marginBottom: "50px" },
  title: { fontSize: "40px", fontWeight: "900", letterSpacing: "1px", background: "linear-gradient(135deg, #fff 0%, #f1c40f 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: "8px" },
  subtitle: { color: "#8a9fc4", fontSize: "15px", fontWeight: "500" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: "24px", maxWidth: "1200px", margin: "0 auto" },
  card: { position: "relative", background: "rgba(25, 30, 56, 0.4)", backdropFilter: "blur(12px)", padding: "26px", borderRadius: "20px", border: "1px solid rgba(255, 255, 255, 0.05)", cursor: "pointer", transition: "all 0.25s ease" },
  top1Card: { border: "1px solid #f1c40f", boxShadow: "0 0 30px rgba(241, 196, 15, 0.15)", background: "linear-gradient(135deg, rgba(25, 30, 56, 0.6) 0%, rgba(241, 196, 15, 0.04) 100%)" },
  cardExpanded: { border: "1px solid rgba(241, 196, 15, 0.6)", boxShadow: "0 10px 25px rgba(0,0,0,0.4)", transform: "scale(1.01)" },
  playerHeader: { display: "flex", alignItems: "center", gap: "16px", marginBottom: "15px" },
  avatar: { width: "48px", height: "48px", borderRadius: "50%", border: "2px solid", boxShadow: "0 4px 10px rgba(0,0,0,0.2)" },
  rankBadge: { position: "absolute", top: "18px", right: "18px", fontSize: "12px", fontWeight: "800", padding: "4px 14px", borderRadius: "30px", letterSpacing: "0.5px", display: "flex", alignItems: "center" },
  name: { fontSize: "24px", fontWeight: "800", color: "#fff" },
  liveRank: { fontSize: "14px", color: "#3498db", fontWeight: "600" },
  liveLp: { color: "#aaa", fontWeight: "normal" },
  scoreContainer: { background: "rgba(0, 0, 0, 0.25)", padding: "14px", borderRadius: "12px", textAlign: "center", marginBottom: "14px", marginTop: "10px" },
  scoreLabel: { fontSize: "11px", color: "#8a9fc4", fontWeight: "700", letterSpacing: "1px", marginBottom: "4px" },
  divider: { height: "1px", background: "rgba(255,255,255,0.06)", margin: "16px 0" },
  statsContainer: { display: "flex", flexDirection: "column", gap: "12px" },
  statLine: { display: "flex", justifyContent: "space-between", fontSize: "13px" },
  statLabel: { color: "#8a9fc4" },
  statValue: { fontWeight: "700", color: "#fff" },
  startFooter: { marginTop: "24px", fontSize: "11px", color: "#5d6d7e", textAlign: "right", fontWeight: "500" },
  streakFire: { background: "linear-gradient(135deg, #e67e22, #e74c3c)", color: "#fff", fontSize: "9px", fontWeight: "bold", padding: "2px 6px", borderRadius: "4px", letterSpacing: "0.5px" },
  streakTilt: { background: "linear-gradient(135deg, #7f8c8d, #34495e)", color: "#fff", fontSize: "9px", fontWeight: "bold", padding: "2px 6px", borderRadius: "4px", letterSpacing: "0.5px" },
  historySection: { marginTop: "10px" },
  historyTitle: { fontSize: "13px", fontWeight: "700", color: "#fff", marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.5px" },
  historyLoading: { display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", fontSize: "12px", color: "#8a9fc4", padding: "15px 0" },
  matchesList: { display: "flex", flexDirection: "column", gap: "8px" },
  matchRow: { display: "flex", alignItems: "center", padding: "10px 12px", borderRadius: "8px", gap: "12px" },
  championImg: { width: "32px", height: "32px", borderRadius: "6px" },
  matchMeta: { display: "flex", flexDirection: "column", flex: 1 },
  championNameText: { fontSize: "12px", fontWeight: "700", color: "#fff" },
  kdaText: { fontSize: "11px", color: "#aaa", marginTop: "2px" },
  matchBadgeContainer: { display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "2px" },
  kpBadge: { fontSize: "10px", background: "rgba(255,255,255,0.06)", padding: "2px 6px", borderRadius: "4px", color: "#8a9fc4", fontWeight: "600" },
  winBadge: { fontSize: "10px", fontWeight: "800", letterSpacing: "0.5px" }
};