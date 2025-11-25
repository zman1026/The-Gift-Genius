import { Gift, Users } from "lucide-react";
import { useFamily } from "@/contexts/FamilyContext";

export function GroupHeader() {
  const { selectedFamilyId, families } = useFamily();
  
  const selectedFamily = families.find(f => f.id === selectedFamilyId);
  
  if (!selectedFamily) {
    return (
      <div className="flex items-center gap-2" data-testid="mobile-header-logo">
        <Gift className="w-5 h-5 text-primary" aria-hidden="true" />
        <span className="font-serif text-lg font-semibold text-foreground">
          The Gift Genius
        </span>
      </div>
    );
  }

  return (
    <div 
      className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-lg"
      data-testid="mobile-header-group"
    >
      <Users className="w-5 h-5 text-primary" aria-hidden="true" />
      <span className="font-serif text-lg font-semibold text-foreground truncate max-w-[160px]">
        {selectedFamily.name}
      </span>
    </div>
  );
}
