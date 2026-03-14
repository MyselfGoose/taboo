export function connectionVariant(connectionState) {
  if (connectionState === "connected") return "success";
  if (connectionState === "connecting" || connectionState === "reconnecting")
    return "warning";
  return "danger";
}

export function teamColors(team) {
  return team === "A"
    ? {
        bg: "bg-[#1e3a5f]/20",
        border: "border-[#3b6ca8]",
        borderFaint: "border-[#1e3a5f]/20",
        dot: "bg-[#3b6ca8]",
        dotPulse: "bg-[#3b6ca8] animate-pulse",
        iconBg: "bg-[#1e3a5f]/30",
        iconText: "text-[#4a7dbb]",
        gradientFrom: "from-[#1e3a5f]/10",
        avatarBg: "bg-[#3b6ca8]",
        highlight: "bg-[#3b6ca8]/20",
        text: "text-[#4a7dbb]",
        label: "Alpha",
        pillBg: "bg-[#1e3a5f]/30",
        pillBorder: "border-[#3b6ca8]/30",
        pillText: "text-[#4a7dbb]",
        scoreBg: "bg-[#1e3a5f]/20 border-[#3b6ca8]/40",
        activeScoreBg: "bg-[#1e3a5f]/20 border-[#3b6ca8]/40",
        inactiveScoreBg: "bg-white/[0.03] border-white/[0.06]",
        youText: "text-[#4a7dbb]",
      }
    : {
        bg: "bg-[#b73b3b]/20",
        border: "border-[#c94d4d]",
        borderFaint: "border-[#b73b3b]/20",
        dot: "bg-[#c94d4d]",
        dotPulse: "bg-[#c94d4d] animate-pulse",
        iconBg: "bg-[#b73b3b]/30",
        iconText: "text-[#c94d4d]",
        gradientFrom: "from-[#b73b3b]/10",
        avatarBg: "bg-[#c94d4d]",
        highlight: "bg-[#c94d4d]/20",
        text: "text-[#da5e5e]",
        label: "Beta",
        pillBg: "bg-[#b73b3b]/30",
        pillBorder: "border-[#c94d4d]/30",
        pillText: "text-[#da5e5e]",
        scoreBg: "bg-[#b73b3b]/20 border-[#c94d4d]/40",
        activeScoreBg: "bg-[#b73b3b]/20 border-[#c94d4d]/40",
        inactiveScoreBg: "bg-white/[0.03] border-white/[0.06]",
        youText: "text-[#c94d4d]",
      };
}

export function teamToneClasses(team) {
  const colors = teamColors(team);

  return {
    panel: `${colors.scoreBg} border`,
    strong: colors.text,
  };
}
