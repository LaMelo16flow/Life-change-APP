import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { User, Mail, Globe, Phone, MapPin, Calendar, Save, AlertCircle, Camera, Loader2, Trash2, ShieldAlert } from 'lucide-react';

interface Country {
  code: string;
  name: string;
  currency_code: string;
  currency_symbol: string;
}

export function UserProfile() {
  const { user, profile, signOut } = useAuth();
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [profileImageUrl, setProfileImageUrl] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    country_code: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state_province: '',
    postal_code: '',
  });

  useEffect(() => {
    loadCountries();
    loadProfileData();
  }, [profile]);

  const loadCountries = async () => {
    try {
      const { data, error } = await supabase
        .from('countries')
        .select('*')
        .order('name');

      if (error) throw error;
      setCountries(data || []);
    } catch (error) {
      console.error('Error loading countries:', error);
    }
  };

  const loadProfileData = async () => {
    if (!profile) return;

    try {
      setFormData({
        full_name: profile.full_name || '',
        phone: profile.phone || '',
        country_code: profile.country_code || '',
        address_line1: profile.address_line1 || '',
        address_line2: profile.address_line2 || '',
        city: profile.city || '',
        state_province: profile.state_province || '',
        postal_code: profile.postal_code || '',
      });
      setProfileImageUrl(profile.profile_image_url || '');
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'error', text: 'Please select an image file' });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'Image must be less than 5MB' });
      return;
    }

    setUploadingImage(true);
    setMessage(null);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/avatar-${Date.now()}.${fileExt}`;

      if (profileImageUrl) {
        const oldPath = profileImageUrl.split('/profile-images/')[1];
        if (oldPath) {
          await supabase.storage.from('profile-images').remove([oldPath]);
        }
      }

      const { error: uploadError } = await supabase.storage
        .from('profile-images')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('profile-images')
        .getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ profile_image_url: urlData.publicUrl })
        .eq('id', user.id);

      if (updateError) throw updateError;

      setProfileImageUrl(urlData.publicUrl);
      setMessage({ type: 'success', text: 'Profile photo updated!' });
    } catch (error: any) {
      console.error('Error uploading image:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to upload image' });
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: formData.full_name,
          phone: formData.phone,
          country_code: formData.country_code,
          address_line1: formData.address_line1,
          address_line2: formData.address_line2,
          city: formData.city,
          state_province: formData.state_province,
          postal_code: formData.postal_code,
        })
        .eq('id', user?.id);

      if (error) throw error;

      setMessage({ type: 'success', text: 'Profile updated successfully!' });

      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error: any) {
      console.error('Error updating profile:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to update profile' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') return;
    setDeleting(true);
    setMessage(null);

    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (!currentSession) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-account`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${currentSession.access_token}`,
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({}),
        }
      );

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to delete account');

      await signOut();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to delete account' });
      setDeleting(false);
    }
  };

  const selectedCountry = countries.find(c => c.code === formData.country_code);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Profile Settings</h2>
        <p className="text-sm sm:text-base text-gray-600 mt-1">Manage your personal information and preferences</p>
      </div>

      {message && (
        <div className={`p-4 rounded-lg flex items-center gap-3 ${
          message.type === 'success'
            ? 'bg-green-50 border border-green-200'
            : 'bg-red-50 border border-red-200'
        }`}>
          <AlertCircle className={`w-5 h-5 ${
            message.type === 'success' ? 'text-green-600' : 'text-red-600'
          }`} />
          <p className={message.type === 'success' ? 'text-green-800' : 'text-red-800'}>
            {message.text}
          </p>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-4 sm:p-6 border-b border-gray-200">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 flex items-center gap-2">
            <User className="w-5 h-5" />
            Account Information
          </h3>
        </div>

        <div className="p-4 sm:p-6">
          <div className="flex flex-col items-center md:items-start md:flex-row gap-6 mb-8">
            <div className="flex flex-col items-center">
              <div className="relative">
                {profileImageUrl ? (
                  <img
                    src={profileImageUrl}
                    alt={formData.full_name}
                    className="w-24 h-24 sm:w-32 sm:h-32 rounded-full object-cover border-4 border-brand-100"
                  />
                ) : (
                  <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white text-2xl sm:text-3xl font-bold border-4 border-brand-100">
                    {getInitials(formData.full_name || user?.email || 'U')}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingImage}
                  className="absolute bottom-0 right-0 w-8 h-8 sm:w-10 sm:h-10 bg-brand-600 text-white rounded-full flex items-center justify-center hover:bg-brand-700 transition shadow-lg disabled:opacity-50"
                >
                  {uploadingImage ? (
                    <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                  ) : (
                    <Camera className="w-4 h-4 sm:w-5 sm:h-5" />
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </div>
              <p className="text-xs sm:text-sm text-gray-500 mt-2">Click camera to upload</p>
              <p className="text-xs text-gray-400">Max 5MB, JPG/PNG/GIF</p>
            </div>

            <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                  <Mail className="w-4 h-4" />
                  Email
                </div>
                <p className="font-semibold text-gray-900">{user?.email}</p>
                <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                  <Calendar className="w-4 h-4" />
                  Member Since
                </div>
                <p className="font-semibold text-gray-900">
                  {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : 'N/A'}
                </p>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                  <MapPin className="w-4 h-4" />
                  Current Rank
                </div>
                <p className="font-semibold text-gray-900">{profile?.rank_name || 'No rank'}</p>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                  <User className="w-4 h-4" />
                  Total PV
                </div>
                <p className="font-semibold text-gray-900">{profile?.total_pv || 0} PV</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Full Name *
              </label>
              <input
                type="text"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Phone Number
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full pl-11 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  placeholder="+1 (555) 000-0000"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Country *
              </label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <select
                  value={formData.country_code}
                  onChange={(e) => setFormData({ ...formData, country_code: e.target.value })}
                  className="w-full pl-11 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 appearance-none bg-white"
                  required
                >
                  <option value="">Select a country</option>
                  {countries.map((country) => (
                    <option key={country.code} value={country.code}>
                      {country.name}
                    </option>
                  ))}
                </select>
              </div>
              {selectedCountry && (
                <div className="mt-2 p-3 bg-brand-50 rounded-lg border border-brand-200">
                  <p className="text-sm text-brand-800">
                    <strong>Country:</strong> {selectedCountry.name}
                  </p>
                  <p className="text-sm text-brand-800">
                    <strong>Currency:</strong> {selectedCountry.currency_code} ({selectedCountry.currency_symbol})
                  </p>
                  <p className="text-xs text-brand-600 mt-1">
                    Products will be shown in this currency and you'll order from this country's inventory.
                  </p>
                </div>
              )}
            </div>

            <div className="border-t border-gray-200 pt-6 mt-6">
              <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Delivery Address
              </h4>
              <p className="text-sm text-gray-600 mb-4">
                This address will be used for product delivery when you place orders.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Street Address *
                  </label>
                  <input
                    type="text"
                    value={formData.address_line1}
                    onChange={(e) => setFormData({ ...formData, address_line1: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                    placeholder="123 Main Street"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Apartment, Suite, etc. (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.address_line2}
                    onChange={(e) => setFormData({ ...formData, address_line2: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                    placeholder="Apt 4B"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      City *
                    </label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                      placeholder="New York"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      State / Province *
                    </label>
                    <input
                      type="text"
                      value={formData.state_province}
                      onChange={(e) => setFormData({ ...formData, state_province: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                      placeholder="NY"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Postal Code *
                  </label>
                  <input
                    type="text"
                    value={formData.postal_code}
                    onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                    placeholder="10001"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-yellow-800">
                  <p className="font-semibold mb-1">Important Note:</p>
                  <p>
                    Changing your country will affect which products you can order and the currency used for transactions.
                    This is useful if you travel or relocate to a different country.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 bg-brand-600 text-white rounded-lg hover:bg-brand-700 font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                <Save className="w-5 h-5" />
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-red-200">
        <div className="p-6 border-b border-red-100">
          <h3 className="text-lg font-semibold text-red-700 flex items-center gap-2">
            <ShieldAlert className="w-5 h-5" />
            Danger Zone
          </h3>
        </div>
        <div className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="font-semibold text-gray-900">Delete your account</p>
              <p className="text-sm text-gray-600 mt-1">
                Permanently remove your account and all associated data. This action cannot be undone.
              </p>
            </div>
            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="px-5 py-2.5 bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 font-medium flex items-center gap-2 transition flex-shrink-0"
              >
                <Trash2 className="w-4 h-4" />
                Delete Account
              </button>
            ) : (
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteConfirmText('');
                }}
                className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium transition flex-shrink-0"
              >
                Cancel
              </button>
            )}
          </div>

          {showDeleteConfirm && (
            <div className="mt-6 p-5 bg-red-50 border border-red-200 rounded-xl">
              <div className="flex items-start gap-3 mb-4">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-red-800">
                  <p className="font-semibold mb-2">Are you absolutely sure?</p>
                  <ul className="list-disc list-inside space-y-1 text-red-700">
                    <li>Your profile, PV history, and wallet balance will be permanently deleted</li>
                    <li>Your team members will be unlinked from your account</li>
                    <li>Any pending orders will be affected</li>
                    <li>This action is irreversible</li>
                  </ul>
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-red-800 mb-1.5">
                    Type <span className="font-bold bg-red-100 px-1.5 py-0.5 rounded">DELETE</span> to confirm
                  </label>
                  <input
                    type="text"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder="Type DELETE here..."
                    className="w-full px-4 py-2.5 border border-red-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-white text-gray-900 placeholder-gray-400"
                  />
                </div>
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleteConfirmText !== 'DELETE' || deleting}
                  className="w-full px-5 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium flex items-center justify-center gap-2 transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {deleting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Deleting account...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      Permanently delete my account
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
