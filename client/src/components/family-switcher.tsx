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
import { useLocation } from "wouter";

export function FamilySwitcher() {
  const { selectedFamilyId, setSelectedFamilyId, families, isLoading } = useFamily();
  const [, setLocation] = useLocation();

  if (isLoading || families.length === 0) {
    return null;
  }

  const handleFamilyChange = (value: string) => {
    if (value === 'create-new') {
      setLocation('/families/create');
    } else if (value === 'join-family') {
      setLocation('/families/join');
    } else {
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
