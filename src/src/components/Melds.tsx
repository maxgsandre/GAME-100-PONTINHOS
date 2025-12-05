import { MeldDoc } from '../lib/firestoreGame';
import { CardComponent } from './CardComponent';
import { Player } from '../lib/firestoreGame';
import { Card } from '../lib/deck';
import { canAddCardToMeld } from '../lib/rules';
import { Meld } from '../lib/rules';

interface MeldsProps {
  melds: MeldDoc[];
  players: Player[];
  hand?: Card[];
  isMyTurn?: boolean;
  onAddCardToMeld?: (meldId: string, card: Card) => void;
}

export function Melds({ melds, players, hand = [], isMyTurn = false, onAddCardToMeld }: MeldsProps) {
  if (melds.length === 0) {
    return null;
  }

  const getPlayerName = (uid: string) => {
    const player = players.find(p => p.id === uid);
    return player?.name || 'Jogador';
  };

  const handleCardClick = (meldId: string, card: Card) => {
    if (!isMyTurn || !onAddCardToMeld) return;
    
    const meld = melds.find(m => m.id === meldId);
    if (!meld) return;

    const meldObj: Meld = {
      type: meld.type,
      cards: meld.cards,
    };

    if (canAddCardToMeld(card, meldObj)) {
      onAddCardToMeld(meldId, card);
    }
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
            {isMyTurn && hand.length > 0 && (
              <div className="mt-2 pt-2 border-t border-gray-200">
                <p className="text-xs text-gray-500 mb-1">Clique em uma carta da sua mão para adicionar:</p>
                <div className="flex gap-1 flex-wrap">
                  {hand.map((card) => {
                    const meldObj: Meld = {
                      type: meld.type,
                      cards: meld.cards,
                    };
                    const canAdd = canAddCardToMeld(card, meldObj);
                    return (
                      <button
                        key={card}
                        onClick={() => handleCardClick(meld.id, card)}
                        disabled={!canAdd}
                        className={`${canAdd ? 'opacity-100 hover:scale-110 cursor-pointer' : 'opacity-30 cursor-not-allowed'} transition-transform`}
                        title={canAdd ? 'Clique para adicionar' : 'Não pode adicionar esta carta'}
                      >
                        <CardComponent
                          card={card}
                          size="small"
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
