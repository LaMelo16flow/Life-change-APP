import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LogIn, UserPlus, Loader2, Eye, EyeOff, Mail, Lock, User, Users } from 'lucide-react';

const DEFAULT_COUNTRY_CODE = 'CA';

export function AuthForm() {
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const { signIn, signUp, sendPasswordResetEmail } = useAuth();

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!email) {
      setError('Le courriel est requis');
      return;
    }

    setLoading(true);
    try {
      await sendPasswordResetEmail(email);
      setSuccess('Si un compte existe avec ce courriel, un lien de reinitialisation a ete envoye.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (isLogin) {
      if (!email || !password) {
        setError('Le courriel et le mot de passe sont requis');
        return;
      }
    } else {
      if (!email || !password || !fullName) {
        setError('Tous les champs sont requis');
        return;
      }
    }

    setLoading(true);

    try {
      if (isLogin) {
        await signIn(email, password);
      } else {
        const result = await signUp(email, password, fullName, DEFAULT_COUNTRY_CODE, referralCode || undefined);
        if (result.requiresApproval) {
          setSuccess('Compte cree avec succes! Veuillez attendre l\'approbation de l\'administrateur avant de pouvoir vous connecter.');
        } else {
          setSuccess('Compte cree avec succes! Vous pouvez maintenant vous connecter.');
        }
        setEmail('');
        setPassword('');
        setFullName('');
        setReferralCode('');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    setIsForgotPassword(false);
    setError('');
    setSuccess('');
    setFocusedField(null);
  };

  const openForgotPassword = () => {
    setIsForgotPassword(true);
    setError('');
    setSuccess('');
  };

  const closeForgotPassword = () => {
    setIsForgotPassword(false);
    setError('');
    setSuccess('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 relative overflow-hidden p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-full">
          <div className="absolute top-20 left-10 w-72 h-72 bg-brand-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-brand-600/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '6s' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-brand-400/5 rounded-full blur-3xl" />
        </div>
        <div className="absolute inset-0 bg-[linear-gradient(rgba(34,197,94,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(34,197,94,0.03)_1px,transparent_1px)] bg-[size:64px_64px]" />
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8 animate-fade-in">
          <div className="relative inline-block mb-6">
            <div className="absolute inset-0 bg-brand-500/20 rounded-full blur-xl scale-150" />
            <div className="relative bg-white rounded-full p-3 shadow-2xl shadow-brand-500/20 ring-4 ring-white/10">
              <img
                src={`${import.meta.env.BASE_URL}logo.webp`}
                alt="Life Changers Logo"
                className="w-20 h-20 object-contain"
              />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight mb-2">
            Life Changers
          </h1>
          <p className="text-gray-400 text-sm">
            Life changers teamwork
          </p>
        </div>

        <div className="relative">
          <div className="absolute -inset-1 bg-gradient-to-r from-brand-500/20 via-brand-400/10 to-brand-500/20 rounded-3xl blur-xl" />
          <div className="relative bg-white/[0.03] backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
            {isForgotPassword ? (
              <div className="p-6 sm:p-8">
                <div className="mb-6">
                  <h2 className="text-xl font-semibold text-white">Mot de passe oublie</h2>
                  <p className="text-gray-400 text-sm mt-1">
                    Entrez votre courriel pour recevoir un lien de reinitialisation
                  </p>
                </div>

                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-gray-300">
                      Courriel
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                        <Mail className="w-5 h-5 text-gray-500" />
                      </div>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 transition-all duration-300 focus:bg-white/10 focus:border-brand-500/50 focus:ring-2 focus:ring-brand-500/20 focus:outline-none"
                        placeholder="vous@exemple.com"
                        required
                        autoFocus
                      />
                    </div>
                  </div>

                  {error && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm flex items-start gap-3 animate-shake">
                      <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-red-400 text-xs font-bold">!</span>
                      </div>
                      <span>{error}</span>
                    </div>
                  )}

                  {success && (
                    <div className="bg-brand-500/10 border border-brand-500/20 text-brand-400 px-4 py-3 rounded-xl text-sm flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-brand-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <svg className="w-3 h-3 text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <span>{success}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white font-semibold py-3.5 rounded-xl transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-brand-500/25"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Envoi...</span>
                      </>
                    ) : (
                      <span>Envoyer le lien de reinitialisation</span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={closeForgotPassword}
                    className="w-full text-gray-400 hover:text-brand-400 text-sm transition-colors text-center"
                  >
                    Retour a la connexion
                  </button>
                </form>
              </div>
            ) : (
              <>
            <div className="flex border-b border-white/10">
              <button
                type="button"
                onClick={() => isLogin || toggleMode()}
                className={`flex-1 py-4 px-6 text-sm font-medium transition-all duration-300 relative ${
                  isLogin
                    ? 'text-white'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  <LogIn className="w-4 h-4" />
                  Connexion
                </span>
                {isLogin && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-brand-500 to-transparent" />
                )}
              </button>
              <button
                type="button"
                onClick={() => !isLogin || toggleMode()}
                className={`flex-1 py-4 px-6 text-sm font-medium transition-all duration-300 relative ${
                  !isLogin
                    ? 'text-white'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  <UserPlus className="w-4 h-4" />
                  Inscription
                </span>
                {!isLogin && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-brand-500 to-transparent" />
                )}
              </button>
            </div>

            <div className="p-6 sm:p-8">
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-white">
                  {isLogin ? 'Bienvenue' : 'Creer votre compte'}
                </h2>
                <p className="text-gray-400 text-sm mt-1">
                  {isLogin
                    ? 'Connectez-vous pour acceder a votre espace'
                    : 'Rejoignez notre communaute de Life Changers'}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {!isLogin && (
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-gray-300">
                      Nom complet
                    </label>
                    <div className={`relative group transition-all duration-300 ${
                      focusedField === 'fullName' ? 'scale-[1.02]' : ''
                    }`}>
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                        <User className={`w-5 h-5 transition-colors duration-300 ${
                          focusedField === 'fullName' ? 'text-brand-400' : 'text-gray-500'
                        }`} />
                      </div>
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        onFocus={() => setFocusedField('fullName')}
                        onBlur={() => setFocusedField(null)}
                        className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 transition-all duration-300 focus:bg-white/10 focus:border-brand-500/50 focus:ring-2 focus:ring-brand-500/20 focus:outline-none"
                        placeholder="Entrez votre nom complet"
                        required
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-gray-300">
                    Courriel
                  </label>
                  <div className={`relative group transition-all duration-300 ${
                    focusedField === 'email' ? 'scale-[1.02]' : ''
                  }`}>
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <Mail className={`w-5 h-5 transition-colors duration-300 ${
                        focusedField === 'email' ? 'text-brand-400' : 'text-gray-500'
                      }`} />
                    </div>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onFocus={() => setFocusedField('email')}
                      onBlur={() => setFocusedField(null)}
                      className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 transition-all duration-300 focus:bg-white/10 focus:border-brand-500/50 focus:ring-2 focus:ring-brand-500/20 focus:outline-none"
                      placeholder="vous@exemple.com"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-gray-300">
                    Mot de passe
                  </label>
                  <div className={`relative group transition-all duration-300 ${
                    focusedField === 'password' ? 'scale-[1.02]' : ''
                  }`}>
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <Lock className={`w-5 h-5 transition-colors duration-300 ${
                        focusedField === 'password' ? 'text-brand-400' : 'text-gray-500'
                      }`} />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onFocus={() => setFocusedField('password')}
                      onBlur={() => setFocusedField(null)}
                      className="w-full pl-11 pr-12 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 transition-all duration-300 focus:bg-white/10 focus:border-brand-500/50 focus:ring-2 focus:ring-brand-500/20 focus:outline-none"
                      placeholder="Entrez votre mot de passe"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      {showPassword ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>

                {!isLogin && (
                  <>
                    <div className="space-y-1.5">
                      <label className="block text-sm font-medium text-gray-300">
                        Code de parrainage <span className="text-gray-500">(Optionnel)</span>
                      </label>
                      <div className={`relative group transition-all duration-300 ${
                        focusedField === 'referral' ? 'scale-[1.02]' : ''
                      }`}>
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                          <Users className={`w-5 h-5 transition-colors duration-300 ${
                            focusedField === 'referral' ? 'text-brand-400' : 'text-gray-500'
                          }`} />
                        </div>
                        <input
                          type="text"
                          value={referralCode}
                          onChange={(e) => setReferralCode(e.target.value)}
                          onFocus={() => setFocusedField('referral')}
                          onBlur={() => setFocusedField(null)}
                          className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 transition-all duration-300 focus:bg-white/10 focus:border-brand-500/50 focus:ring-2 focus:ring-brand-500/20 focus:outline-none"
                          placeholder="Entrez l'ID du parrain"
                        />
                      </div>
                    </div>
                  </>
                )}

                {error && (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm flex items-start gap-3 animate-shake">
                    <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-red-400 text-xs font-bold">!</span>
                    </div>
                    <span>{error}</span>
                  </div>
                )}

                {success && (
                  <div className="bg-brand-500/10 border border-brand-500/20 text-brand-400 px-4 py-3 rounded-xl text-sm flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-brand-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg className="w-3 h-3 text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span>{success}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full relative group overflow-hidden bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white font-semibold py-3.5 rounded-xl transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-brand-500/25 hover:shadow-brand-500/40 hover:scale-[1.02] active:scale-[0.98]"
                >
                  <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Traitement...</span>
                    </>
                  ) : isLogin ? (
                    <>
                      <LogIn className="w-5 h-5" />
                      <span>Se connecter</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-5 h-5" />
                      <span>Creer mon compte</span>
                    </>
                  )}
                </button>
              </form>

              {isLogin && (
                <div className="mt-6 text-center">
                  <button
                    type="button"
                    onClick={openForgotPassword}
                    className="text-gray-400 hover:text-brand-400 text-sm transition-colors"
                  >
                    Mot de passe oublie?
                  </button>
                </div>
              )}
            </div>
              </>
            )}
          </div>
        </div>

        <p className="text-center text-gray-500 text-xs mt-8">
          En continuant, vous acceptez nos conditions d'utilisation et notre politique de confidentialite.
        </p>
      </div>
    </div>
  );
}
