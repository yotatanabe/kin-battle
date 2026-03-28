// src/components/NinjaAd.jsx
import React, { useEffect } from 'react';

export default function NinjaAd({ admaxId, position = 'bottom' }) {
  useEffect(() => {
    // 忍者AdMaxのスクリプトを安全に読み込む処理
    const script = document.createElement('script');
    script.src = "https://adm.shinobi.jp/st/t.js";
    script.async = true;
    script.charset = "utf-8";
    document.body.appendChild(script);

    return () => {
      // コンポーネントが消える時にスクリプトをお掃除する
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []);

  // ▼ 配置場所（position）によってCSSを切り替える ▼
  let containerClass = "w-full flex justify-center my-4"; // デフォルト（画面の下などに置く用）

  if (position === 'right') {
    // 【右端用】スマホ(md未満)では隠し、PC(md以上)で右端の中央に固定する
    containerClass = "hidden md:flex fixed right-2 top-1/2 -translate-y-1/2 z-[100] pointer-events-auto bg-black/50 p-2 rounded-xl backdrop-blur border border-slate-700 shadow-2xl";
  }

  return (
    <div className={containerClass}>
      {/* 忍者AdMaxの広告枠 */}
      <div className="admax-ads" data-admax-id={admaxId}></div>
    </div>
  );
}