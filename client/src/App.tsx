import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { useAuth } from "@/hooks/useAuth";
import { FamilyProvider } from "@/contexts/FamilyContext";
import { FamilySwitcher } from "@/components/family-switcher";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import Home from "@/pages/home";
import CreateFamily from "@/pages/create-family";
import JoinFamily from "@/pages/join-family";
import Wishlist from "@/pages/wishlist";
import Members from "@/pages/members";
import MemberWishlist from "@/pages/member-wishlist";
import Search from "@/pages/search";

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  if (isLoading || !isAuthenticated) {
    return (
      <>
        <Switch>
          <Route path="/" component={Landing} />
          <Route component={NotFound} />
        </Switch>
        <Toaster />
      </>
    );
  }

  return (
    <FamilyProvider>
      <SidebarProvider style={style as React.CSSProperties}>
        <div className="flex h-screen w-full">
          <AppSidebar />
          <div className="flex flex-col flex-1 overflow-hidden">
            <header className="flex items-center justify-between p-2 border-b border-border gap-4">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <FamilySwitcher />
            </header>
            <main className="flex-1 overflow-y-auto">
              <Switch>
                <Route path="/" component={Home} />
                <Route path="/families/create" component={CreateFamily} />
                <Route path="/families/join" component={JoinFamily} />
                <Route path="/wishlist" component={Wishlist} />
                <Route path="/members" component={Members} />
                <Route path="/members/:userId" component={MemberWishlist} />
                <Route path="/search" component={Search} />
                <Route component={NotFound} />
              </Switch>
            </main>
          </div>
        </div>
        <Toaster />
      </SidebarProvider>
    </FamilyProvider>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppContent />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
