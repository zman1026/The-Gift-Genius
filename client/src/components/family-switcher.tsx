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
    } else if (value === 'join-group') {
      setLocation('/families/join');
    } else if (value !== selectedFamilyId) {
      // Only update if actually changing to a different group
      setSelectedFamilyId(value);
    }
  };

  return (
    <Select value={selectedFamilyId || undefined} onValueChange={handleFamilyChange}>
      <SelectTrigger className="w-full" data-testid="group-switcher">
        <SelectValue placeholder="Select group" />
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
          data-testid="group-option-create-new"
        >
          <div className="flex items-center gap-2 text-primary">
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>Create New Group</span>
          </div>
        </SelectItem>
        <SelectItem 
          value="join-group"
          data-testid="group-option-join"
        >
          <div className="flex items-center gap-2 text-primary">
            <UserPlus className="w-4 h-4" aria-hidden="true" />
            <span>Join a Group</span>
          </div>
        </SelectItem>
      </SelectContent>
    </Select>
  );
}
