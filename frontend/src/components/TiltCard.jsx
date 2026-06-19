import { useRef } from 'react';

export default function TiltCard({ children, className = '', ...props }) {
  const cardRef = useRef(null);

  const handleMouseMove = (e) => {
    if (!cardRef.current) return;
    const card = cardRef.current;
    const rect = card.getBoundingClientRect();
    
    // Mouse position relative to the card's dimensions
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Calculate rotation factors
    // Max rotation is +/- 6 degrees for a subtle and elegant feel (not extreme)
    const rX = ((y / rect.height) - 0.5) * -12;
    const rY = ((x / rect.width) - 0.5) * 12;
    
    // Direct DOM manipulation
    card.style.transform = `perspective(1000px) rotateX(${rX}deg) rotateY(${rY}deg) scale3d(1.015, 1.015, 1.015)`;
    card.style.setProperty('--mouse-x', `${(x / rect.width) * 100}%`);
    card.style.setProperty('--mouse-y', `${(y / rect.height) * 100}%`);
  };

  const handleMouseEnter = () => {
    if (!cardRef.current) return;
    const card = cardRef.current;
    card.style.transition = 'transform 0.05s ease-out';
    card.classList.add('shadow-md', 'border-command-accent/30');
    card.classList.remove('shadow-sm');
    
    const glare = card.querySelector('.glare-overlay');
    if (glare) {
      glare.style.opacity = '1';
    }
  };
  
  const handleMouseLeave = () => {
    if (!cardRef.current) return;
    const card = cardRef.current;
    card.style.transition = 'transform 0.6s cubic-bezier(0.25, 1, 0.5, 1)';
    card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
    card.style.setProperty('--mouse-x', '50%');
    card.style.setProperty('--mouse-y', '50%');
    card.classList.remove('shadow-md', 'border-command-accent/30');
    card.classList.add('shadow-sm');

    const glare = card.querySelector('.glare-overlay');
    if (glare) {
      glare.style.opacity = '0';
    }
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`transform-gpu relative overflow-hidden transition-shadow duration-300 shadow-sm ${className}`}
      style={{
        perspective: '1000px',
        rotateX: '0deg',
        rotateY: '0deg',
        scale3d: '1, 1, 1',
        transition: 'transform 0.6s cubic-bezier(0.25, 1, 0.5, 1)'
      }}
      {...props}
    >
      {/* Dynamic elegant glare effect (non-neon, soft white highlight reflection) */}
      <div 
        className="glare-overlay absolute inset-0 pointer-events-none transition-opacity duration-300 bg-[radial-gradient(circle_at_var(--mouse-x,50%)_var(--mouse-y,50%),rgba(255,255,255,0.06)_0%,transparent_60%)] opacity-0"
      />
      {children}
    </div>
  );
}
