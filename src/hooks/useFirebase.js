// src/hooks/useFirebase.js
import { useState, useEffect, useRef } from 'react';
import { database } from '../config/firebase';
import firebase from 'firebase/compat/app';

export function useFirebase(myUid, gameMode, isPrivate) {
  const [playerStats, setPlayerStats] = useState({ wins: 0, losses: 0 });
  const [roomList, setRoomList] = useState([]);
  const [topPlayers, setTopPlayers] = useState([]); // ★ 追加：ランキングデータ
  const latestHostDataRef = useRef(null);
  const statsUpdatedRef = useRef(false);

  // 1. プレイヤーの戦績（勝敗）をリアルタイム取得
  useEffect(() => {
    if (!myUid) return;
    const statsRef = database.ref(`users/${myUid}/stats`);
    statsRef.on('value', (snapshot) => {
      if (snapshot.val()) {
        setPlayerStats({
          wins: snapshot.val().wins || 0,
          losses: snapshot.val().losses || 0
        });
      }
    });
    return () => statsRef.off();
  }, [myUid]);

  // 2. ロビーの部屋一覧をリアルタイム取得（1分以上更新がない部屋は弾く）
  useEffect(() => {
    const roomsRef = database.ref('rooms');
    roomsRef.on('value', (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const loadedRooms = Object.values(data).filter(r => (Date.now() - r.lastUpdated) < 60000);
        setRoomList(loadedRooms);
      } else {
        setRoomList([]);
      }
    });
    return () => roomsRef.off();
  }, []);

  // 3. ホストが自分の部屋情報をFirebaseに書き込む関数
  const updateFirebaseRoom = (data) => {
    if (isPrivate || !data) return;
    database.ref(`rooms/${data.roomId}`).set({
      ...data,
      lastUpdated: firebase.database.ServerValue.TIMESTAMP
    });
  };

  const setRoomDisconnectRules = (roomId) => {
    if (isPrivate || !roomId) return;
    database.ref(`rooms/${roomId}`).onDisconnect().remove();
  };

  // 4. ホスト中、3秒ごとに部屋の「生存報告」を送信する
  useEffect(() => {
    let interval;
    if (gameMode === 'HOST' && latestHostDataRef.current) {
      interval = setInterval(() => {
        updateFirebaseRoom(latestHostDataRef.current);
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [gameMode, isPrivate]);

  // 5. ゲーム終了時に戦績を記録する関数
  const recordGameResult = (isWin, isDraw) => {
    if (statsUpdatedRef.current) return;
    statsUpdatedRef.current = true;
    
    if (!isDraw) {
      const updates = {};
      if (isWin) {
        updates['wins'] = firebase.database.ServerValue.increment(1);
      } else {
        updates['losses'] = firebase.database.ServerValue.increment(1);
      }
      database.ref(`users/${myUid}/stats`).update(updates);
    }
  };

  // 6. 戦績更新フラグのリセットと部屋の削除
  const resetStatsFlag = () => { statsUpdatedRef.current = false; };
  const removeRoom = (roomId) => { if (roomId) database.ref(`rooms/${roomId}`).remove(); };

  // ★ 追加：名前をFirebaseに保存する関数
  const updatePlayerNameFirebase = (name) => {
    if (!myUid || !name) return;
    database.ref(`users/${myUid}/name`).set(name);
  };

  // ★ 追加：勝利数ランキングTop5を取得する関数
  useEffect(() => {
    // 勝利数(wins)が多い順に取得するクエリ
    const usersRef = database.ref('users').orderByChild('stats/wins').limitToLast(5);
    usersRef.on('value', (snapshot) => {
      const players = [];
      snapshot.forEach((childSnapshot) => {
        const data = childSnapshot.val();
        if (data && data.stats && data.stats.wins > 0) {
          players.push({
            uid: childSnapshot.key,
            name: data.name || '名無しバクテリア',
            wins: data.stats.wins
          });
        }
      });
      // Firebaseは昇順で返してくるので、勝利数が多い順（降順）に並べ替える
      players.sort((a, b) => b.wins - a.wins);
      setTopPlayers(players);
    });
    return () => usersRef.off();
  }, []);

  // ==========================================
  // ▼ 追加：リロード対策（バックアップ機能）
  // ==========================================
  const backupRoomState = (roomId, state, data) => {
    if (!roomId || !state || !data) return;
    database.ref(`rooms/${roomId}/backup`).set({ gameState: state, gameData: data });
  };

  const fetchRoomState = async (roomId) => {
    const snapshot = await database.ref(`rooms/${roomId}/backup`).once('value');
    return snapshot.val(); // { gameState, gameData } が返る
  };

  const clearRoomState = (roomId) => {
    if (roomId) database.ref(`rooms/${roomId}/backup`).remove();
  };
  // ==========================================

  return {
    playerStats,
    roomList,
    topPlayers, // ★ 追加
    latestHostDataRef,
    recordGameResult,
    resetStatsFlag,
    updateFirebaseRoom,
    removeRoom,
    setRoomDisconnectRules,
    backupRoomState,
    fetchRoomState,
    clearRoomState,
    updatePlayerNameFirebase // ★ 追加
  };
}