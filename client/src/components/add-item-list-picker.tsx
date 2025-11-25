import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TreePine, Gift, ChevronRight, Plus } from "lucide-react";
import { useFamily } from "@/contexts/FamilyContext";
import { useLocation } from "wouter";
import { UnifiedAddItemDialog } from "@/components/unified-add-item-dialog";
import { queryClient } from "@/lib/queryClient";

interface PersonalList {
  id: string;
  title: string;
  occasion: string | null;
  eventDate: string | null;
  theme: string | null;
}

interface AddItemListPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: "quick" | "camera" | "custom";
}

export function AddItemListPicker({ open, onOpenChange, defaultTab = "quick" }: AddItemListPickerProps) {
  const { selectedFamilyId, families } = useFamily();
  const [, setLocation] = useLocation();
  const [showAddItemDialog, setShowAddItemDialog] = useState(false);
  
  const currentFamily = families.find((f: any) => f.id === selectedFamilyId);

  const { data: personalLists, isLoading: listsLoading } = useQuery<PersonalList[]>({
    queryKey: ["/api/personal-lists"],
    enabled: open,
  });

  const handleSelectChristmasList = () => {
    onOpenChange(false);
    setShowAddItemDialog(true);
  };

  const handleSelectPersonalList = (listId: string) => {
    onOpenChange(false);
    setLocation(`/personal-lists/${listId}?addItem=true`);
  };

  const handleCreatePersonalList = () => {
    onOpenChange(false);
    setLocation('/personal-lists/create');
  };

  const handleAddItemSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/wishlist"] });
    queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    queryClient.invalidateQueries({ queryKey: ["/api/families", selectedFamilyId, "gift-status"] });
    queryClient.invalidateQueries({ queryKey: ["/api/wishlist/member-counts"] });
  };

  const getOccasionIcon = (occasion: string | null) => {
    switch (occasion) {
      case "birthday":
        return <Gift className="w-5 h-5" />;
      default:
        return <Gift className="w-5 h-5" />;
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Item To...</DialogTitle>
            <DialogDescription>
              Choose which wishlist to add your item to
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 mt-2">
            {selectedFamilyId && (
              <Card 
                className="hover-elevate cursor-pointer border-2 border-transparent hover:border-primary/20 transition-colors"
                onClick={handleSelectChristmasList}
                data-testid="select-christmas-list"
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: '#FEF2F2' }}
                    >
                      <TreePine className="w-5 h-5" style={{ color: '#15803D' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground">Christmas Wishlist</h3>
                      <p className="text-xs text-muted-foreground truncate">
                        {currentFamily?.name || 'Group'} gift exchange
                      </p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            )}

            {listsLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : personalLists && personalLists.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1">
                  Personal Lists
                </p>
                {personalLists.map((list) => (
                  <Card 
                    key={list.id}
                    className="hover-elevate cursor-pointer border-2 border-transparent hover:border-primary/20 transition-colors"
                    onClick={() => handleSelectPersonalList(list.id)}
                    data-testid={`select-personal-list-${list.id}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                          {getOccasionIcon(list.occasion)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-foreground truncate">{list.title}</h3>
                          {list.occasion && (
                            <p className="text-xs text-muted-foreground capitalize">
                              {list.occasion.replace('_', ' ')}
                              {list.eventDate && ` - ${new Date(list.eventDate).toLocaleDateString()}`}
                            </p>
                          )}
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : null}

            <Button
              variant="outline"
              className="w-full justify-start gap-2"
              onClick={handleCreatePersonalList}
              data-testid="button-create-personal-list"
            >
              <Plus className="w-4 h-4" />
              Create New Personal List
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {selectedFamilyId && (
        <UnifiedAddItemDialog
          open={showAddItemDialog}
          onOpenChange={setShowAddItemDialog}
          familyId={selectedFamilyId}
          onSuccess={handleAddItemSuccess}
          defaultTab={defaultTab}
        />
      )}
    </>
  );
}
