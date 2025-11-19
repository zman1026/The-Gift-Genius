import { useFamily } from "@/contexts/FamilyContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Users } from "lucide-react";

export function FamilySwitcher() {
  const { selectedFamilyId, setSelectedFamilyId, families, isLoading } = useFamily();

  if (isLoading || families.length === 0) {
    return null;
  }

  if (families.length === 1) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-md">
        <Users className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground" data-testid="single-family-name">
          {families[0].name}
        </span>
      </div>
    );
  }

  return (
    <Select value={selectedFamilyId || undefined} onValueChange={setSelectedFamilyId}>
      <SelectTrigger className="w-[200px]" data-testid="family-switcher">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-muted-foreground" />
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
      </SelectContent>
    </Select>
  );
}
