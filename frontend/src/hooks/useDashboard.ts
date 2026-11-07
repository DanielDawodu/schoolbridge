import { useEffect, useState } from 'react';
import api from '../services/api';

interface DashboardStats {
  totalStudents: number;
  totalClasses: number;
  attendanceSummary?: {
    present: number;
    absent: number;
    late: number;
    unmarked?: number;
    totalMarked: number;
  };
  feesSummary?: {
    totalExpected: number;
    totalCollected: number;
    totalOutstanding: number;
    totalCredit?: number;
  };
}

export const useDashboard = () => {
  const [data, setData] = useState<DashboardStats | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await api.get('/dashboard/stats');
        setData(res.data);
      } catch (err) {
        setError(err);
        console.error('useDashboard error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  return { data, isLoading, error };
};

