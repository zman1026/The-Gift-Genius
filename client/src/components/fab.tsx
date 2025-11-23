import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FABProps {
  onClick: () => void;
  className?: string;
}

export function FAB({ onClick, className }: FABProps) {
  return (
    <Button
      size="icon"
      onClick={onClick}
      className={cn(
        "fixed bottom-20 right-4 md:bottom-6 md:right-6 z-50 h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all duration-200",
        "hover:scale-110 active:scale-95",
        className
      )}
      data-testid="fab-add-item"
    >
      <Plus className="w-6 h-6" />
    </Button>
  );
}
