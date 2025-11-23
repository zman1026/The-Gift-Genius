import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link2, Search, Sparkles } from "lucide-react";

interface QuickAddBannerProps {
  onPasteUrl: (url: string) => void;
  onSearch: () => void;
}

export function QuickAddBanner({ onPasteUrl, onSearch }: QuickAddBannerProps) {
  const [urlInput, setUrlInput] = useState("");

  const handlePaste = () => {
    if (urlInput.trim()) {
      onPasteUrl(urlInput.trim());
      setUrlInput("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && urlInput.trim()) {
      handlePaste();
    }
  };

  return (
    <Card className="bg-gradient-to-r from-primary/5 to-accent/5 border-primary/20">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm text-foreground">Quick Add</h3>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1 flex gap-2">
            <Input
              placeholder="Paste product URL here..."
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1"
              data-testid="input-quick-url"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handlePaste}
              disabled={!urlInput.trim()}
              data-testid="button-quick-paste"
            >
              <Link2 className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Add</span>
            </Button>
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={onSearch}
            className="sm:w-auto"
            data-testid="button-quick-search"
          >
            <Search className="w-4 h-4 sm:mr-2" />
            <span>Search Products</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
