import { Card } from '../lib/deck';
import { CardComponent } from './CardComponent';

interface DiscardProps {
  topCard: Card | null;
  onDraw?: () => void;
  disabled?: boolean;
}

export function Discard({ topCard, onDraw, disabled }: DiscardProps) {
  if (!topCard) {
    return (
      <div className="flex flex-col items-center gap-2">
        <div className="w-20 h-28 rounded-lg border-2 border-dashed border-gray-400 bg-gray-100 flex items-center justify-center">
          <span className="text-gray-400 text-xs">Vazio</span>
        </div>
        <p className="text-xs text-gray-600">Descarte</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        onClick={!disabled ? onDraw : undefined}
        className={!disabled ? 'cursor-pointer' : ''}
      >
        <CardComponent
          card={topCard}
          size="large"
          onClick={onDraw}
          disabled={disabled}
        />
      </div>
      <p className="text-xs text-gray-600">Descarte</p>
    </div>
  );
}
