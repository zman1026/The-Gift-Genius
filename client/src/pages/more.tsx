import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Home, 
  Search, 
  ShoppingBag, 
  Activity, 
  Settings, 
  ChevronRight 
} from "lucide-react";

export default function More() {
  const [, setLocation] = useLocation();

  const menuItems = [
    {
      icon: Home,
      label: "Dashboard",
      description: "View stats and overview",
      path: "/dashboard",
      testId: "menu-dashboard",
    },
    {
      icon: Search,
      label: "Search Products",
      description: "Find items to add to wishlist",
      path: "/search",
      testId: "menu-search",
    },
    {
      icon: ShoppingBag,
      label: "Purchased Items",
      description: "Items you've bought for others",
      path: "/purchased",
      testId: "menu-purchased",
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="font-serif text-3xl md:text-4xl font-semibold text-foreground">
          More
        </h1>
        <p className="text-muted-foreground mt-1">
          Additional features and settings
        </p>
      </div>

      <div className="space-y-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          
          return (
            <Card
              key={item.path}
              className="hover-elevate cursor-pointer active-elevate-2"
              onClick={() => setLocation(item.path)}
              data-testid={item.testId}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground">{item.label}</h3>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  </div>

                  <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
