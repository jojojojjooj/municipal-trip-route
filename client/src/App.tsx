import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { lazy, Suspense } from "react";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import NotFound from "./pages/NotFound";
const Home = lazy(() => import("./pages/Home"));
const SharedTrip = lazy(() => import("./pages/SharedTrip"));

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/share/:token" component={SharedTrip} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}
export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Suspense
            fallback={
              <main className="grid min-h-screen place-items-center bg-[#f7f2e9] text-sm text-[#1f2d2b]">
                출장동선을 불러오는 중입니다.
              </main>
            }
          >
            <Router />
          </Suspense>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
