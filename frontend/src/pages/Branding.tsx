import React, { useState, useEffect } from 'react';
import api from '../services/api';
import DocumentHeader from '../components/DocumentHeader';
import {
  Upload,
  Building2,
  Phone,
  Mail,
  Globe,
  Quote,
  MapPin,
  CheckCircle,
  AlertCircle,
  Trash2,
  RefreshCw,
  Image as ImageIcon,
} from 'lucide-react';

export const Branding: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    address: '',
    phone: '',
    email: '',
    website: '',
    motto: '',
    logoUrl: '',
  });

  const fetchBranding = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/schools/current');
      const school = res.data;
      setFormData({
        name: school.name || '',
        address: school.address || '',
        phone: school.phone || '',
        email: school.email || '',
        website: school.website || '',
        motto: school.motto || '',
        logoUrl: school.logoUrl || '',
      });
    } catch (err: any) {
      console.error('Failed to load branding:', err);
      setError(err.response?.data?.error || 'Failed to load school branding settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBranding();
  }, []);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please upload a valid image file (PNG, JPG, JPEG, WEBP).');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setError('Logo image must be smaller than 2MB.');
      return;
    }

    try {
      setUploadingLogo(true);
      setError(null);
      const uploadData = new FormData();
      uploadData.append('image', file);

      const res = await api.post('/uploads/image', uploadData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res.data?.imageUrl) {
        setFormData((prev) => ({ ...prev, logoUrl: res.data.imageUrl }));
        setSuccess('Logo uploaded! Click "Save Branding Settings" to commit changes.');
      }
    } catch (err: any) {
      console.error('Logo upload error:', err);
      setError(err.response?.data?.error || 'Failed to upload logo');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleRemoveLogo = () => {
    setFormData((prev) => ({ ...prev, logoUrl: '' }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.address.trim()) {
      setError('School Name and Physical Address are required.');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const res = await api.put('/schools/branding', formData);
      setSuccess('School branding updated successfully! All official documents will now use these details.');
      if (res.data?.school) {
        setFormData({
          name: res.data.school.name || '',
          address: res.data.school.address || '',
          phone: res.data.school.phone || '',
          email: res.data.school.email || '',
          website: res.data.school.website || '',
          motto: res.data.school.motto || '',
          logoUrl: res.data.school.logoUrl || '',
        });
      }
    } catch (err: any) {
      console.error('Update branding error:', err);
      setError(err.response?.data?.error || 'Failed to save branding updates');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-3 text-gray-500">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span>Loading branding settings...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">School Branding & Identity</h1>
        <p className="text-sm text-gray-500 mt-1">
          Configure official school identity, crest/logo, motto, and contact details. These details automatically brand all generated bills, receipts, payment vouchers, and student reports.
        </p>
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Form: 7 cols */}
        <div className="lg:col-span-7 bg-white rounded-xl shadow-xs border border-gray-200 p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Logo Section */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">School Crest / Logo</label>
              <div className="flex items-center gap-6">
                <div className="w-24 h-24 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50 overflow-hidden relative group">
                  {formData.logoUrl ? (
                    <img
                      src={formData.logoUrl}
                      alt="School Logo"
                      className="w-full h-full object-contain p-1"
                    />
                  ) : (
                    <div className="text-center p-2">
                      <ImageIcon className="w-8 h-8 text-gray-400 mx-auto mb-1" />
                      <span className="text-[10px] text-gray-400">No logo</span>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-sm font-medium transition-colors">
                      <Upload className="w-4 h-4" />
                      <span>{uploadingLogo ? 'Uploading...' : 'Upload Logo'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleLogoUpload}
                        disabled={uploadingLogo}
                      />
                    </label>

                    {formData.logoUrl && (
                      <button
                        type="button"
                        onClick={handleRemoveLogo}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>Remove</span>
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">
                    Recommended: Transparent PNG or JPG, square or emblem format. Max 2MB.
                  </p>
                </div>
              </div>
            </div>

            {/* School Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Official School Name <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <Building2 className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Kingsway Model College"
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Motto */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">School Motto / Slogan</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <Quote className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={formData.motto}
                  onChange={(e) => setFormData({ ...formData, motto: e.target.value })}
                  placeholder="e.g., Knowledge is Light"
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Physical Address */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                School Physical Address <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute top-2.5 left-3 pointer-events-none text-gray-400">
                  <MapPin className="w-4 h-4" />
                </div>
                <textarea
                  required
                  rows={2}
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="e.g., 14 Hospital Road, Ijebu-Ode, Ogun State"
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Contact Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Official Phone</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-gray-400">
                    <Phone className="w-3.5 h-3.5" />
                  </div>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+234..."
                    className="w-full pl-8 pr-2 py-2 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Official Email</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-gray-400">
                    <Mail className="w-3.5 h-3.5" />
                  </div>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="info@school.edu.ng"
                    className="w-full pl-8 pr-2 py-2 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Official Website</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-gray-400">
                    <Globe className="w-3.5 h-3.5" />
                  </div>
                  <input
                    type="text"
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    placeholder="www.school.edu.ng"
                    className="w-full pl-8 pr-2 py-2 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-4 border-t border-gray-100 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow-xs disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                {saving && <RefreshCw className="w-4 h-4 animate-spin" />}
                <span>{saving ? 'Saving...' : 'Save Branding Settings'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Right Preview: 5 cols */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-gray-100 p-4 rounded-xl border border-gray-200">
            <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
              Live Document Header Preview
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              Here is how your official header renders on printable bills, fee receipts, payment vouchers, and student report cards:
            </p>

            <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-300">
              <DocumentHeader
                title="STUDENT REPORT CARD"
                documentNumber="DEMO-2026-001"
                date={new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              />
              <div className="mt-4 pt-3 border-t border-gray-100 text-center text-[10px] text-gray-400 italic">
                Sample document body begins here...
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Branding;

