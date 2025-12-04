export function ScoreboardCard({
  players,
}: {
  players: { name: string; score: number; isYou?: boolean; isTurn?: boolean }[];
}) {
  const youPlayer = players.find(p => p.isYou);
  const isYourTurn = youPlayer?.isTurn;

  return (
    <div className="bg-emerald-900/40 backdrop-blur border-emerald-600/30 rounded-lg p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isYourTurn ? 'bg-green-400 animate-pulse' : 'bg-emerald-600'}`} />
          <span className="text-sm font-semibold text-white">
            {youPlayer?.name || 'Você'} (Você)
          </span>
          {isYourTurn && (
            <span className="text-xs text-emerald-300">Vez dele</span>
          )}
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-white">
            {youPlayer?.score || 0}
          </div>
          <span className="text-[10px] text-emerald-300">pontos</span>
        </div>
      </div>
    </div>
  );
}
