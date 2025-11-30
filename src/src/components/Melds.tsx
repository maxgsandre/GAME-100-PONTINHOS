import { MeldDoc } from '../lib/firestoreGame';
import { CardComponent } from './CardComponent';
import { Player } from '../lib/firestoreGame';

interface MeldsProps {
  melds: MeldDoc[];
  players: Player[];
}

export function Melds({ melds, players }: MeldsProps) {
  if (melds.length === 0) {
    return null;
  }

  const getPlayerName = (uid: string) => {
    const player = players.find(p => p.id === uid);
    return player?.name || 'Jogador';
  };

  return (
    <div className="bg-white rounded-lg p-4 shadow-md">
      <h3 className="mb-3 text-gray-700">Combinações Baixadas</h3>
      <div className="space-y-3">
        {melds.map((meld) => (
          <div key={meld.id} className="border border-gray-200 rounded p-2">
            <p className="text-xs text-gray-600 mb-2">
              {getPlayerName(meld.ownerUid)} - {meld.type === 'sequence' ? 'Sequência' : 'Trinca'}
            </p>
            <div className="flex gap-1 flex-wrap">
              {meld.cards.map((card, index) => (
                <CardComponent
                  key={`${card}-${index}`}
                  card={card}
                  size="small"
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
