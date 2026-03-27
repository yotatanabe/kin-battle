// src/game/renderer.js の一部 (anim.active 内の描画)

// ... (既存の描画処理のあと、最後の anim.active のブロック内)

    if (p > 0.85) {
      const popP = (p - 0.85) / 0.15;
      const yOffset = (popP * -30) / cameraRef.current.scale;

      // --- 免疫細胞（マクロファージ）の襲来演出 ---
      anim.data.immuneAttacks.forEach(i => {
        const node = state.nodes.find(n => n.id === i.nodeId);
        if(!node || !visibleNodes.has(node.id)) return;
        
        // 白い円（免疫細胞）がノードを覆うような演出
        ctx.beginPath();
        ctx.arc(node.x, node.y, (40 + popP * 20) / cameraRef.current.scale, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${0.4 * (1 - popP)})`;
        ctx.fill();

        ctx.globalAlpha = 1 - popP; 
        drawStrokedText(`免疫襲来! -${i.damage || i.amount}`, node.x, node.y - 60/cameraRef.current.scale + yOffset, '#ffffff', 24); 
        ctx.globalAlpha = 1.0;
      });

      // --- アイテム獲得の演出 ---
      anim.data.items.forEach(itm => {
        const node = state.nodes.find(n => n.id === itm.nodeId);
        // nodeが見つからない場合はitm自体が持つ座標を使用する（フォールバック）
        const targetX = node ? node.x : itm.x;
        const targetY = node ? node.y : itm.y;

        if (itm.owner === myPlayerNum) { 
          ctx.globalAlpha = 1 - popP; 
          // チップの名前を表示
          const chipName = itm.chip || itm.subType;
          drawStrokedText(`GET: ${chipName}!`, targetX, targetY - 50/cameraRef.current.scale + yOffset, '#facc15', 20); 
          ctx.globalAlpha = 1.0; 
        }
      });

      // (既存のダメージ・ボーナス等の表示)
      anim.data.weatherDamages.forEach(w => { /* ... */ });
      anim.data.trashBonuses.forEach(b => { /* ... */ });
      anim.data.mines.forEach(m => { /* ... */ });
    }
