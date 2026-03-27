// src/hooks/usePeerRTC.js
import { useRef, useCallback } from 'react';
import { Peer } from 'peerjs';

export function usePeerRTC(onMessageReceived, onPeerError) {
  const peerRef = useRef(null);
  const connectionsRef = useRef([]);

  // 通信を安定させるためのSTUNサーバー設定
  const peerOptions = {
    config: {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:global.stun.twilio.com:3478' }
      ]
    }
  };

  // 全員にメッセージを送信する関数
  const sendMessage = useCallback((msg) => {
    connectionsRef.current.forEach(conn => {
      if (conn && conn.open) {
        try {
          conn.send(msg);
        } catch(err) {
          console.error('Send message failed', err);
        }
      }
    });
  }, []);

  // 通信の通り道（データチャネル）を設定する関数
  const setupDataChannel = useCallback((conn, isClientSide, onOpenCallback) => {
    connectionsRef.current.push(conn);
    
    conn.on('open', () => {
      if (isClientSide && onOpenCallback) onOpenCallback();
    });
    
    conn.on('data', (data) => {
      const parsed = typeof data === 'string' ? JSON.parse(data) : data;
      if (onMessageReceived) onMessageReceived(parsed);
    });
    
    conn.on('close', () => {
       connectionsRef.current = connectionsRef.current.filter(c => c !== conn);
    });
  }, [onMessageReceived]);

  // ホスト（部屋主）として待機を開始する関数
  const initHost = useCallback((roomId, onOpen) => {
    connectionsRef.current = [];
    const peer = new Peer(`kin-battle-${roomId}`, peerOptions);
    peerRef.current = peer;
    
    peer.on('open', onOpen);
    peer.on('connection', (conn) => setupDataChannel(conn, false));
    peer.on('error', onPeerError);
  }, [onPeerError, setupDataChannel]);

  // クライアント（参加者）として部屋に接続する関数
  const initClient = useCallback((targetId, onOpenCallback) => {
    connectionsRef.current = [];
    const peer = new Peer(peerOptions);
    peerRef.current = peer;
    
    peer.on('open', () => {
      const conn = peer.connect(`kin-battle-${targetId}`);
      setupDataChannel(conn, true, onOpenCallback);
    });
    
    peer.on('error', onPeerError);
  }, [onPeerError, setupDataChannel]);

  // 通信を完全に切断・破棄する関数
  const destroyPeer = useCallback(() => {
    if (peerRef.current) peerRef.current.destroy();
    connectionsRef.current.forEach(c => c.close());
    connectionsRef.current = [];
  }, []);

  return { 
    sendMessage, 
    initHost, 
    initClient, 
    destroyPeer, 
    connectionsRef 
  };
}