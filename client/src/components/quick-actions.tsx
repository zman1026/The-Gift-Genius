import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, List, ShoppingBag, Sparkles } from "lucide-react";
import { useLocation } from "wouter";

interface QuickActionsProps {
  onAddItemClick: () => void;
}

export function QuickActions({ onAddItemClick }: QuickActionsProps) {
  const [, setLocation] = useLocation();

  return (
    <Card data-testid="quick-actions">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-2">
        <Button
          onClick={onAddItemClick}
          className="flex-col h-auto py-4 gap-2"
          data-testid="quick-action-add-item"
        >
          <Plus className="w-5 h-5" />
          <span className="text-xs">Add Item</span>
        </Button>
        
        <Button
          variant="outline"
          onClick={() => setLocation('/wishlist')}
          className="flex-col h-auto py-4 gap-2"
          data-testid="quick-action-my-list"
        >
          <List className="w-5 h-5" />
          <span className="text-xs">My Wishlist</span>
        </Button>
        
        <Button
          variant="outline"
          onClick={() => setLocation('/purchased')}
          className="flex-col h-auto py-4 gap-2"
          data-testid="quick-action-purchases"
        >
          <ShoppingBag className="w-5 h-5" />
          <span className="text-xs">My Purchases</span>
        </Button>
        
        <Button
          variant="outline"
          onClick={() => setLocation('/search')}
          className="flex-col h-auto py-4 gap-2"
          data-testid="quick-action-search"
        >
          <Sparkles className="w-5 h-5" />
          <span className="text-xs">Find Gifts</span>
        </Button>
      </CardContent>
    </Card>
  );
}
