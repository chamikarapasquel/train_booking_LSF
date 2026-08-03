import React from 'react';

interface HeaderProps {
  onToggleAdmin?: () => void;
  isAdminView?: boolean;
}

const Header: React.FC<HeaderProps> = ({ onToggleAdmin, isAdminView }) => (
  <header className="header">
    <div className="container header-inner">
      <a href="/" className="header-logo">
        <span className="header-logo-icon">🚂</span>
        <span>
          <span className="header-logo-text">Lanka Scenic Rail</span>
          <span className="header-logo-sub">Colombo Fort → Badulla</span>
        </span>
      </a>
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <span className="header-badge">Segment Booking</span>
        {onToggleAdmin && (
          <button 
            className="btn btn-outline" 
            style={{ padding: '0.25rem 0.75rem', fontSize: '0.875rem', background: 'transparent' }}
            onClick={onToggleAdmin}
          >
            {isAdminView ? 'Passenger View' : 'Admin View'}
          </button>
        )}
      </div>
    </div>
  </header>
);

export default Header;
