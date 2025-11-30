import { Card, getCardDisplay, getCardColor } from '../lib/deck';

interface CardComponentProps {
  card: Card;
  selected?: boolean;
  onClick?: () => void;
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
}

export function CardComponent({ card, selected, onClick, size = 'medium', disabled }: CardComponentProps) {
  const display = getCardDisplay(card);
  const color = getCardColor(card);

  const sizeClasses = {
    small: 'w-12 h-16 text-xs',
    medium: 'w-16 h-24 text-base',
    large: 'w-20 h-28 text-lg',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        ${sizeClasses[size]}
        bg-white rounded-lg shadow-md border-2 
        ${selected ? 'border-blue-500 -translate-y-2' : 'border-gray-300'}
        ${onClick && !disabled ? 'hover:border-blue-400 hover:-translate-y-1 cursor-pointer' : ''}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        ${color === 'red' ? 'text-red-600' : 'text-gray-900'}
        transition-all duration-200 flex items-center justify-center
        active:scale-95
      `}
    >
      <span className="select-none">{display}</span>
    </button>
  );
}
