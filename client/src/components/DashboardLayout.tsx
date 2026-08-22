import { Button } from "@/components/ui/button";
import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { CalendarDays, Compass, LogOut, MapPinned, Menu, X } from "lucide-react";
import { useState } from "react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { loading, user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  if (loading) return <div className="min-h-screen bg-[#f5f1e8]" />;
  if (!user) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f5f1e8] p-6 text-center">
        <div className="max-w-md">
          <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#c4503d]">Municipal field service</p>
          <h1 className="font-display mt-4 text-5xl leading-[0.95]">출장의 흐름을<br />설계합니다.</h1>
          <p className="mt-5 text-sm leading-6 text-stone-600">저장된 출장 계획과 공유 링크는 담당자 계정으로 안전하게 관리됩니다.</p>
          <Button onClick={() => startLogin()} className="mt-8 rounded-none bg-[#1f2d2b] px-7 hover:bg-[#354743]">로그인하여 시작</Button>
        </div>
      </main>
    );
  }

  const navigation = (
    <nav className="mt-10 space-y-1 text-sm">
      <a href="#planner" className="flex items-center gap-3 border-l-2 border-[#c4503d] px-4 py-3 font-semibold text-[#1f2d2b]"><Compass className="h-4 w-4" /> 여정 설계</a>
      <a href="#saved-plans" className="flex items-center gap-3 border-l-2 border-transparent px-4 py-3 text-stone-600 hover:text-[#1f2d2b]"><CalendarDays className="h-4 w-4" /> 저장한 계획</a>
    </nav>
  );

  return (
    <div className="min-h-screen bg-[#f5f1e8] text-[#1d2422]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-black/10 bg-[#eee9de] p-6 lg:block">
        <div className="brand-lockup"><div className="brand-lockup-mark"><MapPinned className="h-4 w-4" /></div><div><span className="brand-lockup-name">여정도</span><small>FIELD OPERATIONS</small></div></div>
        <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.19em] text-stone-500">Municipal Trip Desk</p>
        {navigation}
        <div className="absolute bottom-7 left-6 right-6 border-t border-black/10 pt-5">
          <p className="font-display text-xl leading-none">{user.name ?? "담당자"}</p>
          <p className="mt-2 truncate text-xs text-stone-500">{user.email ?? "지자체 출장 관리"}</p>
          <button onClick={logout} className="mt-5 flex items-center gap-2 text-xs font-semibold text-stone-600 hover:text-[#c4503d]"><LogOut className="h-3.5 w-3.5" /> 로그아웃</button>
        </div>
      </aside>
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-black/10 bg-[#f5f1e8]/95 px-5 backdrop-blur lg:hidden">
        <div className="brand-lockup brand-lockup-mobile"><div className="brand-lockup-mark"><MapPinned className="h-3.5 w-3.5" /></div><div><span className="brand-lockup-name">여정도</span><small>FIELD OPS</small></div></div>
        <button onClick={() => setMenuOpen(open => !open)} aria-label="메뉴 열기">{menuOpen ? <X /> : <Menu />}</button>
      </header>
      {menuOpen && <div className="fixed inset-x-0 top-16 z-20 border-b border-black/10 bg-[#eee9de] px-5 pb-5 lg:hidden">{navigation}</div>}
      <main className="lg:pl-64">{children}</main>
    </div>
  );
}
