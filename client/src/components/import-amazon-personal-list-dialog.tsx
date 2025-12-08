import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, Package, ExternalLink, CheckCircle2 } from "lucide-react";
import { SiAmazon } from "react-icons/si";

interface AmazonItem {
  amazonItemId: string;
  asin: string | null;
  title: string;
  price: string | null;
  imageUrl: string | null;
  productUrl: string | null;
}

interface PreviewResponse {
  wishlistTitle: string;
  listId: string;
  itemCount: number;
  items: AmazonItem[];
}

interface ImportAmazonPersonalListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listId: string;
  listName: string;
}

export function ImportAmazonPersonalListDialog({
  open,
  onOpenChange,
  listId,
  listName,
}: ImportAmazonPersonalListDialogProps) {
  const { toast } = useToast();
  const [url, setUrl] = useState("");
  const [previewData, setPreviewData] = useState<PreviewResponse | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [importComplete, setImportComplete] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [skippedCount, setSkippedCount] = useState(0);

  const previewMutation = useMutation({
    mutationFn: async (wishlistUrl: string) => {
      const response = await apiRequest("POST", "/api/import/amazon-wishlist/preview", { url: wishlistUrl });
      return response.json();
    },
    onSuccess: (data: PreviewResponse) => {
      setPreviewData(data);
      setSelectedItems(new Set(data.items.map(item => item.amazonItemId)));
    },
    onError: (error: any) => {
      setPreviewData(null);
      setSelectedItems(new Set());
      toast({
        title: "Failed to load wishlist",
        description: error.message || "Could not fetch the Amazon wishlist. Make sure the URL is correct and the list is public.",
        variant: "destructive",
      });
    },
  });

  const importMutation = useMutation({
    mutationFn: async (items: AmazonItem[]) => {
      const response = await apiRequest("POST", "/api/import/amazon-wishlist/import-personal-list", {
        items,
        listId,
      });
      return response.json();
    },
    onSuccess: (data: { 
      importedCount: number; 
      skippedCount?: number;
      totalRequested: number; 
      skippedItems?: string[];
      errors?: string[] 
    }) => {
      setImportedCount(data.importedCount);
      setSkippedCount(data.skippedCount || 0);
      setImportComplete(true);
      
      queryClient.invalidateQueries({ queryKey: ["/api/personal-lists", listId] });
      queryClient.invalidateQueries({ queryKey: ["/api/personal-lists"] });
      queryClient.invalidateQueries({ queryKey: ["/api/personal-lists", listId, "items"] });
      
      if (data.skippedCount && data.skippedCount > 0) {
        toast({
          title: `Imported ${data.importedCount} items`,
          description: `${data.skippedCount} items skipped (already in list).`,
          variant: "default",
        });
      } else if (data.errors && data.errors.length > 0) {
        toast({
          title: `Imported ${data.importedCount} items`,
          description: `${data.errors.length} items could not be imported.`,
          variant: "default",
        });
      }
    },
    onError: (error: any) => {
      setSelectedItems(new Set());
      toast({
        title: "Import failed",
        description: error.message || "Failed to import items. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handlePreview = () => {
    if (!url.trim()) {
      toast({
        title: "URL required",
        description: "Please paste an Amazon wishlist URL",
        variant: "destructive",
      });
      return;
    }
    previewMutation.mutate(url.trim());
  };

  const handleImport = () => {
    if (!previewData) return;
    
    const itemsToImport = previewData.items.filter(item => selectedItems.has(item.amazonItemId));
    if (itemsToImport.length === 0) {
      toast({
        title: "No items selected",
        description: "Please select at least one item to import",
        variant: "destructive",
      });
      return;
    }
    
    importMutation.mutate(itemsToImport);
  };

  const handleClose = () => {
    setUrl("");
    setPreviewData(null);
    setSelectedItems(new Set());
    setImportComplete(false);
    setImportedCount(0);
    setSkippedCount(0);
    onOpenChange(false);
  };

  const toggleItem = (itemId: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedItems(newSelected);
  };

  const toggleAll = () => {
    if (!previewData) return;
    if (selectedItems.size === previewData.items.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(previewData.items.map(item => item.amazonItemId)));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => isOpen ? onOpenChange(true) : handleClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SiAmazon className="h-5 w-5 text-[#FF9900]" />
            Import Amazon Wishlist
          </DialogTitle>
          <DialogDescription>
            Import items from an Amazon wishlist to "{listName}"
          </DialogDescription>
        </DialogHeader>

        {importComplete ? (
          <div className="flex flex-col items-center justify-center py-8 gap-4">
            <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-semibold">Import Complete!</h3>
              <p className="text-muted-foreground">
                Successfully imported {importedCount} item{importedCount !== 1 ? 's' : ''} to your list.
              </p>
              {skippedCount > 0 && (
                <p className="text-sm text-muted-foreground mt-1">
                  {skippedCount} item{skippedCount !== 1 ? 's' : ''} skipped (already in list)
                </p>
              )}
            </div>
            <Button onClick={handleClose} data-testid="button-close-import">
              Done
            </Button>
          </div>
        ) : !previewData ? (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="amazon-url">Amazon Wishlist URL</Label>
              <Input
                id="amazon-url"
                placeholder="https://www.amazon.com/hz/wishlist/ls/ABC123..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                data-testid="input-amazon-url"
              />
              <p className="text-sm text-muted-foreground">
                Paste the link to a public Amazon wishlist. The list must be set to "Public" or "Shared" on Amazon.
              </p>
            </div>
            
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <h4 className="font-medium text-sm">How to find your Amazon wishlist URL:</h4>
              <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Go to Amazon and open your wishlist</li>
                <li>Click "Share" or "Invite" and copy the link</li>
                <li>Make sure the list is set to "Public" or "Shared"</li>
              </ol>
              <p className="text-xs text-muted-foreground/80 mt-2">
                Both direct wishlist links and invite links are supported.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">{previewData.wishlistTitle}</h3>
                <p className="text-sm text-muted-foreground">
                  {previewData.itemCount} item{previewData.itemCount !== 1 ? 's' : ''} found
                </p>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={toggleAll}
                data-testid="button-toggle-all"
              >
                {selectedItems.size === previewData.items.length ? "Deselect All" : "Select All"}
              </Button>
            </div>
            
            <div 
              className="border rounded-lg overflow-y-auto overscroll-contain -webkit-overflow-scrolling-touch"
              style={{ maxHeight: '50vh', WebkitOverflowScrolling: 'touch' }}
            >
              <div className="p-2 space-y-2">
                {previewData.items.map((item) => (
                  <div
                    key={item.amazonItemId}
                    className="flex items-start gap-3 p-2 rounded-lg hover-elevate cursor-pointer"
                    onClick={() => toggleItem(item.amazonItemId)}
                    data-testid={`item-amazon-${item.amazonItemId}`}
                  >
                    <Checkbox
                      checked={selectedItems.has(item.amazonItemId)}
                      onCheckedChange={() => toggleItem(item.amazonItemId)}
                      className="mt-1"
                      data-testid={`checkbox-item-${item.amazonItemId}`}
                    />
                    <div className="h-16 w-16 flex-shrink-0 rounded-md bg-muted overflow-hidden">
                      {item.imageUrl ? (
                        <img 
                          src={item.imageUrl} 
                          alt={item.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center">
                          <Package className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium line-clamp-2">{item.title}</p>
                      {item.price && (
                        <p className="text-sm text-muted-foreground mt-1">{item.price}</p>
                      )}
                    </div>
                    {item.productUrl && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="flex-shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(item.productUrl!, '_blank');
                        }}
                        data-testid={`button-view-${item.amazonItemId}`}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
            
            <div className="text-sm text-muted-foreground">
              {selectedItems.size} of {previewData.items.length} items selected
            </div>
          </div>
        )}

        {!importComplete && (
          <DialogFooter className="gap-2 sm:gap-0">
            {previewData ? (
              <>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setPreviewData(null);
                    setSelectedItems(new Set());
                  }}
                  data-testid="button-back"
                >
                  Back
                </Button>
                <Button 
                  onClick={handleImport}
                  disabled={selectedItems.size === 0 || importMutation.isPending}
                  data-testid="button-import-items"
                >
                  {importMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>Import {selectedItems.size} Item{selectedItems.size !== 1 ? 's' : ''}</>
                  )}
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={handleClose} data-testid="button-cancel">
                  Cancel
                </Button>
                <Button 
                  onClick={handlePreview}
                  disabled={!url.trim() || previewMutation.isPending}
                  data-testid="button-load-wishlist"
                >
                  {previewMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    "Load Wishlist"
                  )}
                </Button>
              </>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
