import Topbar from "@/components/layout/topBar/TopBar";
import Sidebar from "@/components/layout/LeftSidebar";

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-screen flex flex-col">
      {/* Topbar */}
      <header className="w-full h-16 bg-white border-b border-gray-300 z-50 flex-shrink-0">
        <Topbar />
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <Sidebar />

        {/* Main Content */}
        <main className="flex-1 p-4 bg-gray-50 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
