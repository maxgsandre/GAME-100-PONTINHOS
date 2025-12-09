// Script temporário para desbloquear um jogador
// Uso: node unblock-player.js <roomId> <playerId>

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, updateDoc, getDoc } from 'firebase/firestore';

// Configuração do Firebase (copie do seu firebase.ts)
const firebaseConfig = {
  // Cole aqui as configurações do seu firebase.ts
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function unblockPlayer(roomId, playerId) {
  try {
    const playerRef = doc(db, 'rooms', roomId, 'players', playerId);
    
    // Verificar se o jogador existe
    const playerDoc = await getDoc(playerRef);
    if (!playerDoc.exists()) {
      console.error('❌ Jogador não encontrado');
      return;
    }
    
    const playerData = playerDoc.data();
    console.log('📋 Estado atual do jogador:', {
      name: playerData.name,
      isBlocked: playerData.isBlocked || false
    });
    
    // Desbloquear o jogador
    await updateDoc(playerRef, {
      isBlocked: false
    });
    
    console.log('✅ Jogador desbloqueado com sucesso!');
  } catch (error) {
    console.error('❌ Erro ao desbloquear jogador:', error);
  }
}

// Pegar argumentos da linha de comando
const roomId = process.argv[2];
const playerId = process.argv[3];

if (!roomId || !playerId) {
  console.log('Uso: node unblock-player.js <roomId> <playerId>');
  console.log('Exemplo: node unblock-player.js abc123 user123');
  process.exit(1);
}

unblockPlayer(roomId, playerId);


