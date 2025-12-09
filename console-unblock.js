// COLE ESTE CÓDIGO NO CONSOLE DO NAVEGADOR (F12)

// 1. Substitua pelos seus valores
const roomId = 'COLE_SEU_ROOM_ID_AQUI'; // Exemplo: '1n3Kz01FQGHWmWWxDO6J'
const playerId = 'COLE_SEU_PLAYER_ID_AQUI'; // Exemplo: 'u6IxQQHj0lMawivPSTFMgqVrkcW2'

// 2. Execute este código:
(async () => {
  try {
    // Importar do seu projeto
    const firebaseModule = await import('/src/lib/firebase.js');
    const firestoreModule = await import('firebase/firestore');
    
    const { db } = firebaseModule;
    const { doc, updateDoc } = firestoreModule;
    
    const playerRef = doc(db, 'rooms', roomId, 'players', playerId);
    await updateDoc(playerRef, { isBlocked: false });
    
    console.log('✅ Jogador desbloqueado com sucesso!');
  } catch (error) {
    console.error('❌ Erro:', error);
    console.log('💡 Tente pelo Firebase Console: https://console.firebase.google.com/');
  }
})();


