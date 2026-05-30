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
  scoreDetails: {
    winratePoints: number;
    lpGainPoints: number;
    bonusPoints: number;
    finalScore: number;
    isBelowMinGames: boolean;
  };
}

export default function Home() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [hoveredPlayer, setHoveredPlayer] = useState<string | null>(null);

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

  const getRankBadgeStyle = (index: number) => {
    if (index === 0) return { background: "#f1c40f", color: "#000" };
    if (index === 1) return { background: "#b2bec3", color: "#000" };
    if (index === 2) return { background: "#cd7f32", color: "#fff" };
    return { background: "rgba(255,255,255,0.08)", color: "#fff" };
  };

  if (loading) {
    return (
      <main style={styles.page}>
        <div style={styles.loadingContainer}>
          <div style={styles.spinner}></div>
          <p style={styles.subtitle}>Chargement et calcul du classement en temps réel...</p>
        </div>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      {/* HEADER */}
      <div style={styles.header}>
        <h1 style={styles.title}>🔥 MENDICK SOLOQ CHALLENGE</h1>
        <p style={styles.subtitle}>Du 1er Juin au 21 Juin • Objectif : Score Maximal 🏆</p>
      </div>

      {/* LEADERBOARD GRID */}
      <div style={styles.grid}>
        {players.map((p, i) => {
          const isTop1 = i === 0 && p.tier !== "ERROR";
          const isHovered = hoveredPlayer === p.name;
          const details = p.scoreDetails;

          const cardStyle = {
            ...styles.card,
            ...(isTop1 ? styles.top1Card : {}),
            ...(isHovered ? styles.cardHover : {}),
          };

          const iconUrl = `https://ddragon.leagueoflegends.com/cdn/14.10.1/img/profileicon/${p.profileIconId}.png`;

          // Correction de la gestion de la couleur ici en ligne !
          const scoreValueStyle = {
            fontSize: "28px", 
            fontWeight: "900", 
            color: details.isBelowMinGames ? "#e67e22" : "#f1c40f"
          };

          return (
            <div
              key={p.name} 
              style={cardStyle}
              onMouseEnter={() => setHoveredPlayer(p.name)}
              onMouseLeave={() => setHoveredPlayer(null)}
            >
              {/* Badge de Position */}
              <div style={{ ...styles.rankBadge, ...getRankBadgeStyle(i) }}>
                #{i + 1}
              </div>

              {/* EN-TÊTE : Image de Profil + Nom */}
              <div style={styles.playerHeader}>
                <img 
                  src={iconUrl} 
                  alt={`Icone de ${p.name}`} 
                  style={{
                    ...styles.avatar,
                    borderColor: isTop1 ? '#f1c40f' : 'rgba(255, 255, 255, 0.15)'
                  }} 
                />
                <div>
                  <h2 style={styles.name}>{p.name}</h2>
                  <div style={styles.liveRank}>
                    {p.tier} {p.rank} <span style={styles.liveLp}>({p.lp} LP)</span>
                  </div>
                </div>
              </div>

              {/* BLOC SCORE OFFICIEL */}
              <div style={styles.scoreContainer}>
                <div style={styles.scoreLabel}>SCORE ACTUEL</div>
                <div style={scoreValueStyle}>
                  {details.finalScore} pts
                </div>
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
                  <span style={{
                    ...styles.statValue, 
                    color: details.lpGainPoints >= 0 ? '#2ecc71' : '#e74c3c'
                  }}>
                    {details.lpGainPoints >= 0 ? `+${details.lpGainPoints}` : details.lpGainPoints}
                  </span>
                </div>
                
                <div style={styles.statLine}>
                  <span style={styles.statLabel}>⭐ Bonus (Divisions/Palier)</span>
                  <span style={{ ...styles.statValue, color: '#f1c40f' }}>
                    +{details.bonusPoints}
                  </span>
                </div>
                
                {/* TOTAL DE PARTIES */}
                <div style={styles.statLine}>
                  <span style={styles.statLabel}>🎮 Total de parties</span>
                  <span style={{ 
                    ...styles.statValue, 
                    color: p.totalGames < 30 ? '#e67e22' : '#2ecc71' 
                  }}>
                    {p.totalGames} / 30 min <span style={{ color: '#aaa', fontWeight: 'normal', marginLeft: '6px' }}>({p.wins}W / {p.losses}L)</span>
                  </span>
                </div>
              </div>

              {/* FOOTER DE LA CARTE */}
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
  page: {
    background: "radial-gradient(circle at top, #16192b 0%, #090a10 100%)",
    color: "#f5f6fa",
    minHeight: "100vh",
    padding: "60px 20px",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  loadingContainer: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    minHeight: "60vh",
    gap: "20px"
  },
  spinner: {
    width: "40px",
    height: "40px",
    border: "4px solid rgba(255,255,255,0.1)",
    borderTop: "4px solid #f1c40f",
    borderRadius: "50%",
  },
  header: { textAlign: "center", marginBottom: "50px" },
  title: {
    fontSize: "40px",
    fontWeight: "900",
    letterSpacing: "1px",
    background: "linear-gradient(135deg, #fff 0%, #f1c40f 100%)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    marginBottom: "8px"
  },
  subtitle: { color: "#8a9fc4", fontSize: "15px", fontWeight: "500" },
  grid: { 
    display: "grid", 
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", 
    gap: "24px", 
    maxWidth: "1200px", 
    margin: "0 auto" 
  },
  card: {
    position: "relative",
    background: "rgba(25, 30, 56, 0.4)",
    backdropFilter: "blur(12px)",
    padding: "26px",
    borderRadius: "20px",
    border: "1px solid rgba(255, 255, 255, 0.05)",
    transition: "all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)",
  },
  top1Card: {
    border: "1px solid #f1c40f",
    boxShadow: "0 0 30px rgba(241, 196, 15, 0.15)",
    background: "linear-gradient(135deg, rgba(25, 30, 56, 0.6) 0%, rgba(241, 196, 15, 0.04) 100%)",
  },
  cardHover: { 
    transform: "translateY(-6px)", 
    border: "1px solid rgba(241, 196, 15, 0.5)", 
    boxShadow: "0 10px 20px rgba(0,0,0,0.3)"
  },
  playerHeader: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
    marginBottom: "15px"
  },
  avatar: {
    width: "48px",
    height: "48px",
    borderRadius: "50%",
    border: "2px solid",
    boxShadow: "0 4px 10px rgba(0,0,0,0.2)"
  },
  rankBadge: {
    position: "absolute", 
    top: "18px", 
    right: "18px", 
    fontSize: "12px", 
    fontWeight: "800",
    padding: "4px 14px", 
    borderRadius: "30px",
    letterSpacing: "0.5px"
  },
  name: { fontSize: "24px", fontWeight: "800", color: "#fff", marginBottom: "2px" },
  liveRank: { fontSize: "14px", color: "#3498db", fontWeight: "600" },
  liveLp: { color: "#aaa", fontWeight: "normal" },
  scoreContainer: {
    background: "rgba(0, 0, 0, 0.25)", 
    padding: "14px", 
    borderRadius: "12px", 
    textAlign: "center", 
    marginBottom: "16px",
    marginTop: "10px"
  },
  scoreLabel: { fontSize: "11px", color: "#8a9fc4", fontWeight: "700", letterSpacing: "1px", marginBottom: "4px" },
  divider: { height: "1px", background: "rgba(255,255,255,0.06)", margin: "16px 0" },
  statsContainer: { display: "flex", flexDirection: "column", gap: "12px" },
  statLine: { display: "flex", justifyContent: "space-between", fontSize: "13px" },
  statLabel: { color: "#8a9fc4" },
  statValue: { fontWeight: "700", color: "#fff" },
  startFooter: { 
    marginTop: "24px", 
    fontSize: "11px", 
    color: "#5d6d7e", 
    textAlign: "right", 
    fontWeight: "500" 
  }
};