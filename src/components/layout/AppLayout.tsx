import { Outlet } from 'react-router-dom';
import { AppSidebar } from './AppSidebar';
import { TrackerTopbar } from './TrackerTopbar';
import { useTheme } from '@/lib/theme-context';

export function AppLayout() {
  const { settings } = useTheme();
  const isRTL = settings.language === 'ar';

  return (
    <div className="flex h-screen overflow-hidden" dir={isRTL ? 'rtl' : 'ltr'}>
      <AppSidebar />
      <main className="flex-1 overflow-hidden flex flex-col">
        <TrackerTopbar />
        <div className="flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
