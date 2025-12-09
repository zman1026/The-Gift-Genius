import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, List, ListTree, Sparkles } from "lucide-react";
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
          onClick={() => setLocation('/my-wishlists')}
          className="flex-col h-auto py-4 gap-2"
          data-testid="quick-action-my-wishlists"
        >
          <List className="w-5 h-5" />
          <span className="text-xs">My Lists</span>
        </Button>
        
        <Button
          variant="outline"
          onClick={() => setLocation('/members')}
          className="flex-col h-auto py-4 gap-2"
          data-testid="quick-action-group-lists"
        >
          <ListTree className="w-5 h-5" />
          <span className="text-xs">Group Lists</span>
        </Button>
        
        <Button
          variant="outline"
          onClick={() => setLocation('/gift-coordination')}
          className="flex-col h-auto py-4 gap-2"
          data-testid="quick-action-coordination"
        >
          <Sparkles className="w-5 h-5" />
          <span className="text-xs">Coordinate</span>
        </Button>
      </CardContent>
    </Card>
  );
}
