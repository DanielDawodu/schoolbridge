import React, { useState, useEffect } from 'react';
import api from '../services/api';
import {
  Award,
  Plus,
  Trash2,
  RotateCcw,
  Save,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Info,
} from 'lucide-react';

interface GradeTier {
  min: number;
  max: number;
  grade: string;
  description: string;
}

const DEFAULT_GRADE_SCALE: GradeTier[] = [
  { min: 70, max: 100, grade: 'A', description: 'Distinction' },
  { min: 60, max: 69, grade: 'B', description: 'Very Good' },
  { min: 50, max: 59, grade: 'C', description: 'Good' },
  { min: 45, max: 49, grade: 'D', description: 'Credit' },
  { min: 40, max: 44, grade: 'E', description: 'Pass' },
  { min: 0, max: 39, grade: 'F', description: 'Fail' },
];

export const GradingSystem: React.FC = () => {
  const [gradeScale, setGradeScale] = useState<GradeTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchGradeScale = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/schools/grade-scale');
      if (res.data && Array.isArray(res.data) && res.data.length > 0) {
        setGradeScale(res.data);
      } else {
        setGradeScale(DEFAULT_GRADE_SCALE);
      }
    } catch (err: any) {
      console.error('Failed to load grade scale:', err);
      setError(err.response?.data?.error || 'Failed to load grade scale');
      setGradeScale(DEFAULT_GRADE_SCALE);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGradeScale();
  }, []);

  const handleTierChange = (index: number, field: keyof GradeTier, value: any) => {
    const updated = [...gradeScale];
    if (field === 'min' || field === 'max') {
      const num = Number(value);
      updated[index] = { ...updated[index], [field]: isNaN(num) ? 0 : num };
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    setGradeScale(updated);
  };

  const handleAddTier = () => {
    setGradeScale([
      ...gradeScale,
      { min: 0, max: 0, grade: '', description: '' },
    ]);
  };

  const handleRemoveTier = (index: number) => {
    if (gradeScale.length <= 1) {
      setError('You must maintain at least one grade tier.');
      return;
    }
    const updated = gradeScale.filter((_, i) => i !== index);
    setGradeScale(updated);
  };

  const validateScale = (scale: GradeTier[]): string | null => {
    if (!scale || scale.length === 0) {
      return 'At least one grade tier must be defined.';
    }

    for (let i = 0; i < scale.length; i++) {
      const tier = scale[i];
      if (!tier.grade.trim()) {
        return `Tier #${i + 1} has an empty grade label.`;
      }
      if (tier.min < 0 || tier.max > 100) {
        return `Tier ${tier.grade} has boundaries outside 0-100 range (${tier.min} - ${tier.max}).`;
      }
      if (tier.min > tier.max) {
        return `Tier ${tier.grade}: Minimum score (${tier.min}) cannot be greater than maximum score (${tier.max}).`;
      }
    }

    // Sort descending by max for overlap check
    const sorted = [...scale].sort((a, b) => b.max - a.max);
    for (let i = 0; i < sorted.length - 1; i++) {
      const current = sorted[i];
      const next = sorted[i + 1];
      if (current.min <= next.max) {
        return `Overlap detected between grade ${current.grade} (${current.min}-${current.max}) and grade ${next.grade} (${next.min}-${next.max}).`;
      }
    }

    return null;
  };

  const handleSave = async () => {
    const valError = validateScale(gradeScale);
    if (valError) {
      setError(valError);
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      // Sort descending by max before saving
      const sorted = [...gradeScale].sort((a, b) => b.max - a.max);
      const res = await api.put('/schools/grade-scale', { gradeScale: sorted });
      setGradeScale(res.data?.gradeScale || sorted);
      setSuccess('Grading system updated successfully! All subsequent result evaluations will use this scale.');
    } catch (err: any) {
      console.error('Save grade scale error:', err);
      setError(err.response?.data?.error || 'Failed to save grade scale');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm('Are you sure you want to restore the default standard Nigerian 6-tier grading scale (A, B, C, D, E, F)?')) {
      return;
    }

    try {
      setResetting(true);
      setError(null);
      setSuccess(null);

      const res = await api.post('/schools/grade-scale/reset');
      setGradeScale(res.data?.gradeScale || DEFAULT_GRADE_SCALE);
      setSuccess('Default 6-tier grading scale restored successfully.');
    } catch (err: any) {
      console.error('Reset grade scale error:', err);
      setError(err.response?.data?.error || 'Failed to restore default grading scale');
    } finally {
      setResetting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-3 text-gray-500">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span>Loading grading system...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2.5">
            <Award className="w-7 h-7 text-indigo-600" />
            School Grading System
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Configure score ranges, letter grades, and academic remarks used across report cards and result sheets.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleReset}
            disabled={resetting || saving}
            className="inline-flex items-center gap-2 px-3.5 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Restore Defaults</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving || resetting}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow-xs disabled:opacity-50 transition-colors"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{saving ? 'Saving...' : 'Save Grading Scale'}</span>
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 text-sm text-red-800">{error}</div>
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 text-sm text-green-800">{success}</div>
        </div>
      )}

      {/* Grading Table Card */}
      <div className="bg-white rounded-xl shadow-xs border border-gray-200 overflow-hidden">
        <div className="p-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-700 uppercase tracking-wider">
            <span>Configured Grade Boundaries (0 - 100%)</span>
          </div>

          <button
            type="button"
            onClick={handleAddTier}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 rounded-md text-xs font-medium transition-colors shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Range</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase">
              <tr>
                <th className="py-3 px-4 w-12 text-center">#</th>
                <th className="py-3 px-4 w-32">Grade</th>
                <th className="py-3 px-4 w-32">Min Score (%)</th>
                <th className="py-3 px-4 w-32">Max Score (%)</th>
                <th className="py-3 px-4">Remark / Description</th>
                <th className="py-3 px-4 w-20 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {gradeScale.map((tier, idx) => (
                <tr key={idx} className="hover:bg-gray-50/60 transition-colors">
                  <td className="py-3 px-4 text-center text-xs font-bold text-gray-400">
                    {idx + 1}
                  </td>
                  <td className="py-3 px-4">
                    <input
                      type="text"
                      maxLength={4}
                      value={tier.grade}
                      onChange={(e) => handleTierChange(idx, 'grade', e.target.value.toUpperCase())}
                      placeholder="e.g. A"
                      className="w-20 px-2.5 py-1.5 font-bold uppercase text-center border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </td>
                  <td className="py-3 px-4">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={tier.min}
                      onChange={(e) => handleTierChange(idx, 'min', e.target.value)}
                      className="w-24 px-2.5 py-1.5 text-center border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </td>
                  <td className="py-3 px-4">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={tier.max}
                      onChange={(e) => handleTierChange(idx, 'max', e.target.value)}
                      className="w-24 px-2.5 py-1.5 text-center border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </td>
                  <td className="py-3 px-4">
                    <input
                      type="text"
                      value={tier.description}
                      onChange={(e) => handleTierChange(idx, 'description', e.target.value)}
                      placeholder="e.g. Excellent, Very Good, Distinction"
                      className="w-full px-2.5 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </td>
                  <td className="py-3 px-4 text-center">
                    <button
                      type="button"
                      onClick={() => handleRemoveTier(idx)}
                      disabled={gradeScale.length <= 1}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors disabled:opacity-30 disabled:pointer-events-none"
                      title="Remove Tier"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Informational Footer */}
        <div className="p-4 bg-gray-50 border-t border-gray-200 flex items-start gap-3 text-xs text-gray-600">
          <Info className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-gray-800">Grading Rules & System Behavior:</p>
            <ul className="list-disc pl-4 space-y-0.5 text-gray-600">
              <li>Scores are inclusive of both minimum and maximum boundaries.</li>
              <li>Tiers must not overlap. The entire expected score range (0% to 100%) should be covered without gaps.</li>
              <li>When calculating grades on student report cards and result sheets, the system queries this configured scale dynamically.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GradingSystem;

