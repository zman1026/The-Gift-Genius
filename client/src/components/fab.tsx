import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface FABProps {
  onClick: () => void;
  className?: string;
}

export function FAB({ onClick, className }: FABProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          size="icon"
          onClick={onClick}
          aria-label="Add wishlist item"
          className={cn(
            "fixed bottom-20 right-4 md:bottom-6 md:right-6 z-50",
            "h-16 w-16 rounded-full shadow-2xl",
            "bg-primary hover:bg-primary/90",
            "transition-all duration-300 ease-out",
            "hover:scale-105 hover:shadow-[0_0_20px_rgba(220,38,38,0.4)]",
            "active:scale-95",
            "relative group overflow-hidden",
            className
          )}
          data-testid="fab-add-item"
        >
          <Plus className="w-7 h-7 text-primary-foreground transition-transform group-hover:rotate-90 duration-300 relative z-10" />
          <span className="absolute inset-2 rounded-full bg-primary/20 animate-ping opacity-75 pointer-events-none" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="left">
        <p>Add item to wishlist</p>
      </TooltipContent>
    </Tooltip>
  );
}
