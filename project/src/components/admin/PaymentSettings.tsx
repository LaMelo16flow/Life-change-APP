import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { loadCountryNames, getCountryName } from '../../utils/countries';
import {
  CreditCard,
  Plus,
  Trash2,
  Save,
  ChevronDown,
  ChevronRight,
  ToggleLeft,
  ToggleRight,
  GripVertical,
  Mail,
  Phone,
  Building2,
  Globe,
} from 'lucide-react';

interface PaymentInfo {
  id: string;
  country_code: string;
  payment_method: string;
  payment_label: string;
  recipient_name: string;
  recipient_contact: string;
  payment_instructions: string;
  is_active: boolean;
  display_order: number;
  isNew?: boolean;
}

interface CountryWithContinent {
  code: string;
  name: string;
  currency_code: string;
  currency_symbol: string;
  continent: string | null;
  is_active: boolean;
}

const PAYMENT_METHOD_PRESETS: Record<string, { label: string; icon: typeof Mail }[]> = {
  CA: [
    { label: 'Interac e-Transfer', icon: Mail },
    { label: 'Bank Transfer', icon: Building2 },
  ],
  US: [
    { label: 'Zelle', icon: Mail },
    { label: 'Bank Wire', icon: Building2 },
    { label: 'Venmo', icon: Phone },
  ],
  CM: [
    { label: 'MTN Mobile Money', icon: Phone },
    { label: 'Orange Money', icon: Phone },
    { label: 'Bank Transfer', icon: Building2 },
  ],
  FR: [
    { label: 'Virement Bancaire', icon: Building2 },
  ],
  DEFAULT: [
    { label: 'Bank Transfer', icon: Building2 },
    { label: 'Mobile Money', icon: Phone },
    { label: 'E-Transfer', icon: Mail },
  ],
};

export default function PaymentSettings() {
  const toast = useToast();
  const { t } = useLanguage();
  const [countries, setCountries] = useState<CountryWithContinent[]>([]);
  const [countryNames, setCountryNames] = useState<Record<string, string>>({});
  const [paymentInfos, setPaymentInfos] = useState<PaymentInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedCountries, setExpandedCountries] = useState<Set<string>>(new Set());
  const [adminEmail, setAdminEmail] = useState('');
  const [globalInstructions, setGlobalInstructions] = useState('');
  const [savingGlobal, setSavingGlobal] = useState(false);
  const [regionFilter, setRegionFilter] = useState('all');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [namesResult, countriesResult, paymentResult, emailResult, instructionsResult] = await Promise.all([
        loadCountryNames(),
        supabase.from('countries').select('code, name, currency_code, currency_symbol, continent, is_active').eq('is_active', true).order('name'),
        supabase.from('country_payment_info').select('*').order('display_order'),
        supabase.from('admin_settings').select('value').eq('key', 'admin_contact_email').maybeSingle(),
        supabase.from('admin_settings').select('value').eq('key', 'payment_instructions').maybeSingle(),
      ]);

      setCountryNames(namesResult);
      setCountries(countriesResult.data || []);
      setPaymentInfos(paymentResult.data || []);

      if (emailResult.data) {
        setAdminEmail(emailResult.data.value?.email || '');
      }
      if (instructionsResult.data) {
        setGlobalInstructions(instructionsResult.data.value?.instructions || '');
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error(t('ps.failedLoad'));
    } finally {
      setLoading(false);
    }
  };

  const toggleCountry = (code: string) => {
    setExpandedCountries(prev => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
  };

  const getCountryPaymentInfos = (countryCode: string) => {
    return paymentInfos.filter(p => p.country_code === countryCode);
  };

  const addPaymentMethod = (countryCode: string) => {
    const existing = getCountryPaymentInfos(countryCode);
    const newInfo: PaymentInfo = {
      id: `new-${Date.now()}-${Math.random()}`,
      country_code: countryCode,
      payment_method: '',
      payment_label: '',
      recipient_name: '',
      recipient_contact: '',
      payment_instructions: '',
      is_active: true,
      display_order: existing.length,
      isNew: true,
    };
    setPaymentInfos(prev => [...prev, newInfo]);

    if (!expandedCountries.has(countryCode)) {
      toggleCountry(countryCode);
    }
  };

  const removePaymentMethod = async (info: PaymentInfo) => {
    if (info.isNew) {
      setPaymentInfos(prev => prev.filter(p => p.id !== info.id));
      return;
    }

    try {
      const { error } = await supabase
        .from('country_payment_info')
        .delete()
        .eq('id', info.id);

      if (error) throw error;
      setPaymentInfos(prev => prev.filter(p => p.id !== info.id));
      toast.success(t('ps.paymentMethodRemoved'));
    } catch (error) {
      console.error('Error removing payment method:', error);
      toast.error(t('ps.failedRemovePaymentMethod'));
    }
  };

  const updatePaymentInfo = (id: string, field: keyof PaymentInfo, value: string | boolean | number) => {
    setPaymentInfos(prev =>
      prev.map(p => p.id === id ? { ...p, [field]: value } : p)
    );
  };

  const applyPreset = (countryCode: string, presetLabel: string) => {
    const existing = getCountryPaymentInfos(countryCode);
    const alreadyExists = existing.some(p => p.payment_label === presetLabel);
    if (alreadyExists) {
      toast.error(t('ps.presetExists', { label: presetLabel }));
      return;
    }

    const newInfo: PaymentInfo = {
      id: `new-${Date.now()}-${Math.random()}`,
      country_code: countryCode,
      payment_method: presetLabel.toLowerCase().replace(/\s+/g, '_'),
      payment_label: presetLabel,
      recipient_name: '',
      recipient_contact: '',
      payment_instructions: '',
      is_active: true,
      display_order: existing.length,
      isNew: true,
    };
    setPaymentInfos(prev => [...prev, newInfo]);

    if (!expandedCountries.has(countryCode)) {
      toggleCountry(countryCode);
    }
  };

  const saveCountryPaymentInfos = async (countryCode: string) => {
    setSaving(true);
    try {
      const countryInfos = getCountryPaymentInfos(countryCode);

      for (const info of countryInfos) {
        if (!info.payment_label.trim()) {
          toast.error(t('ps.paymentLabelRequired'));
          setSaving(false);
          return;
        }

        const data = {
          country_code: info.country_code,
          payment_method: info.payment_method,
          payment_label: info.payment_label,
          recipient_name: info.recipient_name,
          recipient_contact: info.recipient_contact,
          payment_instructions: info.payment_instructions,
          is_active: info.is_active,
          display_order: info.display_order,
        };

        if (info.isNew) {
          const { data: inserted, error } = await supabase
            .from('country_payment_info')
            .insert(data)
            .select()
            .single();

          if (error) throw error;

          setPaymentInfos(prev =>
            prev.map(p => p.id === info.id ? { ...inserted, isNew: false } : p)
          );
        } else {
          const { error } = await supabase
            .from('country_payment_info')
            .update(data)
            .eq('id', info.id);

          if (error) throw error;
        }
      }

      toast.success(t('ps.settingsSavedFor', { country: getCountryName(countryCode, countryNames) }));
    } catch (error) {
      console.error('Error saving payment info:', error);
      toast.error(t('ps.failedSaveSettings'));
    } finally {
      setSaving(false);
    }
  };

  const saveGlobalSettings = async () => {
    setSavingGlobal(true);
    try {
      await Promise.all([
        supabase
          .from('admin_settings')
          .update({ value: { email: adminEmail }, updated_at: new Date().toISOString() })
          .eq('key', 'admin_contact_email'),
        supabase
          .from('admin_settings')
          .update({ value: { instructions: globalInstructions }, updated_at: new Date().toISOString() })
          .eq('key', 'payment_instructions'),
      ]);

      toast.success(t('ps.globalSettingsSaved'));
    } catch (error) {
      console.error('Error saving global settings:', error);
      toast.error(t('ps.failedSaveGlobalSettings'));
    } finally {
      setSavingGlobal(false);
    }
  };

  const allContinents = Array.from(new Set(countries.map(c => c.continent).filter(Boolean))).sort() as string[];

  const countriesWithPayment = countries.filter(c => {
    if (regionFilter !== 'all') {
      return c.continent === regionFilter;
    }
    return true;
  });

  if (loading) {
    return <div className="flex items-center justify-center h-64">{t('ps.loadingSettings')}</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <CreditCard className="w-7 h-7 text-brand-600" />
          {t('ps.title')}
        </h2>
        <p className="text-gray-600 mt-1">{t('ps.subtitle')}</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Globe className="w-5 h-5 text-gray-500" />
          {t('ps.globalDefaults')}
        </h3>
        <p className="text-sm text-gray-500">
          {t('ps.globalDefaultsDesc')}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('ps.defaultAdminEmail')}</label>
            <input
              type="email"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              placeholder="admin@lifechangers.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('ps.defaultPaymentInstructions')}</label>
            <textarea
              value={globalInstructions}
              onChange={(e) => setGlobalInstructions(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              placeholder={t('ps.generalInstructionsPlaceholder')}
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={saveGlobalSettings}
            disabled={savingGlobal}
            className="px-4 py-2 bg-brand-700 text-white rounded-lg hover:bg-brand-800 font-medium disabled:bg-gray-400 flex items-center gap-2"
          >
            <Save size={16} />
            {savingGlobal ? t('profile.saving') : t('ps.saveGlobalSettings')}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <span className="text-sm font-medium text-gray-700">{t('ps.filterByContinent')}</span>
        <select
          value={regionFilter}
          onChange={(e) => setRegionFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-sm"
        >
          <option value="all">{t('ps.allCountries', { n: countries.length })}</option>
          {allContinents.map(continent => (
            <option key={continent} value={continent}>
              {continent} ({countries.filter(c => c.continent === continent).length})
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-3">
        {countriesWithPayment.map((country) => {
          const isExpanded = expandedCountries.has(country.code);
          const countryPayments = getCountryPaymentInfos(country.code);
          const activeCount = countryPayments.filter(p => p.is_active).length;
          const presets = PAYMENT_METHOD_PRESETS[country.code] || PAYMENT_METHOD_PRESETS.DEFAULT;

          return (
            <div
              key={country.code}
              className="bg-white rounded-xl border border-gray-200 overflow-hidden"
            >
              <button
                onClick={() => toggleCountry(country.code)}
                className="w-full flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-5 py-4 hover:bg-gray-50 transition"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {isExpanded ? (
                    <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  )}
                  <div className="text-left flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
                    <span className="font-semibold text-gray-900 truncate">{country.name}</span>
                    <span className="text-sm text-gray-500">({country.code})</span>
                    {country.continent && (
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                        {country.continent}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 pl-8 sm:pl-0 flex-shrink-0">
                  <span className="text-sm text-gray-500">
                    {country.currency_symbol} {country.currency_code}
                  </span>
                  {countryPayments.length > 0 ? (
                    <span className="text-xs font-medium bg-brand-100 text-brand-800 px-2.5 py-1 rounded-full">
                      {t('ps.activeMethods', { n: activeCount })}
                    </span>
                  ) : (
                    <span className="text-xs font-medium bg-gray-100 text-gray-500 px-2.5 py-1 rounded-full">
                      {t('ps.noMethods')}
                    </span>
                  )}
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-gray-200 px-5 py-4 space-y-4 bg-gray-50/50">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-gray-600">{t('ps.quickAdd')}</span>
                    {presets.map((preset) => {
                      const PresetIcon = preset.icon;
                      return (
                        <button
                          key={preset.label}
                          onClick={() => applyPreset(country.code, preset.label)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-brand-50 hover:border-brand-300 hover:text-brand-700 transition"
                        >
                          <PresetIcon size={14} />
                          {preset.label}
                        </button>
                      );
                    })}
                    <button
                      onClick={() => addPaymentMethod(country.code)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-700 text-white rounded-lg text-sm font-medium hover:bg-brand-800 transition"
                    >
                      <Plus size={14} />
                      {t('ps.custom')}
                    </button>
                  </div>

                  {countryPayments.length === 0 ? (
                    <div className="text-center py-8 bg-white rounded-lg border border-dashed border-gray-300">
                      <CreditCard className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">
                        {t('ps.noMethodsConfigured')}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {countryPayments.map((info, index) => (
                        <div
                          key={info.id}
                          className={`bg-white rounded-lg border ${info.is_active ? 'border-gray-200' : 'border-gray-200 opacity-60'} p-4 space-y-3`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <GripVertical size={16} className="text-gray-300" />
                              <span className="text-sm font-bold text-gray-700">
                                {t('ps.methodNumber', { n: index + 1 })}
                              </span>
                              {info.isNew && (
                                <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
                                  {t('ps.unsaved')}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => updatePaymentInfo(info.id, 'is_active', !info.is_active)}
                                title={info.is_active ? t('ps.deactivate') : t('ps.activate')}
                              >
                                {info.is_active ? (
                                  <ToggleRight size={28} className="text-brand-600" />
                                ) : (
                                  <ToggleLeft size={28} className="text-gray-400" />
                                )}
                              </button>
                              <button
                                onClick={() => removePaymentMethod(info)}
                                className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition"
                                title={t('ps.remove')}
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">
                                {t('ps.paymentLabel')}
                              </label>
                              <input
                                type="text"
                                value={info.payment_label}
                                onChange={(e) => updatePaymentInfo(info.id, 'payment_label', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-sm"
                                placeholder={t('ps.paymentLabelPlaceholder')}
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">
                                {t('ps.recipientName')}
                              </label>
                              <input
                                type="text"
                                value={info.recipient_name}
                                onChange={(e) => updatePaymentInfo(info.id, 'recipient_name', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-sm"
                                placeholder={t('ps.recipientNamePlaceholder')}
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">
                                {t('ps.recipientContact')}
                              </label>
                              <input
                                type="text"
                                value={info.recipient_contact}
                                onChange={(e) => updatePaymentInfo(info.id, 'recipient_contact', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-sm"
                                placeholder={t('ps.recipientContactPlaceholder')}
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">
                                {t('ps.methodKey')}
                              </label>
                              <input
                                type="text"
                                value={info.payment_method}
                                onChange={(e) => updatePaymentInfo(info.id, 'payment_method', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-sm"
                                placeholder={t('ps.methodKeyPlaceholder')}
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              {t('ps.paymentInstructions')}
                            </label>
                            <textarea
                              value={info.payment_instructions}
                              onChange={(e) => updatePaymentInfo(info.id, 'payment_instructions', e.target.value)}
                              rows={2}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-sm"
                              placeholder={t('ps.paymentInstructionsPlaceholder')}
                            />
                          </div>
                        </div>
                      ))}

                      <div className="flex justify-end">
                        <button
                          onClick={() => saveCountryPaymentInfos(country.code)}
                          disabled={saving}
                          className="px-4 py-2 bg-brand-700 text-white rounded-lg hover:bg-brand-800 font-medium disabled:bg-gray-400 flex items-center gap-2"
                        >
                          <Save size={16} />
                          {saving ? t('profile.saving') : t('ps.saveCountrySettings', { country: country.name })}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
