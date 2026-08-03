import React, { useEffect, useState } from 'react';
import { fetchAdminStats, AdminStats } from '../api/client';

export const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const loadStats = async () => {
      try {
        const data = await fetchAdminStats();
        if (mounted) {
          setStats(data);
          setLoading(false);
        }
      } catch (err: any) {
        if (mounted) {
          setError(err.message || 'Failed to fetch admin stats');
          setLoading(false);
        }
      }
    };
    loadStats();
    return () => { mounted = false; };
  }, []);

  if (loading) {
    return <div className="admin-loading">Loading stats...</div>;
  }

  if (error) {
    return <div className="admin-error">Error: {error}</div>;
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR' }).format(amount);
  };

  const occupancy = stats && stats.totalSeats > 0
    ? ((stats.activeBookings / stats.totalSeats) * 100).toFixed(1)
    : 0;

  return (
    <div className="admin-dashboard">
      <h2 className="admin-title">Department Overview</h2>
      <div className="admin-grid">
        <div className="admin-card">
          <div className="admin-card-label">Total Revenue</div>
          <div className="admin-card-value">{stats ? formatCurrency(stats.totalRevenue) : '-'}</div>
        </div>
        <div className="admin-card">
          <div className="admin-card-label">Active Bookings</div>
          <div className="admin-card-value">{stats?.activeBookings ?? '-'}</div>
        </div>
        <div className="admin-card">
          <div className="admin-card-label">Current Occupancy Rate</div>
          <div className="admin-card-value">{occupancy}%</div>
          <div className="admin-card-subtext">Based on {stats?.totalSeats} total seats</div>
        </div>
        <div className="admin-card">
          <div className="admin-card-label">Waitlisted Passengers</div>
          <div className="admin-card-value">{stats?.waitlistedPassengers ?? '-'}</div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
