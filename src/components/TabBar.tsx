
import type { ActiveTab } from '../types/tournament';

interface Props {
  active: ActiveTab;
  onChange: (tab: ActiveTab) => void;
  showSeeding: boolean;
}

export default function TabBar({ active, onChange, showSeeding }: Props) {
  const tabs: { id: ActiveTab; label: string; icon: string }[] = [
    { id: 'bracket', label: 'Bracket', icon: '🏆' },
    { id: 'schedule', label: 'Schedule', icon: '📅' },
  ];

  if (showSeeding) {
    tabs.push({ id: 'seeding', label: 'Seeding', icon: '🔀' });
  }

  return (
    <div className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 flex safe-bottom z-40">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`relative flex-1 flex flex-col items-center py-3 gap-0.5 transition-colors ${
            active === tab.id ? 'text-green-600' : 'text-gray-400'
          }`}
        >
          <span className="text-xl leading-none">{tab.icon}</span>
          <span className="text-[10px] font-semibold">{tab.label}</span>
          {active === tab.id && (
            <div className="absolute bottom-0 h-0.5 w-10 bg-green-500 rounded-t" />
          )}
        </button>
      ))}
    </div>
  );
}
