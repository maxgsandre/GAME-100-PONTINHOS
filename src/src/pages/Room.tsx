import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Room as RoomType, subscribeToRoom } from '../lib/firestoreGame';
import { Lobby } from '../components/Lobby';
import { Table } from '../components/Table';
import { RoundEnd } from '../components/RoundEnd';
import { useAppStore } from '../app/store';

export function Room() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const userId = useAppStore(state => state.userId);
  const [room, setRoom] = useState<RoomType | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!roomId || !userId) {
      navigate('/');
      return;
    }

    const unsubscribe = subscribeToRoom(roomId, (roomData) => {
      setRoom(roomData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [roomId, userId, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando sala...</p>
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <h2 className="text-gray-700 mb-4">Sala não encontrada</h2>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            Voltar ao Início
          </button>
        </div>
      </div>
    );
  }

  if (room.status === 'lobby') {
    return <Lobby room={room} />;
  }

  if (room.status === 'playing') {
    return <Table room={room} />;
  }

  if (room.status === 'roundEnd') {
    return <RoundEnd room={room} />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <p className="text-gray-600">Estado desconhecido da sala</p>
    </div>
  );
}
