import { Link, useLocation } from "wouter";
import { Users, Gift, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

export function BottomNav() {
  const [location] = useLocation();

  const navItems = [
    {
      path: "/wishlist",
      icon: Gift,
      label: "My List",
      testId: "nav-wishlist",
    },
    {
      path: "/members",
      icon: Users,
      label: "Family",
      testId: "nav-members",
    },
    {
      path: "/more",
      icon: MoreHorizontal,
      label: "More",
      testId: "nav-more",
    },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 safe-area-inset-bottom">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          // Highlight "My List" for both "/" and "/wishlist" routes
          const isActive = location === item.path || 
                          (item.path === "/wishlist" && location === "/") ||
                          (item.path !== "/" && location.startsWith(item.path));
          const Icon = item.icon;
          
          return (
            <Link
              key={item.path}
              href={item.path}
              className="flex-1"
              data-testid={item.testId}
            >
              <div
                className={cn(
                  "flex flex-col items-center justify-center h-full min-w-[44px] min-h-[44px] gap-1 transition-colors",
                  isActive 
                    ? "text-primary" 
                    : "text-muted-foreground hover-elevate active-elevate-2"
                )}
              >
                <Icon className="w-5 h-5" />
                <span className="text-xs font-medium">{item.label}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
