import { useRef } from 'react';
import { Check, Upload } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';

interface Props {
  amountLabel: string;
  file: File | null;
  onFileChange: (file: File | null) => void;
  notes: string;
  onNotesChange: (notes: string) => void;
}

/** Payment instructions + proof upload, shown in the checkout before the order is sent. */
export function PaymentProofFields({ amountLabel, file, onFileChange, notes, onNotesChange }: Props) {
  const { t } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-4">
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h4 className="font-semibold text-yellow-900 mb-1">{t('checkout.payFirstTitle')}</h4>
        <p className="text-sm text-yellow-800">{t('checkout.payFirstMsg', { amount: amountLabel })}</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">{t('orders.paymentScreenshotLabel')}</label>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={(e) => onFileChange(e.target.files?.[0] || null)}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={`w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed rounded-lg transition ${
            file ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-brand-500 hover:bg-brand-50'
          }`}
        >
          {file ? <Check size={20} className="text-green-600" /> : <Upload size={20} className="text-gray-500" />}
          <span className={file ? 'text-green-700 truncate' : 'text-gray-700'}>
            {file ? file.name : t('orders.uploadScreenshot')}
          </span>
        </button>
        <p className="text-xs text-gray-500 mt-1">{t('orders.uploadScreenshotHint')}</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">{t('orders.transactionDetailsLabel')}</label>
        <textarea
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
          placeholder={t('orders.transactionPlaceholder')}
        />
      </div>
    </div>
  );
}
