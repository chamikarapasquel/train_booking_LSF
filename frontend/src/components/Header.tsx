import React from 'react';

const Header: React.FC = () => (
  <header className="header">
    <div className="container header-inner">
      <a href="/" className="header-logo">
        <span className="header-logo-icon">🚂</span>
        <span>
          <span className="header-logo-text">Lanka Scenic Rail</span>
          <span className="header-logo-sub">Colombo Fort → Badulla</span>
        </span>
      </a>
      <span className="header-badge">Segment Booking</span>
    </div>
  </header>
);

export default Header;
