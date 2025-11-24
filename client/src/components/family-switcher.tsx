import { useFamily } from "@/contexts/FamilyContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectSeparator,
} from "@/components/ui/select";
import { Users, Plus, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical } from "lucide-react";

export function FamilySwitcher() {
  const { selectedFamilyId, setSelectedFamilyId, families, isLoading } = useFamily();
  const [, setLocation] = useLocation();

  if (isLoading || families.length === 0) {
    return null;
  }

  // Single family: show static display with menu for create/join
  if (families.length === 1) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-md flex-1 min-w-0">
          <Users className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <span className="text-sm font-medium text-foreground truncate" data-testid="single-family-name">
            {families[0].name}
          </span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0"
              data-testid="button-family-menu"
            >
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setLocation('/families/create')} data-testid="menu-create-family">
              <Plus className="w-4 h-4 mr-2" />
              Create New Family
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setLocation('/families/join')} data-testid="menu-join-family">
              <UserPlus className="w-4 h-4 mr-2" />
              Join a Family
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }

  // Multiple families: show dropdown with create/join options
  const handleFamilyChange = (value: string) => {
    if (value === 'create-new') {
      setLocation('/families/create');
    } else if (value === 'join-family') {
      setLocation('/families/join');
    } else if (value !== selectedFamilyId) {
      // Only update if actually changing to a different family
      setSelectedFamilyId(value);
    }
  };

  return (
    <Select value={selectedFamilyId || undefined} onValueChange={handleFamilyChange}>
      <SelectTrigger className="w-full" data-testid="family-switcher">
        <div className="flex items-center gap-2 min-w-0">
          <Users className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <SelectValue placeholder="Select family" />
        </div>
      </SelectTrigger>
      <SelectContent>
        {families.map((family) => (
          <SelectItem 
            key={family.id} 
            value={family.id}
            data-testid={`family-option-${family.id}`}
          >
            {family.name}
          </SelectItem>
        ))}
        <SelectSeparator />
        <SelectItem 
          value="create-new"
          data-testid="family-option-create-new"
        >
          <div className="flex items-center gap-2 text-primary">
            <Plus className="w-4 h-4" />
            <span>Create New Family</span>
          </div>
        </SelectItem>
        <SelectItem 
          value="join-family"
          data-testid="family-option-join"
        >
          <div className="flex items-center gap-2 text-primary">
            <UserPlus className="w-4 h-4" />
            <span>Join a Family</span>
          </div>
        </SelectItem>
      </SelectContent>
    </Select>
  );
}
