// src/components/OccupationMeter.jsx
import React, { useMemo } from 'react';
import { getTeam } from '../game/utils';

export default function OccupationMeter({ gameState, myPlayerNum, bottomPanelHeight }) {
  if (!gameState) return null;

  const isTeam = gameState.isTeamBattle;
  const targetCount = isTeam ? 15 : 10;
  const myTeam = getTeam(myPlayerNum, isTeam);

  const { myCount, maxEnemyCount } = useMemo(() => {
    let myCount = 0;
    let maxEnemyCount = 0;

    if (isTeam) {
      let enemyTeamCount = 0;
      gameState.nodes.forEach(n => {
        if (n.owner === 0) return;
        if (getTeam(n.owner, true) === myTeam) myCount++;
        else enemyTeamCount++;
      });
      maxEnemyCount = enemyTeamCount;
    } else {
      const enemyMap = {};
      gameState.nodes.forEach(n => {
        if (n.owner === 0) return;
        if (n.owner === myPlayerNum) myCount++;
        else enemyMap[n.owner] = (enemyMap[n.owner] || 0) + 1;
      });
      maxEnemyCount = Object.keys(enemyMap).length > 0 ? Math.max(...Object.values(enemyMap)) : 0;
    }
    return { myCount, maxEnemyCount };
  }, [gameState.nodes, isTeam, myTeam, myPlayerNum]);

  const myProgress = Math.min((myCount / targetCount) * 100, 100);
  const enemyProgress = Math.min((maxEnemyCount / targetCount) * 100, 100);

  const playerColors = {
    1: 'from-blue-600 to-blue-400',
    2: 'from-red-600 to-red-400',
    3: 'from-green-600 to-green-400',
    4: 'from-yellow-600 to-yellow-400',
  };
  const myColorClass = playerColors[myPlayerNum] || 'from-slate-600 to-slate-400';

  return (
    <div
        className="absolute left-2 md:left-6 bottom-2 md:bottom-6 pointer-events-none w-[90vw] max-w-[300px] md:max-w-md z-[60]"
        /* ★ 修正：不要になった style の計算式をまるごと削除しました！ */
    >
      <div className="pointer-events-none flex flex-col gap-1.5 w-full">
        
        {/* ===== 自分の進捗メーター（メイン） ===== */}
        <div>
          <div className="flex justify-between items-end mb-1 px-1">
            <span className="text-white text-xs md:text-sm font-black tracking-widest drop-shadow-md">組織支配率</span>
            <span className="text-white text-lg md:text-2xl font-black italic tabular-nums drop-shadow-md">
              {myCount} <span className="text-xs md:text-sm not-italic opacity-70">/ {targetCount}</span>
            </span>
          </div>
          <div className="h-3 md:h-4 w-full bg-black/60 rounded-full border border-white/20 backdrop-blur-sm overflow-hidden p-[2px]">
            <div 
              className={`h-full rounded-full bg-gradient-to-r ${myColorClass} transition-[width] duration-1000 ease-out relative shadow-[0_0_10px_rgba(255,255,255,0.3)]`}
              style={{ width: `${myProgress}%` }}
            >
              <div className="absolute right-0 top-0 h-full w-4 bg-white/40 blur-sm"></div>
            </div>
          </div>
        </div>

        {/* ===== トップの敵の進捗メーター（サブ） ===== */}
        <div>
          <div className="flex justify-between items-end mb-0.5 px-1 opacity-80">
            <span className="text-red-300 text-[10px] md:text-xs font-bold tracking-wider drop-shadow-md">最大敵勢力</span>
            <span className="text-red-300 text-xs md:text-sm font-bold italic tabular-nums drop-shadow-md">
              {maxEnemyCount} <span className="text-[10px] not-italic opacity-70">/ {targetCount}</span>
            </span>
          </div>
          <div className="h-1.5 md:h-2 w-full bg-black/60 rounded-full border border-red-500/20 overflow-hidden p-[1px]">
            <div 
              className="h-full rounded-full bg-gradient-to-r from-red-800 to-red-500 transition-[width] duration-1000 ease-out relative"
              style={{ width: `${enemyProgress}%` }}
            ></div>
          </div>
        </div>

        {/* ===== 状況に応じた警告/チャンス表示 ===== */}
        <div className="h-4 flex flex-col justify-center items-center mt-1">
          {maxEnemyCount >= (targetCount - 2) && maxEnemyCount < targetCount && (
            <span className="text-red-500 text-[10px] md:text-xs font-black tracking-tighter animate-pulse drop-shadow-[0_0_5px_rgba(239,68,68,0.8)]">⚠️ 敵勢力が臨界支配直前</span>
          )}
          {myCount >= (targetCount - 2) && myCount < targetCount && maxEnemyCount < (targetCount - 2) && (
            <span className="text-cyan-400 text-[10px] md:text-xs font-black tracking-tighter animate-pulse drop-shadow-[0_0_5px_rgba(34,211,238,0.8)]">✨ 全身支配まであと少し</span>
          )}
        </div>
      </div>
    </div>
  );
}