import { Card, getCardDisplay, getCardColor } from '../lib/deck';

interface CardComponentProps {
  card: Card;
  selected?: boolean;
  onClick?: () => void;
  size?: 'tiny' | 'small' | 'medium' | 'large';
  disabled?: boolean;
}

export function CardComponent({ card, selected, onClick, size = 'medium', disabled }: CardComponentProps) {
  const display = getCardDisplay(card);
  const color = getCardColor(card);

  const sizeClasses = {
    tiny: 'w-8 h-11 md:w-10 md:h-14 lg:w-12 lg:h-16 text-[10px] md:text-xs lg:text-sm',
    small: 'w-12 h-16 md:w-16 md:h-20 lg:w-20 lg:h-28 text-xs md:text-sm lg:text-base',
    medium: 'w-16 h-24 md:w-20 md:h-28 lg:w-24 lg:h-36 text-base md:text-lg lg:text-xl',
    large: 'w-20 h-28 md:w-24 md:h-36 lg:w-28 lg:h-40 text-lg md:text-xl lg:text-2xl',
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
