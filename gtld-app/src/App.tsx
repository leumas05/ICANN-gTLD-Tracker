import React, { useState, useMemo, useEffect } from 'react';
import Papa from 'papaparse';
import { Search, Info, Upload, X, Filter, Palette, ExternalLink, ArrowRight, ArrowLeft, Sun, Moon, ArrowDownUp, ChevronDown, Check } from 'lucide-react';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

function useColumnCount() {
  const [cols, setCols] = useState(1);

  useEffect(() => {
    const updateCols = () => {
      const width = window.innerWidth;
      if (width >= 1280) setCols(5); // xl
      else if (width >= 1024) setCols(4); // lg
      else if (width >= 768) setCols(3); // md
      else if (width >= 640) setCols(2); // sm
      else setCols(1);
    };
    updateCols();
    window.addEventListener('resize', updateCols);
    return () => window.removeEventListener('resize', updateCols);
  }, []);

  return cols;
}

interface CsvRow {
  Priority: string;
  'Primary String': string;
  'Primary String Unicode Label': string;
  'Application ID': string;
  'Applicant Name': string;
  'Application Status': string;
  'TLD Type: Brand': string;
  'TLD Type: Geo (Self-Designated)': string;
  'TLD Type: Geo (String Review Confirmed)': string;
  'TLD Type: Community': string;
  'TLD Type: IDN': string;
  'Location': string;
  'Region': string;
}

interface AppData {
  baseId: string;
  applicantName: string;
  location: string;
  region: string;
  primary: { tld: string; status: 'Active' | 'Deactivated'; types: string[]; allTypes: string[]; appId: string } | null;
  replacement: { tld: string; status: 'Active' | 'Deactivated'; types: string[]; allTypes: string[]; appId: string } | null;
}

type ColorType = 'DarkGreen' | 'LightGreen' | 'Yellow' | 'DarkYellow' | 'Red';
const ALL_COLORS: ColorType[] = ['DarkGreen', 'LightGreen', 'Yellow', 'DarkYellow', 'Red'];

interface TldInfo {
  tld: string;
  color: ColorType;
  reason: string;
  allTypes: string[];
  applicants: {
    applicantName: string;
    location: string;
    region: string;
    isPrimaryForThis: boolean;
    isReplacementForThis: boolean;
    primary: { tld: string, status: string, types: string[], allTypes: string[], appId: string } | null;
    replacement: { tld: string, status: string, types: string[], allTypes: string[], appId: string } | null;
  }[];
}



const parseData = (csvText: string): TldInfo[] => {
  const lines = csvText.split('\n');
  const actualCsv = lines.slice(1).join('\n'); // skip warning

  const parsed = Papa.parse<CsvRow>(actualCsv, {
    header: true,
    skipEmptyLines: true,
  });

  const applications = new Map<string, AppData>();

  parsed.data.forEach(row => {
    const appId = row['Application ID']?.trim();
    if (!appId) return;

    const isReplacement = appId.endsWith('-R');
    const baseId = isReplacement ? appId.slice(0, -2) : appId;
    
    if (!applications.has(baseId)) {
      applications.set(baseId, {
        baseId,
        applicantName: row['Applicant Name'] || 'Unknown Applicant',
        location: row['Location'] || 'Unknown',
        region: row['Region'] || 'Unknown',
        primary: null,
        replacement: null
      });
    }

    const app = applications.get(baseId)!;
    
    const punycodeStr = row['Primary String']?.trim() || '';
    const unicodeStr = row['Primary String Unicode Label']?.trim() || '';
    let tld = unicodeStr || punycodeStr;
    
    if (tld && !tld.startsWith('.')) {
      tld = '.' + tld;
    }

    const status = row['Application Status']?.trim() as 'Active' | 'Deactivated';

    const brand = row['TLD Type: Brand']?.trim().toUpperCase() === 'TRUE';
    const geoSelf = row['TLD Type: Geo (Self-Designated)']?.trim().toUpperCase() === 'TRUE';
    const geoConf = row['TLD Type: Geo (String Review Confirmed)']?.trim().toUpperCase() === 'TRUE';
    const comm = row['TLD Type: Community']?.trim().toUpperCase() === 'TRUE';
    const idn = row['TLD Type: IDN']?.trim().toUpperCase() === 'TRUE';
    
    const types: string[] = [];
    if (brand) types.push('Brand');
    if (geoConf) types.push('GEO (Confirmed)');
    else if (geoSelf) types.push('GEO (Self-Designated)');
    if (comm) types.push('Community'); 

    const allTypes: string[] = [];
    if (brand) allTypes.push('Brand');
    if (geoSelf || geoConf) allTypes.push('GEO');
    if (comm) allTypes.push('Community');
    if (idn) allTypes.push('IDN');
    
    if (allTypes.length === 0) {
      allTypes.push('Andra');
    }

    if (isReplacement) {
      app.replacement = { tld, status, types, allTypes, appId };
    } else {
      app.primary = { tld, status, types, allTypes, appId };
    }
  });

  const contentionLevel = new Map<string, number>();
  for (const app of applications.values()) {
    if (app.primary && app.primary.status === 'Active') {
      const tld = app.primary.tld;
      contentionLevel.set(tld, (contentionLevel.get(tld) || 0) + 1);
    }
  }

  const allTlds = new Set<string>();
  for (const app of applications.values()) {
    if (app.primary) allTlds.add(app.primary.tld);
    if (app.replacement) allTlds.add(app.replacement.tld);
  }

  const tldInfos: TldInfo[] = [];

  for (const tld of allTlds) {
    const involvedApps = Array.from(applications.values()).filter(
      app => app.primary?.tld === tld || app.replacement?.tld === tld
    );

    const applicantsData = involvedApps.map(app => ({
      applicantName: app.applicantName,
      location: app.location,
      region: app.region,
      isPrimaryForThis: app.primary?.tld === tld,
      isReplacementForThis: app.replacement?.tld === tld,
      primary: app.primary ? { tld: app.primary.tld, status: app.primary.status, types: app.primary.types, allTypes: app.primary.allTypes, appId: app.primary.appId } : null,
      replacement: app.replacement ? { tld: app.replacement.tld, status: app.replacement.status, types: app.replacement.types, allTypes: app.replacement.allTypes, appId: app.replacement.appId } : null,
    }));

    const tldAllTypes = new Set<string>();
    involvedApps.forEach(app => {
      if (app.primary?.tld === tld) app.primary.allTypes.forEach(t => tldAllTypes.add(t));
      if (app.replacement?.tld === tld) app.replacement.allTypes.forEach(t => tldAllTypes.add(t));
    });

    const isActiveSomewhere = involvedApps.some(app => 
      (app.primary?.tld === tld && app.primary.status === 'Active') ||
      (app.replacement?.tld === tld && app.replacement.status === 'Active')
    );

    let color: ColorType = 'Red';
    let reason = '';

    if (!isActiveSomewhere) {
      color = 'Red';
      reason = `Alla ansökningar för denna TLD har status Deactivated. Ingen är kvar i racet.`;
    } else {
      const activePrimaryApps = involvedApps.filter(app => app.primary?.tld === tld && app.primary.status === 'Active');
      
      if (activePrimaryApps.length > 0) {
        const hasLockedApplicant = activePrimaryApps.some(app => !app.replacement || app.replacement.status === 'Deactivated');
        
        if (hasLockedApplicant) {
          color = 'DarkGreen';
          const lockedApp = activePrimaryApps.find(app => !app.replacement || app.replacement.status === 'Deactivated')!;
          reason = `Minst en sökande (${lockedApp.applicantName}) har denna som aktivt förstaval och deras reservsträng är deaktiverad (eller saknas). De är låsta till denna TLD.`;
        } else {
          color = 'LightGreen';
          reason = `Denna TLD är ett aktivt förstaval för minst en sökande, men alla dessa har fortfarande en aktiv reserv kvar som de potentiellt kan hoppa till.`;
        }
      } else {
        const activeReplacementApps = involvedApps.filter(app => app.replacement?.tld === tld && app.replacement.status === 'Active');
        
        const hasHighContentionPrimary = activeReplacementApps.some(app => {
          if (!app.primary) return false;
          return (contentionLevel.get(app.primary.tld) || 0) > 1;
        });

        if (hasHighContentionPrimary) {
          color = 'Yellow';
          const highContApp = activeReplacementApps.find(app => {
            if (!app.primary) return false;
            return (contentionLevel.get(app.primary.tld) || 0) > 1;
          })!;
          reason = `Denna TLD är enbart en aktiv reserv, men sökanden (${highContApp.applicantName}) har hög konkurrens på sitt förstaval (${highContApp.primary?.tld}) och kan tvingas flytta hit.`;
        } else {
          color = 'DarkYellow';
          const lowContApp = activeReplacementApps[0];
          reason = `Denna TLD är enbart en aktiv reserv, men sökanden (${lowContApp.applicantName}) har ingen/låg konkurrens på sitt förstaval (${lowContApp.primary?.tld}). De kommer troligen få förstavalet och släppa denna reserv.`;
        }
      }
    }

    tldInfos.push({
      tld,
      color,
      reason,
      allTypes: Array.from(tldAllTypes),
      applicants: applicantsData,
    });
  }

  const colorOrder = { 'DarkGreen': 1, 'LightGreen': 2, 'Yellow': 3, 'DarkYellow': 4, 'Red': 5 };
  tldInfos.sort((a, b) => colorOrder[a.color] - colorOrder[b.color] || a.tld.localeCompare(b.tld));

  return tldInfos;
};

const ColorMap = {
  DarkGreen: { bg: 'bg-green-700', text: 'text-white', border: 'border-green-800', label: 'Garanterad / Låst' },
  LightGreen: { bg: 'bg-green-400', text: 'text-green-950', border: 'border-green-500', label: 'Hög sannolikhet' },
  Yellow: { bg: 'bg-yellow-400', text: 'text-yellow-950', border: 'border-yellow-500', label: 'Möjlig (krock)' },
  DarkYellow: { bg: 'bg-yellow-600', text: 'text-white', border: 'border-yellow-700', label: 'Osannolik reserv' },
  Red: { bg: 'bg-red-500', text: 'text-white', border: 'border-red-600', label: 'Ute ur leken' },
};

type FilterType = 'Andra' | 'Brand' | 'GEO' | 'Community' | 'IDN';
const ALL_FILTERS: FilterType[] = ['Andra', 'Brand', 'GEO', 'Community', 'IDN'];

type SortOption = 'default' | 'name-asc' | 'name-desc' | 'applicants-desc' | 'applicants-asc' | 'length-desc' | 'length-asc';
const SORT_LABELS: Record<SortOption, string> = {
  'default': 'Status (Färgkod)',
  'name-asc': 'Namn (A-Ö)',
  'name-desc': 'Namn (Ö-A)',
  'applicants-desc': 'Antal sökande (Flest först)',
  'applicants-asc': 'Antal sökande (Minst först)',
  'length-desc': 'Längd (Längst först)',
  'length-asc': 'Längd (Kortast först)'
};


const TldDetailsPanel = ({ 
  item, 
  onClose, 
  onOpenPopup,
  onApplicantClick,
  onBack,
  hasBack,
  previousPopup
}: { 
  item: TldInfo, 
  onClose: () => void,
  onOpenPopup: (tld: string) => void,
  onApplicantClick: (applicant: string) => void,
  onBack?: () => void,
  hasBack?: boolean,
  previousPopup?: { type: 'tld' | 'applicant', id: string } | null
}) => {
  const panelColors = ColorMap[item.color];
  const isDarkTextPanel = item.color === 'LightGreen' || item.color === 'Yellow';

  return (
    <div className={cn(
      "w-full rounded-3xl p-6 md:p-8 shadow-sm border overflow-hidden relative",
      panelColors.bg, panelColors.text, panelColors.border
    )}>
      {/* Decorative background element */}
      <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
         <Info size={200} />
      </div>
      
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-8">
           <div className="flex items-center gap-4">
             {hasBack && onBack && (
               <button
                 onClick={onBack}
                 className={cn(
                   "p-2.5 rounded-full transition-colors duration-200 flex items-center justify-center shrink-0",
                   isDarkTextPanel ? "bg-black/5 hover:bg-black/10" : "bg-white/10 dark:bg-slate-900/10 hover:bg-white/20 dark:bg-slate-900/20"
                 )}
                 aria-label="Tillbaka"
                 title="Gå tillbaka"
               >
                 <ArrowLeft size={28} />
               </button>
             )}
             <h2 className="text-4xl md:text-5xl font-bold tracking-tight">{item.tld}</h2>
           </div>
           <button 
             onClick={onClose}
             className={cn(
               "p-2.5 rounded-full transition-colors duration-200 flex items-center justify-center shrink-0",
               isDarkTextPanel ? "bg-black/5 hover:bg-black/10" : "bg-white/10 dark:bg-slate-900/10 hover:bg-white/20 dark:bg-slate-900/20"
             )}
             aria-label="Stäng"
           >
             <X size={28} />
           </button>
        </div>

        <div className="grid lg:grid-cols-[1fr_2fr] gap-8">
          {/* Reason Column */}
          <div>
            <div className={cn(
              "p-5 md:p-6 rounded-2xl flex gap-4 items-start h-full",
              isDarkTextPanel ? "bg-black/5 border border-black/10 shadow-[inset_0_1px_3px_rgba(0,0,0,0.05)]" : "bg-black/20 border border-white/10 shadow-[inset_0_1px_3px_rgba(0,0,0,0.2)]"
            )}>
              <Info className="shrink-0 mt-1 opacity-80" size={24} />
              <div className="text-lg leading-relaxed">
                <strong className="block mb-3 font-bold text-sm uppercase tracking-widest opacity-80">
                  Status & Motivering
                </strong>
                <span className="opacity-95 block">{item.reason}</span>
              </div>
            </div>
          </div>

          {/* Applicants Column */}
          <div>
            <h4 className="font-bold text-sm uppercase tracking-widest opacity-80 mb-4 flex items-center gap-4">
              Sökande ({item.applicants.length})
              <div className={cn("h-px flex-grow", isDarkTextPanel ? "bg-black/10" : "bg-white/20 dark:bg-slate-900/20")}></div>
            </h4>
            
            <div className="grid sm:grid-cols-2 gap-4">
              {(() => {
                const activePrimaryCount = item.applicants.filter(a => a.isPrimaryForThis && a.primary?.status === 'Active').length;
                
                return item.applicants.map((app, i) => {
                const isOnlyPrimary = app.isPrimaryForThis && app.primary?.status === 'Active' && activePrimaryCount === 1;
                const hasActiveReserve = app.replacement?.status === 'Active';
                
                const ringClass = isOnlyPrimary 
                  ? (hasActiveReserve
                      ? "ring-2 ring-sky-400 dark:ring-sky-400 shadow-[0_0_15px_rgba(56,189,248,0.3)] relative z-10"
                      : "ring-2 ring-amber-400 dark:ring-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.35)] relative z-10")
                  : "";

                return (
                <div 
                  key={i} 
                  className={cn(
                    "p-4 md:p-5 rounded-2xl flex flex-col transition-transform hover:-translate-y-0.5",
                    item.color === 'LightGreen'
                      ? "bg-white/50 dark:bg-emerald-900 shadow-sm border border-black/5 dark:border-emerald-700/50 dark:text-emerald-50"
                      : isDarkTextPanel 
                        ? "bg-white/50 dark:bg-slate-900/60 shadow-sm border border-black/5 dark:border-slate-700/50 dark:text-slate-100" 
                        : "bg-white/10 dark:bg-slate-900/30 shadow-sm border border-white/10 backdrop-blur-sm",
                    ringClass
                  )}
                >
                  <div 
                    className={cn(
                      "font-bold text-lg mb-3 cursor-pointer group/app inline-flex items-center gap-1.5 w-fit",
                      (previousPopup?.type === 'applicant' && previousPopup.id === app.applicantName) || 
                      (previousPopup?.type === 'tld' && (app.primary?.tld === previousPopup.id || app.replacement?.tld === previousPopup.id))
                        ? "!text-fuchsia-600 dark:!text-fuchsia-400" 
                        : ""
                    )} 
                    onClick={() => onApplicantClick(app.applicantName)} 
                    title="Klicka för att se fler ansökningar från den här sökanden"
                  >
                    <span className="border-b border-transparent group-hover/app:border-current transition-colors">{app.applicantName}</span>
                    <Search size={14} className="opacity-0 group-hover/app:opacity-60 transition-opacity" />
                  </div>
                  
                  {/* Badges for THIS TLD */}
                  <div className="flex flex-col gap-2.5">
                    {app.isPrimaryForThis && app.primary && (
                      <a 
                        href={`https://newgtldprogram-aps.icann.org/applications/${app.primary.appId}/summary`}
                        target="_blank"
                        rel="noreferrer"
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-white font-medium shadow-sm flex items-center gap-2 text-sm self-start hover:opacity-90 transition-opacity cursor-pointer group/link",
                          app.primary.status === 'Active' ? "bg-emerald-600" : "bg-red-500"
                        )}
                        title="Se ansökan på ICANN"
                      >
                        <div className="w-2 h-2 rounded-full bg-white/80 dark:bg-slate-900/80 shadow-inner shrink-0" />
                        <span>Primär ({app.primary.tld}): {app.primary.status}</span>
                        {app.primary.types.length > 0 && <span className="opacity-80">({app.primary.types.join(', ')})</span>}
                        <ExternalLink size={12} className="opacity-50 group-hover/link:opacity-100" />
                      </a>
                    )}
                    {app.isReplacementForThis && app.replacement && (
                      <a 
                        href={`https://newgtldprogram-aps.icann.org/applications/${app.replacement.appId}/summary`}
                        target="_blank"
                        rel="noreferrer"
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-white font-medium shadow-sm flex items-center gap-2 text-sm self-start hover:opacity-90 transition-opacity cursor-pointer group/link",
                          app.replacement.status === 'Active' ? "bg-blue-600" : "bg-red-500"
                        )}
                        title="Se ansökan på ICANN"
                      >
                        <div className="w-2 h-2 rounded-full bg-white/80 dark:bg-slate-900/80 shadow-inner shrink-0" />
                        <span>Reserv ({app.replacement.tld}): {app.replacement.status}</span>
                        {app.replacement.types.length > 0 && <span className="opacity-80">({app.replacement.types.join(', ')})</span>}
                        <ExternalLink size={12} className="opacity-50 group-hover/link:opacity-100" />
                      </a>
                    )}
                  </div>
                  
                  {/* Information about the OTHER linked TLD (if it exists) */}
                  {app.isPrimaryForThis && app.replacement && (
                    <div 
                      className={cn(
                        "mt-4 text-sm opacity-90 p-3 rounded-xl cursor-pointer transition flex items-center justify-between group",
                        isDarkTextPanel 
                          ? "bg-black/5 hover:bg-black/10 border border-black/10 dark:bg-black/20 dark:hover:bg-black/30 dark:border-transparent" 
                          : "bg-black/20 hover:bg-black/30 border border-white/10"
                      )}
                      onClick={() => onOpenPopup(app.replacement!.tld)}
                    >
                      <div>
                        <span className="font-semibold text-[10px] uppercase tracking-widest block mb-0.5 opacity-70">Sökandens Reserv</span>
                        <span className={cn(
                          "font-bold text-base",
                          previousPopup?.type === 'tld' && previousPopup.id === app.replacement.tld ? "!text-fuchsia-600 dark:!text-fuchsia-400" : ""
                        )}>{app.replacement.tld}</span> 
                        <span className="opacity-80 ml-2">({app.replacement.status})</span>
                      </div>
                      <ArrowRight size={16} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  )}
                  {app.isReplacementForThis && app.primary && (
                    <div 
                      className={cn(
                        "mt-4 text-sm opacity-90 p-3 rounded-xl cursor-pointer transition flex items-center justify-between group",
                        isDarkTextPanel 
                          ? "bg-black/5 hover:bg-black/10 border border-black/10 dark:bg-black/20 dark:hover:bg-black/30 dark:border-transparent" 
                          : "bg-black/20 hover:bg-black/30 border border-white/10"
                      )}
                      onClick={() => onOpenPopup(app.primary!.tld)}
                    >
                      <div>
                        <span className="font-semibold text-[10px] uppercase tracking-widest block mb-0.5 opacity-70">Sökandens Förstaval</span>
                        <span className={cn(
                          "font-bold text-base",
                          previousPopup?.type === 'tld' && previousPopup.id === app.primary.tld ? "!text-fuchsia-600 dark:!text-fuchsia-400" : ""
                        )}>{app.primary.tld}</span> 
                        <span className="opacity-80 ml-2">({app.primary.status})</span>
                      </div>
                      <ArrowRight size={16} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  )}
                </div>
              );
            });
          })()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};


export default function App() {
  const [data, setData] = useState<TldInfo[]>([]);
  const [search, setSearch] = useState('');
  const [activeFilters, setActiveFilters] = useState<Set<FilterType>>(new Set());
  const [activeColors, setActiveColors] = useState<Set<ColorType>>(new Set());
  const [activeRegions, setActiveRegions] = useState<Set<string>>(new Set());
  const [isDragging, setIsDragging] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('theme');
      if (savedTheme) {
        return savedTheme === 'dark';
      }
      return true; // Default to dark theme
    }
    return true; // Default to dark theme
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);
  const [regionSearch, setRegionSearch] = useState('');
  const [showRegionDropdown, setShowRegionDropdown] = useState(false);
  const [sortOption, setSortOption] = useState<SortOption>('default');
  const [showSortDropdown, setShowSortDropdown] = useState(false);

  const [applicantSearch, setApplicantSearch] = useState('');
  const [showApplicantDropdown, setShowApplicantDropdown] = useState(false);

  const [expandedTld, setExpandedTld] = useState<string | null>(null);
  type PopupState = { type: 'tld' | 'applicant', id: string };
  const [popupHistory, setPopupHistory] = useState<PopupState[]>([]);
  
  const currentPopup = popupHistory.length > 0 ? popupHistory[popupHistory.length - 1] : null;

  const handleOpenTldPopup = (tld: string) => {
    setPopupHistory(prev => {
      if (prev.length === 0 && expandedTld) {
        return [{ type: 'tld', id: expandedTld }, { type: 'tld', id: tld }];
      }
      return [...prev, { type: 'tld', id: tld }];
    });
  };

  const handleOpenApplicantPopup = (applicantName: string) => {
    setPopupHistory(prev => {
      if (prev.length === 0 && expandedTld) {
        return [{ type: 'tld', id: expandedTld }, { type: 'applicant', id: applicantName }];
      }
      return [...prev, { type: 'applicant', id: applicantName }];
    });
  };
  const handleClosePopup = () => setPopupHistory([]);
  const handleBackPopup = () => setPopupHistory(prev => prev.slice(0, -1));
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);
  const [privacyPolicy, setPrivacyPolicy] = useState('');
  const cols = useColumnCount();

  useEffect(() => {
    if (isPrivacyOpen && !privacyPolicy) {
      fetch('https://assets.s4m.dev/assets/txt/Privacy_Policy.txt')
        .then(res => res.text())
        .then(setPrivacyPolicy)
        .catch(err => {
          console.error(err);
          setPrivacyPolicy('Kunde inte ladda integritetspolicyn.');
        });
    }
  }, [isPrivacyOpen, privacyPolicy]);

  useEffect(() => {
    if (currentPopup !== null || isPrivacyOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [currentPopup, isPrivacyOpen]);

    const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      setData(parseData(text));
      setExpandedTld(null);
      handleClosePopup();
    };
    reader.readAsText(file);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && (file.name.endsWith('.csv') || file.type === 'text/csv' || file.type === 'application/vnd.ms-excel')) {
      processFile(file);
    }
  };



  const toggleFilter = (f: FilterType) => {
    setActiveFilters(prev => {
      const next = new Set(prev);
      if (next.has(f)) next.delete(f);
      else next.add(f);
      return next;
    });
  };

  const toggleColor = (c: ColorType) => {
    setActiveColors(prev => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  };

  const filteredData = useMemo(() => {
    let result = data;
    
    if (activeFilters.size > 0 || activeRegions.size > 0) {
      result = result.filter(item => 
        item.applicants.some(a => {
          const matchesRegion = activeRegions.size === 0 || activeRegions.has(a.region) || activeRegions.has(a.location);
          const applicantTypes = new Set<string>();
          if (a.isPrimaryForThis && a.primary) a.primary.allTypes.forEach(t => applicantTypes.add(t));
          if (a.isReplacementForThis && a.replacement) a.replacement.allTypes.forEach(t => applicantTypes.add(t));
          const matchesType = activeFilters.size === 0 || Array.from(applicantTypes).some(t => activeFilters.has(t as FilterType));
          return matchesRegion && matchesType;
        })
      );
    }

    if (activeColors.size > 0) {
      result = result.filter(item => activeColors.has(item.color));
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(item => 
        item.tld.toLowerCase().includes(q) || 
        item.applicants.some(a => a.applicantName.toLowerCase().includes(q))
      );
    }
    
    const sorted = [...result];
    const colorOrder = { 'DarkGreen': 1, 'LightGreen': 2, 'Yellow': 3, 'DarkYellow': 4, 'Red': 5 };
    
    sorted.sort((a, b) => {
      switch (sortOption) {
        case 'name-asc':
          return a.tld.localeCompare(b.tld);
        case 'name-desc':
          return b.tld.localeCompare(a.tld);
        case 'applicants-desc':
          return b.applicants.length - a.applicants.length || a.tld.localeCompare(b.tld);
        case 'applicants-asc':
          return a.applicants.length - b.applicants.length || a.tld.localeCompare(b.tld);
        case 'length-desc':
          return Array.from(b.tld).length - Array.from(a.tld).length || a.tld.localeCompare(b.tld);
        case 'length-asc':
          return Array.from(a.tld).length - Array.from(b.tld).length || a.tld.localeCompare(b.tld);
        case 'default':
        default:
          return colorOrder[a.color] - colorOrder[b.color] || a.tld.localeCompare(b.tld);
      }
    });

    return sorted;
  }, [data, search, activeFilters, activeColors, activeRegions, sortOption]);


  const availableRegions = useMemo(() => {
    const s = new Set<string>();
    data.forEach(item => {
      item.applicants.forEach(a => {
        if (a.region && a.region !== 'Unknown') s.add(a.region);
        if (a.location && a.location !== 'Unknown') s.add(a.location);
      });
    });
    return Array.from(s).sort();
  }, [data]);

  const filteredRegions = useMemo(() => {
    if (!regionSearch.trim()) return availableRegions.slice(0, 10);
    const q = regionSearch.toLowerCase();
    return availableRegions.filter(r => r.toLowerCase().includes(q)).slice(0, 10);
  }, [availableRegions, regionSearch]);

  const availableApplicants = useMemo(() => {
    const s = new Set<string>();
    
    let relevantData = data;
    
    if (activeColors.size > 0) {
      relevantData = relevantData.filter(item => activeColors.has(item.color));
    }

    relevantData.forEach(item => {
      item.applicants.forEach(a => {
        if (a.applicantName) {
          const matchesRegion = activeRegions.size === 0 || activeRegions.has(a.region) || activeRegions.has(a.location);
          const applicantTypes = new Set<string>();
          if (a.isPrimaryForThis && a.primary) a.primary.allTypes.forEach(t => applicantTypes.add(t));
          if (a.isReplacementForThis && a.replacement) a.replacement.allTypes.forEach(t => applicantTypes.add(t));
          const matchesType = activeFilters.size === 0 || Array.from(applicantTypes).some(t => activeFilters.has(t as FilterType));
          
          if (matchesRegion && matchesType) {
            s.add(a.applicantName);
          }
        }
      });
    });
    return Array.from(s).sort();
  }, [data, activeFilters, activeColors, activeRegions]);

  const filteredApplicants = useMemo(() => {
    if (!applicantSearch.trim()) return availableApplicants;
    const q = applicantSearch.toLowerCase();
    return availableApplicants.filter(a => a.toLowerCase().includes(q));
  }, [availableApplicants, applicantSearch]);

  const rows = useMemo(() => {
    const r = [];
    for (let i = 0; i < filteredData.length; i += cols) {
      r.push(filteredData.slice(i, i + cols));
    }
    return r;
  }, [filteredData, cols]);

  const renderedGrid = useMemo(() => {
    return rows.map((row, rowIndex) => {
      const expandedItemInRow = row.find(item => item.tld === expandedTld);

      return (
        <React.Fragment key={rowIndex}>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {row.map(item => {
              const colors = ColorMap[item.color];
              const isExpanded = expandedTld === item.tld;
              const isDarkText = item.color === 'LightGreen' || item.color === 'Yellow';
              
              return (
                <div 
                  key={item.tld} 
                  className={cn(
                    "rounded-2xl p-4 flex flex-col shadow-sm border transition-all duration-200 hover:shadow-md relative overflow-hidden h-[120px] cursor-pointer",
                    colors.bg, colors.text, colors.border,
                    isExpanded ? "ring-2 ring-offset-2 ring-indigo-500 scale-[1.02]" : "hover:scale-[1.02]"
                  )}
                  onClick={() => setExpandedTld(isExpanded ? null : item.tld)}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />

                  <div className="flex flex-col justify-between gap-4 relative z-10 h-full">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-2xl font-bold tracking-tight truncate max-w-[150px]" title={item.tld}>{item.tld}</h3>
                        <span className="text-[11px] font-bold uppercase tracking-widest opacity-80 mt-1 inline-block">
                          {colors.label}
                        </span>
                      </div>
                      <div 
                        className={cn(
                          "p-1.5 rounded-full transition-colors duration-200 backdrop-blur-sm shrink-0",
                          isDarkText ? "bg-black/5" : "bg-white/10 dark:bg-slate-900/10"
                        )}
                      >
                        {isExpanded ? (
                          <X size={20} />
                        ) : (
                          <Info size={20} />
                        )}
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-end mt-1">
                      <span className="text-sm font-medium opacity-80 flex items-center gap-1.5">
                        <div className={cn("w-2 h-2 rounded-full", isDarkText ? "bg-current opacity-40" : "bg-white dark:bg-slate-900 opacity-40")} />
                        {item.applicants.length} {item.applicants.length === 1 ? 'sökande' : 'sökande'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* Full-width Expanded Details Panel */}
          {expandedItemInRow && (
            <div className="animate-in fade-in slide-in-from-top-2 duration-300">
              <TldDetailsPanel 
                item={expandedItemInRow} 
                onClose={() => setExpandedTld(null)}
                onOpenPopup={handleOpenTldPopup}
                onApplicantClick={handleOpenApplicantPopup}
              />
            </div>
          )}
        </React.Fragment>
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, expandedTld]);

  if (typeof window !== 'undefined' && window.location.pathname !== '/' && window.location.pathname !== '/index.html' && window.location.pathname !== '/404.html') {
    return (
      <div className="min-h-screen p-6 max-w-7xl mx-auto font-sans flex flex-col items-center justify-center text-center relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none flex justify-center items-center">
           <div className="w-96 h-96 bg-indigo-500/20 dark:bg-indigo-500/10 blur-[100px] rounded-full" />
        </div>
        
        <h1 className="text-9xl font-black text-transparent bg-clip-text bg-gradient-to-br from-indigo-600 to-fuchsia-600 dark:from-indigo-400 dark:to-fuchsia-400 mb-4 drop-shadow-sm relative z-10">
          404
        </h1>
        <h2 className="text-4xl font-bold text-gray-900 dark:text-slate-100 mb-6 tracking-tight relative z-10">Sidan hittades inte</h2>
        <p className="text-gray-500 dark:text-slate-400 max-w-md mx-auto mb-12 text-lg leading-relaxed relative z-10">
          Det verkar som att du har navigerat till en adress som inte existerar. 
        </p>
        <a 
          href="/" 
          className="px-8 py-3.5 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 transition-all font-semibold shadow-lg hover:shadow-indigo-500/25 hover:-translate-y-1 flex items-center gap-2 group relative z-10"
        >
          <ArrowLeft size={20} className="transition-transform group-hover:-translate-x-1" />
          Tillbaka till startsidan
        </a>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 max-w-7xl mx-auto font-sans">
      <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-slate-100 tracking-tight">ICANN gTLD Tracker</h1>
          <p className="text-gray-500 dark:text-slate-400 mt-1 text-sm">Visualisering av domänansökningar (2026)</p>
        </div>
        
        <div className="flex flex-wrap gap-3 items-center">
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="p-2.5 bg-white dark:bg-slate-800 text-gray-500 dark:text-gray-300 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-700 transition shadow-sm border border-gray-200 dark:border-slate-700"
            title="Växla ljust/mörkt tema"
          >
            {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          <a
            href="https://newgtldprogram-aps.icann.org/applications"
            target="_blank"
            rel="noreferrer"
            className="px-4 py-2 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition flex items-center gap-2 font-medium text-sm shadow-sm border border-gray-200 dark:border-slate-700"
            title="Gå till ICANNs ansökningsportal"
          >
            <ExternalLink size={16} />
            ICANN Portalen
          </a>

          <label className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition cursor-pointer flex items-center gap-2 font-medium text-sm shadow-sm">
            <Upload size={16} />
            Ladda upp CSV
            <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
          </label>
        </div>
      </header>

      {data.length > 0 && (
        <div className="mb-8">
                    <div className="relative mb-5">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" size={20} />
            <input 
              type="text" 
              placeholder="Sök på TLD eller företagsnamn..." 
              className="w-full pl-10 pr-10 py-3 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-900"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button 
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 p-1 rounded-full transition-colors"
                title="Rensa sökning"
              >
                <X size={18} />
              </button>
            )}
          </div>
          <div className="flex flex-col gap-3">
            {/* TLD Type Filters & Applicant Dropdown */}
            <div className="flex flex-wrap sm:flex-nowrap items-start justify-between gap-4 w-full relative z-30">
              <div className="flex flex-wrap items-center gap-2">
                <div className="w-6 flex justify-center"><Filter size={16} className="text-gray-400 dark:text-slate-500" /></div>
                <button 
                  onClick={() => setActiveFilters(new Set())}
                  className={cn(
                    "px-4 py-1.5 rounded-full text-sm font-medium transition-colors border",
                    activeFilters.size === 0 
                      ? "bg-gray-800 dark:bg-slate-700 text-white border-gray-800 dark:border-slate-600 shadow-sm" 
                      : "bg-white dark:bg-slate-900 text-gray-600 dark:text-slate-400 border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:bg-slate-800"
                  )}
                >
                  Alla Typer
                </button>
                {ALL_FILTERS.map(f => (
                  <button 
                    key={f}
                    onClick={() => toggleFilter(f)}
                    className={cn(
                      "px-4 py-1.5 rounded-full text-sm font-medium transition-colors border",
                      activeFilters.has(f)
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-sm" 
                        : "bg-white dark:bg-slate-900 text-gray-600 dark:text-slate-400 border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:bg-slate-800"
                    )}
                  >
                    {f}
                  </button>
                ))}
              </div>

              {/* Applicant Dropdown */}
              <div className="relative shrink-0 w-full sm:w-64">
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" />
                  <input 
                    type="text" 
                    placeholder="Välj företag/sökande..." 
                    className="w-full pl-9 pr-8 py-2 rounded-xl text-sm font-medium border border-gray-200 dark:border-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-900"
                    value={applicantSearch}
                    onChange={(e) => { setApplicantSearch(e.target.value); setShowApplicantDropdown(true); }}
                    onFocus={() => setShowApplicantDropdown(true)}
                    onBlur={() => setTimeout(() => setShowApplicantDropdown(false), 200)}
                  />
                  {applicantSearch && (
                    <button 
                      onClick={() => setApplicantSearch('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 p-0.5 rounded-full"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
                
                {showApplicantDropdown && filteredApplicants.length > 0 && (
                  <div className="absolute right-0 mt-2 w-full sm:w-96 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-gray-200/60 dark:border-slate-700/60 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] max-h-72 overflow-y-auto p-1.5 animate-in fade-in zoom-in-95 duration-100 z-50">
                    {filteredApplicants.map(a => (
                      <div 
                        key={a}
                        className="group px-3 py-2.5 hover:bg-indigo-50/80 dark:hover:bg-indigo-900/50 text-gray-700 dark:text-slate-300 hover:text-indigo-900 dark:hover:text-indigo-100 cursor-pointer text-sm font-medium transition-all rounded-xl mb-0.5 last:mb-0 flex items-center gap-2"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleOpenApplicantPopup(a);
                          setApplicantSearch('');
                          setShowApplicantDropdown(false);
                        }}
                      >
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-300 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                        <span className="truncate">{a}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Color/Status Filters */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="w-6 flex justify-center"><Palette size={16} className="text-gray-400 dark:text-slate-500" /></div>
              <button 
                onClick={() => setActiveColors(new Set())}
                className={cn(
                  "px-4 py-1.5 rounded-full text-sm font-medium transition-colors border",
                  activeColors.size === 0 
                    ? "bg-gray-800 dark:bg-slate-700 text-white border-gray-800 dark:border-slate-600 shadow-sm" 
                    : "bg-white dark:bg-slate-900 text-gray-600 dark:text-slate-400 border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:bg-slate-800"
                )}
              >
                Alla Färger
              </button>
              {ALL_COLORS.map(c => (
                <button 
                  key={c}
                  onClick={() => toggleColor(c)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-sm font-medium transition-colors border flex items-center gap-2",
                    activeColors.has(c)
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-sm" 
                      : "bg-white dark:bg-slate-900 text-gray-700 dark:text-slate-300 border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:bg-slate-800"
                  )}
                >
                  <div className={cn("w-2.5 h-2.5 rounded-full", ColorMap[c].bg, activeColors.has(c) ? "ring-1 ring-white/50" : "")}></div>
                  {ColorMap[c].label}
                </button>
              ))}
            </div>

            {/* Region/Location & Sort Filters */}
            <div className="flex flex-wrap sm:flex-nowrap items-start justify-between gap-4 mt-1 relative w-full">
              <div className="flex flex-wrap items-center gap-2">
                <div className="w-6 flex justify-center"><Search size={16} className="text-gray-400 dark:text-slate-500" /></div>
                <div className="relative">
                  <input 
                    type="text" 
                    placeholder="Sök region/land..." 
                    className="w-48 px-3 py-1.5 rounded-full text-sm font-medium border border-gray-200 dark:border-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-900"
                    value={regionSearch}
                    onChange={(e) => { setRegionSearch(e.target.value); setShowRegionDropdown(true); }}
                    onFocus={() => setShowRegionDropdown(true)}
                    onBlur={() => setTimeout(() => setShowRegionDropdown(false), 200)}
                  />
                  {showRegionDropdown && filteredRegions.length > 0 && (
                    <div className="absolute z-20 top-full mt-2 left-0 w-64 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-gray-200/60 dark:border-slate-700/60 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] max-h-64 overflow-y-auto p-1.5 animate-in fade-in zoom-in-95 duration-100">
                      {filteredRegions.map(r => (
                        <div 
                          key={r}
                          className="group px-3 py-2.5 hover:bg-indigo-50/80 dark:hover:bg-indigo-900/50 text-gray-700 dark:text-slate-300 hover:text-indigo-900 dark:hover:text-indigo-100 cursor-pointer text-sm font-medium transition-all rounded-xl mb-0.5 last:mb-0 flex items-center gap-2"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setActiveRegions(prev => {
                              const next = new Set(prev);
                              next.add(r);
                              return next;
                            });
                            setRegionSearch('');
                            setShowRegionDropdown(false);
                          }}
                        >
                          <div className="w-1.5 h-1.5 rounded-full bg-indigo-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                          {r}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {Array.from(activeRegions).map(r => (
                  <div key={r} className="flex items-center gap-1.5 px-3 py-1 bg-indigo-50 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 rounded-full font-medium shadow-sm border border-indigo-100 dark:border-indigo-800">
                    <span className="text-sm">{r}</span>
                    <button 
                      onClick={() => {
                        setActiveRegions(prev => {
                          const next = new Set(prev);
                          next.delete(r);
                          return next;
                        });
                      }}
                      className="p-0.5 hover:bg-indigo-200 rounded-md transition-colors"
                    >
                      <X size={14} className="text-indigo-700 dark:text-indigo-300" />
                    </button>
                  </div>
                ))}
                
                {activeRegions.size > 0 && (
                  <button 
                    onClick={() => setActiveRegions(new Set())}
                    className="text-xs text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:text-slate-300 underline ml-1"
                  >
                    Rensa
                  </button>
                )}
              </div>

              {/* Sort Dropdown */}
              <div className="relative shrink-0">
                <button 
                  onClick={() => setShowSortDropdown(!showSortDropdown)}
                  className="px-4 py-1.5 rounded-full text-sm font-medium transition-colors border bg-white dark:bg-slate-900 text-gray-700 dark:text-slate-300 border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 flex items-center gap-2 shadow-sm"
                >
                  <ArrowDownUp size={16} className="opacity-70" />
                  {SORT_LABELS[sortOption]}
                  <ChevronDown size={14} className={cn("opacity-70 transition-transform", showSortDropdown && "rotate-180")} />
                </button>
                
                {showSortDropdown && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowSortDropdown(false)} />
                    <div className="absolute z-20 right-0 top-full mt-2 w-64 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-gray-200/60 dark:border-slate-700/60 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] p-1.5 animate-in fade-in zoom-in-95 duration-100">
                      {(Object.entries(SORT_LABELS) as [SortOption, string][]).map(([key, label]) => (
                        <button
                          key={key}
                          className={cn(
                            "w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center justify-between mb-0.5 last:mb-0",
                            sortOption === key 
                              ? "bg-indigo-50 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300"
                              : "text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800"
                          )}
                          onClick={() => {
                            setSortOption(key as SortOption);
                            setShowSortDropdown(false);
                          }}
                        >
                          {label}
                          {sortOption === key && <Check size={16} />}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {data.length === 0 ? (
        <div 
          className={cn(
            "text-center py-24 px-6 rounded-3xl border-2 border-dashed transition-all duration-200 flex flex-col items-center justify-center",
            isDragging 
              ? "bg-indigo-50 dark:bg-indigo-900/20 border-indigo-400 dark:border-indigo-500 scale-[1.02] shadow-xl" 
              : "bg-white dark:bg-slate-900 border-gray-300 dark:border-slate-700 shadow-sm hover:border-gray-400 dark:hover:border-slate-600"
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className={cn(
            "w-20 h-20 rounded-full flex items-center justify-center mb-6 transition-colors duration-200",
            isDragging ? "bg-indigo-100 dark:bg-indigo-800" : "bg-gray-100 dark:bg-slate-800"
          )}>
            <Upload size={32} className={isDragging ? "text-indigo-600 dark:text-indigo-400" : "text-gray-400 dark:text-slate-500"} />
          </div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-2">
            {isDragging ? "Släpp filen här!" : "Dra och släpp din CSV-fil här"}
          </h3>
          <p className="text-gray-500 dark:text-slate-400 mb-8 max-w-sm">
            Du kan också klicka på knappen högst upp till höger, eller knappen nedan, för att bläddra efter filer.
          </p>
          <label className="px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition cursor-pointer flex items-center gap-2 font-semibold shadow-md hover:shadow-lg hover:-translate-y-0.5">
            <Upload size={18} />
            Välj en fil
            <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
          </label>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {renderedGrid}

          
          {filteredData.length === 0 && (
            <div className="text-center py-10 text-gray-500 dark:text-slate-400 w-full">
              Inga resultat hittades för dessa filter
            </div>
          )}
        </div>
      )}

      {/* Popups */}
      {popupHistory.length > 0 && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" 
          onClick={handleClosePopup}
        >
          {popupHistory.map((popup, index) => {
            const isActive = index === popupHistory.length - 1;
            const prevPopup = index > 0 ? popupHistory[index - 1] : null;
            
            if (popup.type === 'tld') {
              const tldData = data.find(d => d.tld === popup.id);
              if (!tldData) return null;
              
              return (
                <div 
                  key={`tld-${index}-${popup.id}`}
                  className={cn(
                    "absolute inset-0 flex items-center justify-center p-4 md:p-8 transition-opacity duration-200",
                    isActive ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
                  )}
                >
                  <div 
                    className="w-full max-w-5xl max-h-full rounded-3xl shadow-2xl overflow-hidden flex flex-col bg-white dark:bg-slate-900"
                    onClick={e => e.stopPropagation()}
                  >
                    <div className="overflow-y-auto w-full h-full">
                      <TldDetailsPanel 
                        item={tldData} 
                        onClose={handleClosePopup}
                        onOpenPopup={handleOpenTldPopup} 
                        onApplicantClick={handleOpenApplicantPopup}
                        hasBack={index > 0}
                        onBack={handleBackPopup}
                        previousPopup={prevPopup}
                      />
                    </div>
                  </div>
                </div>
              );
            }

            if (popup.type === 'applicant') {
              const applicantName = popup.id;
              const applicantTlds = data.filter(tld => tld.applicants.some(a => a.applicantName === applicantName));
              
              return (
                <div 
                  key={`app-${index}-${popup.id}`}
                  className={cn(
                    "absolute inset-0 flex items-center justify-center p-4 md:p-8 transition-opacity duration-200",
                    isActive ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
                  )}
                >
                  <div 
                    className="w-full max-w-4xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-h-full flex flex-col overflow-hidden"
                    onClick={e => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between p-6 md:px-8 md:pt-8 md:pb-6 border-b border-gray-100 dark:border-slate-800 shrink-0">
                      <div className="flex items-center gap-4">
                        {index > 0 && (
                          <button
                            onClick={handleBackPopup}
                            className="p-2.5 rounded-full transition-colors duration-200 flex items-center justify-center shrink-0 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300"
                            aria-label="Tillbaka"
                            title="Gå tillbaka"
                          >
                            <ArrowLeft size={24} />
                          </button>
                        )}
                        <div>
                          <h2 className="text-2xl font-bold text-gray-900 dark:text-slate-100">{applicantName}</h2>
                          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">{applicantTlds.length} {applicantTlds.length === 1 ? 'ansökan' : 'ansökningar'}</p>
                        </div>
                      </div>
                      <button 
                        onClick={handleClosePopup}
                        className="p-2 -mr-2 rounded-full hover:bg-gray-100 dark:bg-slate-800 transition-colors"
                      >
                        <X size={24} className="text-gray-500 dark:text-slate-400" />
                      </button>
                    </div>
                    
                    <div className="p-6 md:p-8 overflow-y-auto flex-1 w-full bg-gray-50 dark:bg-slate-800">
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {applicantTlds.map(item => {
                          const colors = ColorMap[item.color];
                          const appInfo = item.applicants.find(a => a.applicantName === applicantName)!;
                          const activePrimaryCount = item.applicants.filter(a => a.isPrimaryForThis && a.primary?.status === 'Active').length;
                          const isOnlyPrimary = appInfo.isPrimaryForThis && appInfo.primary?.status === 'Active' && activePrimaryCount === 1;
                          const hasActiveReserve = appInfo.replacement?.status === 'Active';

                          const ringClass = isOnlyPrimary 
                            ? (hasActiveReserve
                                ? "ring-2 ring-sky-400 dark:ring-sky-400 shadow-[0_0_15px_rgba(56,189,248,0.3)] relative z-10"
                                : "ring-2 ring-amber-400 dark:ring-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.35)] relative z-10")
                            : "";
                          
                          return (
                            <div 
                              key={item.tld}
                              className={cn(
                                "rounded-2xl p-4 flex flex-col shadow-sm border transition-all hover:scale-[1.02] cursor-pointer",
                                colors.bg, colors.text, colors.border,
                                ringClass
                              )}
                              onClick={() => {
                                 handleOpenTldPopup(item.tld);
                              }}
                            >
                              <div className="flex justify-between items-start mb-4">
                                <h3 
                                  className={cn(
                                    "text-xl font-bold tracking-tight truncate", 
                                    prevPopup?.type === 'tld' && prevPopup.id === item.tld 
                                      ? (colors.text === 'text-white' ? "!text-fuchsia-200" : "!text-fuchsia-700") 
                                      : ""
                                  )} 
                                  title={item.tld}
                                >
                                  {item.tld}
                                </h3>
                                <span className="text-[9px] font-bold uppercase tracking-widest opacity-80 bg-black/10 px-2 py-1 rounded-md">
                                  {colors.label}
                                </span>
                              </div>
                              
                              <div className="mt-auto space-y-2">
                                {appInfo.isPrimaryForThis && appInfo.primary && (
                                   <div className="text-xs bg-white/20 dark:bg-slate-900/20 backdrop-blur-sm p-2.5 rounded-xl flex items-center gap-2 font-medium shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)] border border-black/5">
                                     <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", appInfo.primary.status === 'Active' ? "bg-emerald-500" : "bg-red-500")} />
                                     Primär: {appInfo.primary.status}
                                   </div>
                                )}
                                {appInfo.isReplacementForThis && appInfo.replacement && (
                                   <div className="text-xs bg-black/10 backdrop-blur-sm p-2.5 rounded-xl flex items-center gap-2 font-medium border border-white/10">
                                     <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", appInfo.replacement.status === 'Active' ? "bg-blue-500" : "bg-red-500")} />
                                     Reserv: {appInfo.replacement.status}
                                   </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            }
            return null;
          })}
        </div>
      )}

      {/* Privacy Policy Modal */}
      {isPrivacyOpen && (
        <div 
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 md:p-8 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" 
          onClick={() => setIsPrivacyOpen(false)}
        >
          <div 
            className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-h-full flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Fast Header */}
            <div className="flex items-center justify-between p-6 md:px-8 md:pt-8 md:pb-6 border-b border-gray-100 dark:border-slate-800 shrink-0">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Privacy Policy</h2>
              <button 
                onClick={() => setIsPrivacyOpen(false)}
                className="p-2 -mr-2 rounded-full hover:bg-gray-100 dark:bg-slate-800 transition-colors"
              >
                <X size={24} className="text-gray-500 dark:text-slate-400" />
              </button>
            </div>
            
            {/* Scrollable Content */}
            <div className="p-6 md:p-8 overflow-y-auto flex-1 w-full relative">
              {!privacyPolicy ? (
                <div className="flex justify-center items-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                </div>
              ) : (
                <div 
                  className="text-gray-700 dark:text-slate-300 leading-relaxed space-y-4 text-sm"
                  dangerouslySetInnerHTML={{ 
                    __html: privacyPolicy
                      .replace(/&/g, '&amp;')
                      .replace(/</g, '&lt;')
                      .replace(/>/g, '&gt;')
                      .replace(/\n/g, '<br />')
                      .replace(/Google Ads Settings/g, '<a href="https://www.google.com/settings/ads" target="_blank" rel="noreferrer" class="text-indigo-600 hover:underline font-medium">Google Ads Settings</a>')
                      .replace(/home@s4m\.dev/g, '<a href="mailto:home@s4m.dev" class="text-indigo-600 hover:underline font-medium">home@s4m.dev</a>')
                  }} 
                />
              )}
            </div>
          </div>
        </div>
      )}

      <footer className="mt-12 mb-8 pt-8 border-t border-gray-200 dark:border-slate-700 text-center text-gray-500 dark:text-slate-400 text-sm w-full">
        <p className="mb-2">
          &copy; {new Date().getFullYear() > 2026 ? `2026 - ${new Date().getFullYear()}` : '2026'}{' '}
          <a href="https://tld.s4m.dev" target="_blank" rel="noreferrer" className="text-indigo-600 hover:text-indigo-800 transition-colors font-medium">
            TLD.S4m.dev
          </a>
          {' '}och{' '}
          <a href="https://www.s4m.dev/" target="_blank" rel="noreferrer" className="text-indigo-600 hover:text-indigo-800 transition-colors font-medium">
            S4m.dev
          </a>
          .
        </p>
        <button 
          onClick={() => setIsPrivacyOpen(true)}
          className="text-gray-400 dark:text-slate-500 hover:text-indigo-600 transition-colors text-xs"
        >
          Privacy Policy
        </button>
      </footer>
    </div>
  );
}




