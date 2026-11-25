import { X } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

export type LegalDoc = 'privacy' | 'terms';

const CONTACT = 'lcshop.app@gmail.com';
const UPDATED = '2026-11-24';

type Section = { h: string; p: string[] };

const content: Record<'fr' | 'en', Record<LegalDoc, { title: string; sections: Section[] }>> = {
  fr: {
    privacy: {
      title: 'Politique de confidentialite',
      sections: [
        { h: 'Qui sommes-nous', p: [`LC Store est la boutique en ligne reservee aux membres de la communaute Life Changers. Pour toute question sur vos donnees : ${CONTACT}.`] },
        { h: 'Donnees que nous recueillons', p: [
          'Compte : nom, courriel, telephone, pays, photo de profil (facultative) et adresse (facultative).',
          'Commandes : produits, quantites, montants, points PV, captures de preuve de paiement et notes que vous ajoutez.',
          'Technique : informations de connexion necessaires a la securite de votre compte.',
        ] },
        { h: 'Pourquoi nous les utilisons', p: [
          'Gerer votre compte, traiter et verifier vos commandes et paiements, livrer les produits, calculer vos PV, vous envoyer les avis lies a vos commandes et, si vous ne vous y opposez pas, des courriels de promotions.',
        ] },
        { h: 'Qui peut les voir', p: [
          'Seuls vous et l\'equipe LC Store (administrateurs et gestionnaires autorises) voient vos informations. Les autres membres ne voient pas vos coordonnees.',
          'Nous ne vendons pas vos donnees. Elles sont hebergees par nos fournisseurs : Supabase (base de donnees et fichiers), Google Gmail (envoi des courriels) et GitHub Pages (site). Ces services peuvent stocker les donnees hors de votre pays.',
        ] },
        { h: 'Courriels de promotions', p: [
          'Vous pouvez arreter les courriels de promotions a tout moment : Profil, puis decochez « Courriels de promotions », ou repondez « STOP » a un courriel. Les avis lies a vos commandes restent envoyes.',
        ] },
        { h: 'Conservation et suppression', p: [
          'Nous gardons vos donnees tant que votre compte existe et le temps exige par la loi pour les registres de ventes. Vous pouvez demander la correction ou la suppression de votre compte en nous ecrivant.',
        ] },
        { h: 'Vos droits', p: [
          `Vous pouvez demander l'acces a vos donnees, leur correction ou leur suppression, et retirer votre consentement en ecrivant a ${CONTACT}. Si vous n'etes pas satisfait de notre reponse, vous pouvez vous adresser a l'autorite de protection des renseignements personnels de votre pays (au Canada : le Commissariat a la protection de la vie privee).`,
        ] },
        { h: 'Securite', p: ['Les connexions sont chiffrees et l\'acces aux donnees est limite par compte et par role. Ne partagez jamais votre mot de passe.'] },
      ],
    },
    terms: {
      title: "Conditions d'utilisation",
      sections: [
        { h: 'Acces', p: ['Le compte doit etre approuve par l\'equipe LC Store avant de pouvoir commander. Vous etes responsable de l\'exactitude de vos informations et de la confidentialite de votre mot de passe.'] },
        { h: 'Commandes et paiement', p: [
          'Les prix affiches sont ceux en vigueur au moment de la commande. Vous payez avec l\'un des moyens indiques a la commande, puis vous envoyez la commande avec la capture de votre paiement.',
          'La commande est confirmee seulement apres verification du paiement et du stock par l\'equipe. Une commande peut etre refusee (stock insuffisant, paiement non conforme) ; vous en etes alors informe avec la raison.',
        ] },
        { h: 'Promotions et PV', p: ['Les promotions ont des dates de debut et de fin et peuvent etre limitees a un pays. Les points PV sont credites quand la commande est terminee et n\'ont pas de valeur en argent.'] },
        { h: 'Utilisation acceptable', p: ['Il est interdit d\'envoyer de fausses preuves de paiement, d\'utiliser le compte d\'une autre personne ou de tenter de contourner la securite du service. Ces actes peuvent entrainer la suspension du compte.'] },
        { h: 'Contact', p: [`Pour toute question, un remboursement ou un probleme avec une commande : ${CONTACT}.`] },
      ],
    },
  },
  en: {
    privacy: {
      title: 'Privacy Policy',
      sections: [
        { h: 'Who we are', p: [`LC Store is the online shop for members of the Life Changers community. For any question about your data: ${CONTACT}.`] },
        { h: 'Data we collect', p: [
          'Account: name, email, phone, country, profile photo (optional) and address (optional).',
          'Orders: products, quantities, amounts, PV points, payment proof screenshots and the notes you add.',
          'Technical: sign-in information needed to keep your account secure.',
        ] },
        { h: 'Why we use it', p: [
          'To manage your account, process and check your orders and payments, deliver products, compute your PV, send you notices about your orders and, unless you opt out, promotion emails.',
        ] },
        { h: 'Who can see it', p: [
          'Only you and the LC Store team (authorised admins and managers) can see your information. Other members cannot see your contact details.',
          'We do not sell your data. It is hosted by our providers: Supabase (database and files), Google Gmail (sending emails) and GitHub Pages (website). These services may store data outside your country.',
        ] },
        { h: 'Promotion emails', p: [
          'You can stop promotion emails at any time: Profile, then untick "Promotion emails", or reply "STOP" to an email. Notices about your orders are still sent.',
        ] },
        { h: 'Retention and deletion', p: [
          'We keep your data while your account exists and for as long as the law requires for sales records. You can ask us to correct your data or delete your account by writing to us.',
        ] },
        { h: 'Your rights', p: [
          `You can ask to access, correct or delete your data, or withdraw your consent, by writing to ${CONTACT}. If you are not satisfied with our answer, you can contact the privacy authority of your country (in Canada: the Office of the Privacy Commissioner).`,
        ] },
        { h: 'Security', p: ['Connections are encrypted and access to data is limited by account and role. Never share your password.'] },
      ],
    },
    terms: {
      title: 'Terms of Use',
      sections: [
        { h: 'Access', p: ['Your account must be approved by the LC Store team before you can order. You are responsible for keeping your information accurate and your password private.'] },
        { h: 'Orders and payment', p: [
          'Prices shown are those in effect when you order. You pay with one of the methods shown at checkout, then send the order with the screenshot of your payment.',
          'The order is confirmed only after the team checks the payment and the stock. An order can be rejected (not enough stock, payment not matching); you are then told why.',
        ] },
        { h: 'Promotions and PV', p: ['Promotions have start and end dates and may be limited to one country. PV points are credited when the order is completed and have no cash value.'] },
        { h: 'Acceptable use', p: ['Sending fake payment proofs, using someone else\'s account or trying to get around the security of the service is not allowed and can lead to the account being suspended.'] },
        { h: 'Contact', p: [`For any question, a refund or a problem with an order: ${CONTACT}.`] },
      ],
    },
  },
};

export function LegalModal({ doc, onClose, onSwitch }: { doc: LegalDoc; onClose: () => void; onSwitch: (d: LegalDoc) => void }) {
  const { language } = useLanguage();
  const lang = language === 'fr' ? 'fr' : 'en';
  const d = content[lang][doc];
  const other: LegalDoc = doc === 'privacy' ? 'terms' : 'privacy';

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4" role="dialog" aria-modal="true" aria-label={d.title}>
      <div className="bg-white text-gray-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 text-left">
        <div className="flex justify-between items-start gap-4 mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{d.title}</h2>
            <p className="text-xs text-gray-500">{lang === 'fr' ? 'Mise a jour' : 'Updated'} : {UPDATED}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label={lang === 'fr' ? 'Fermer' : 'Close'}>
            <X size={22} />
          </button>
        </div>
        <div className="space-y-4">
          {d.sections.map((s) => (
            <section key={s.h}>
              <h3 className="font-semibold text-gray-900 mb-1">{s.h}</h3>
              {s.p.map((t, i) => <p key={i} className="text-sm text-gray-700 leading-relaxed mb-1">{t}</p>)}
            </section>
          ))}
        </div>
        <button onClick={() => onSwitch(other)} className="mt-6 text-sm text-brand-700 underline">
          {content[lang][other].title}
        </button>
      </div>
    </div>
  );
}
