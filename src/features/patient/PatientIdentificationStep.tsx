import React, { useState } from 'react';
import { User, Search, UserPlus, ArrowRight, CheckCircle2, ShieldCheck } from 'lucide-react';
import { Patient, LanguageCode } from '../../types/client';
import { api } from '../../services/api';

interface PatientIdentificationStepProps {
  language: LanguageCode;
  onPatientIdentified: (patient: Patient) => void;
}

export const PatientIdentificationStep: React.FC<PatientIdentificationStepProps> = ({
  language,
  onPatientIdentified,
}) => {
  const [mode, setMode] = useState<'SELECT' | 'EXISTING' | 'NEW'>('SELECT');
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Patient[]>([]);
  const [searchError, setSearchError] = useState('');

  // New Patient Form state
  const [fullName, setFullName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState<'MALE' | 'FEMALE' | 'OTHER'>('MALE');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [abhaId, setAbhaId] = useState('');
  const [registering, setRegistering] = useState(false);

  const isHindi = language === 'hi';

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchError('');
    try {
      const res = await api.searchPatients(searchQuery.trim());
      if (res.success && res.data) {
        setSearchResults(res.data);
        if (res.data.length === 0) {
          setSearchError(isHindi ? 'कोई रोगी रिकॉर्ड नहीं मिला।' : 'No matching patient record found.');
        }
      }
    } catch (err: any) {
      setSearchError(err.message || 'Search failed');
    } finally {
      setSearching(false);
    }
  };

  const handleRegisterNewPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !phoneNumber.trim()) return;
    setRegistering(true);
    try {
      const res = await api.registerPatient({
        fullName: fullName.trim(),
        dateOfBirth: dateOfBirth || '1995-01-01',
        gender,
        phoneNumber: phoneNumber.trim(),
        abhaId: abhaId.trim() || undefined,
      });

      if (res.success && res.data) {
        onPatientIdentified(res.data);
      }
    } catch (err: any) {
      alert(err.message || 'Registration failed');
    } finally {
      setRegistering(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-4">
      {/* Header Banner */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-emerald-100 text-emerald-700 mb-3 shadow-xs">
          <User className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-black text-slate-900">
          {isHindi ? 'रोगी पहचान व पंजीकरण' : 'Patient Identification & Registration'}
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          {isHindi
            ? 'कृपया अपनी पहचान चुनें या नया पंजीकरण करें (DPDP ACT 2023 अनुपालन)'
            : 'Select patient profile to initiate OPD intake (DPDP Act 2023 Compliant)'}
        </p>
      </div>

      {/* Choice Screen */}
      {mode === 'SELECT' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => setMode('EXISTING')}
            className="p-6 bg-white rounded-3xl border-2 border-slate-200 hover:border-emerald-500 text-left shadow-xs hover:shadow-md transition-all group"
          >
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
              <Search className="w-6 h-6" />
            </div>
            <h3 className="text-base font-extrabold text-slate-900 mb-1">
              {isHindi ? 'मौजूदा रोगी' : 'Existing Patient'}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              {isHindi
                ? 'अस्पताल आईडी (MK-2026-XXXXXX) या मोबाइल नंबर से खोजें'
                : 'Search by Hospital Patient ID (MK-2026-XXXXXX) or Mobile Number'}
            </p>
            <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-indigo-600 group-hover:translate-x-1 transition-transform">
              <span>{isHindi ? 'खोजें व आगे बढ़ें' : 'Search Profile'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </button>

          <button
            onClick={() => setMode('NEW')}
            className="p-6 bg-white rounded-3xl border-2 border-slate-200 hover:border-emerald-500 text-left shadow-xs hover:shadow-md transition-all group"
          >
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
              <UserPlus className="w-6 h-6" />
            </div>
            <h3 className="text-base font-extrabold text-slate-900 mb-1">
              {isHindi ? 'नया रोगी पंजीकरण' : 'New Patient Registration'}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              {isHindi
                ? 'नया अस्पताल आईडी और डिजिटल रिकॉर्ड बनाएं'
                : 'Create new Hospital Patient ID & Intake Profile'}
            </p>
            <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-emerald-600 group-hover:translate-x-1 transition-transform">
              <span>{isHindi ? 'नया पंजीकरण करें' : 'Register Patient'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </button>
        </div>
      )}

      {/* Existing Patient Search Form */}
      {mode === 'EXISTING' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
              <Search className="w-5 h-5 text-indigo-600" />
              {isHindi ? 'मौजूदा रोगी खोजें' : 'Search Existing Patient'}
            </h3>
            <button
              onClick={() => setMode('SELECT')}
              className="text-xs font-bold text-slate-500 hover:text-slate-800"
            >
              &larr; {isHindi ? 'वापस' : 'Back'}
            </button>
          </div>

          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isHindi ? 'अस्पताल आईडी / मोबाइल नंबर दर्ज करें...' : 'Enter Patient ID / Mobile Number / Name...'}
              className="flex-1 p-3 rounded-xl border border-slate-300 text-xs font-semibold text-slate-900 focus:border-indigo-600 focus:outline-hidden"
            />
            <button
              type="submit"
              disabled={searching}
              className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs shrink-0 flex items-center gap-1.5"
            >
              <Search className="w-4 h-4" />
              <span>{searching ? (isHindi ? 'खोज रहे हैं...' : 'Searching...') : (isHindi ? 'खोजें' : 'Search')}</span>
            </button>
          </form>

          {searchError && (
            <p className="text-xs text-rose-600 font-bold bg-rose-50 p-3 rounded-xl border border-rose-200">
              {searchError}
            </p>
          )}

          {searchResults.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">
                {isHindi ? 'मिले रिकॉर्ड:' : 'Matching Records Found:'}
              </h4>
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden">
                {searchResults.map((pat) => (
                  <div
                    key={pat.id}
                    className="p-4 bg-slate-50 hover:bg-emerald-50/50 flex items-center justify-between transition-colors"
                  >
                    <div>
                      <strong className="text-sm font-extrabold text-slate-900 block">{pat.name}</strong>
                      <span className="text-xs text-slate-500 font-mono">
                        ID: {pat.abhaId || pat.id} &bull; Age: {pat.age} &bull; Gender: {pat.gender} &bull; Phone: {pat.phone}
                      </span>
                    </div>
                    <button
                      onClick={() => onPatientIdentified(pat)}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-2xs flex items-center gap-1"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{isHindi ? 'चुनें व आगे बढ़ें' : 'Select Patient'}</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* New Patient Registration Form */}
      {mode === 'NEW' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-emerald-600" />
              {isHindi ? 'नया रोगी पंजीकरण' : 'New Patient Registration'}
            </h3>
            <button
              onClick={() => setMode('SELECT')}
              className="text-xs font-bold text-slate-500 hover:text-slate-800"
            >
              &larr; {isHindi ? 'वापस' : 'Back'}
            </button>
          </div>

          <form onSubmit={handleRegisterNewPatient} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {isHindi ? 'पूरा नाम *' : 'Full Name *'}
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Ramesh Kumar"
                className="w-full p-3 rounded-xl border border-slate-300 text-xs font-semibold text-slate-900 focus:border-emerald-600 focus:outline-hidden"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isHindi ? 'जन्म तिथि / आयु *' : 'Date of Birth *'}
                </label>
                <input
                  type="date"
                  required
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  className="w-full p-3 rounded-xl border border-slate-300 text-xs font-semibold text-slate-900 focus:border-emerald-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isHindi ? 'लिंग *' : 'Gender *'}
                </label>
                <select
                  value={gender}
                  onChange={(e: any) => setGender(e.target.value)}
                  className="w-full p-3 rounded-xl border border-slate-300 text-xs font-semibold text-slate-900 focus:border-emerald-600 focus:outline-hidden bg-white"
                >
                  <option value="MALE">Male (पुरुष)</option>
                  <option value="FEMALE">Female (महिला)</option>
                  <option value="OTHER">Other (अन्य)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {isHindi ? 'मोबाइल नंबर *' : 'Mobile Number *'}
              </label>
              <input
                type="tel"
                required
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full p-3 rounded-xl border border-slate-300 text-xs font-semibold text-slate-900 focus:border-emerald-600 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {isHindi ? 'ABHA नंबर (ऐच्छिक)' : 'ABHA Number / Address (Optional)'}
              </label>
              <input
                type="text"
                value={abhaId}
                onChange={(e) => setAbhaId(e.target.value)}
                placeholder="91-XXXX-XXXX-XXXX"
                className="w-full p-3 rounded-xl border border-slate-300 text-xs font-semibold text-slate-900 focus:border-emerald-600 focus:outline-hidden"
              />
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2 text-xs text-slate-600">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>DPDP Act 2023 Compliant: Patient consent recorded for clinical intake processing.</span>
            </div>

            <button
              type="submit"
              disabled={registering}
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{registering ? (isHindi ? 'पंजीकृत हो रहा है...' : 'Registering...') : (isHindi ? 'पंजीकरण पूरा करें व इनटेक शुरू करें' : 'Complete Registration & Start Intake')}</span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
