type Position = 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';

interface GoldCornerProps {
  position: Position;
}

export const GoldCorner = ({ position }: GoldCornerProps) => {
  const positions = {
    topLeft: 'top-0 left-0',
    topRight: 'top-0 right-0 rotate-90',
    bottomLeft: 'bottom-0 left-0 -rotate-90',
    bottomRight: 'bottom-0 right-0 rotate-180'
  };

  return (
    <div className={`absolute ${positions[position]} w-8 h-8 pointer-events-none`}>
      <svg viewBox="0 0 32 32" className="w-full h-full">
        <path d="M0,0 L32,0 L32,2 L2,2 L2,32 L0,32 Z" fill="currentColor" className="text-accent" opacity="0.7"/>
        <path d="M0,8 L8,8 L8,0" stroke="currentColor" className="text-accent" strokeWidth="1" fill="none" opacity="0.5"/>
      </svg>
    </div>
  );
};
