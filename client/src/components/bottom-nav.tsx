import { Link, useLocation } from "wouter";
import { Users, Gift, ListTree, PlusCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface BottomNavProps {
  onAddItemClick?: () => void;
  disabled?: boolean;
}

export function BottomNav({ onAddItemClick, disabled = false }: BottomNavProps) {
  const [location] = useLocation();

  const navItems = [
    {
      path: "/my-wishlists",
      icon: Gift,
      label: "My Lists",
      testId: "nav-wishlists",
    },
    {
      path: "/members",
      icon: ListTree,
      label: "Group Lists",
      testId: "nav-group-lists",
    },
    {
      path: "/gift-coordination",
      icon: Users,
      label: "Coordinate",
      testId: "nav-coordinate",
    },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 safe-area-inset-bottom">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const isActive = location === item.path || 
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
                <Icon className="w-5 h-5" aria-hidden="true" />
                <span className="text-xs font-medium">{item.label}</span>
              </div>
            </Link>
          );
        })}
        
        {/* Add Item Button */}
        <button
          onClick={onAddItemClick}
          disabled={disabled}
          className="flex-1"
          data-testid="nav-add-item"
        >
          <div className={cn(
            "flex flex-col items-center justify-center h-full min-w-[44px] min-h-[44px] gap-1 transition-colors",
            disabled 
              ? "text-muted-foreground/50 cursor-not-allowed"
              : "text-primary hover-elevate active-elevate-2"
          )}>
            <PlusCircle className="w-5 h-5" aria-hidden="true" />
            <span className="text-xs font-medium">Add Item</span>
          </div>
        </button>
      </div>
    </nav>
  );
}
