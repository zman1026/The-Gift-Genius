import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, Plus, ExternalLink, Gift, Sparkles, Users, Ticket, Upload, Camera } from "lucide-react";
import { ObjectUploader } from "@/components/ObjectUploader";
import type { UploadResult } from "@uppy/core";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { CameraCapture } from "@/components/camera-capture";
import { useEvent } from "@/contexts/EventContext";

// Form schema for custom items
const customItemSchema = z.object({
  name: z.string().min(1, "Item name is required").max(255),
  description: z.string().optional(),
  price: z.string().optional(),
  url: z.union([z.string().url("Must be a valid URL"), z.literal("")]).optional(),
  // Allow both absolute URLs and relative paths for object storage
  imageUrl: z.union([z.string().min(1), z.literal("")]).optional(),
  priority: z.enum(["high", "medium", "low"]).optional(),
  quantity: z.coerce.number().int().positive().optional(),
  category: z.string().optional(),
  itemType: z.enum(["product", "experience", "service", "membership", "other"]).optional(),
});

type CustomItemFormData = z.infer<typeof customItemSchema>;

interface UnifiedAddItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  familyId: string;
  onSuccess: () => void;
  targetUserId?: string;
  targetUserName?: string;
}

export function UnifiedAddItemDialog({
  open,
  onOpenChange,
  familyId,
  onSuccess,
  targetUserId,
  targetUserName,
}: UnifiedAddItemDialogProps) {
  const [activeTab, setActiveTab] = useState("quick");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [uploadedImageUrl, setUploadedImageUrl] = useState("");
  const [showExperienceSuggestion, setShowExperienceSuggestion] = useState(false);
  const [detectedType, setDetectedType] = useState<"experience" | "service" | "membership" | null>(null);
  const [suggestionDismissed, setSuggestionDismissed] = useState(false);
  const [lastDismissedQuery, setLastDismissedQuery] = useState("");
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [duplicateItem, setDuplicateItem] = useState<any>(null);
  const [pendingItem, setPendingItem] = useState<any>(null);
  const [pendingItemType, setPendingItemType] = useState<'search' | 'custom' | null>(null);
  const [isSearchingByImage, setIsSearchingByImage] = useState(false);
  const [imageSearchResults, setImageSearchResults] = useState<any[] | null>(null);
  const [imageSearchError, setImageSearchError] = useState<string | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();
  const { selectedEventId } = useEvent();

  // Keywords for detecting non-product queries
  const experienceKeywords = [
    "trip", "vacation", "travel", "visit", "tour", "adventure", "cruise", "holiday",
    "concert", "show", "event", "festival", "theater", "movie", "disney", "zoo",
    "aquarium", "museum", "park", "theme park", "water park", "camping", "hiking"
  ];
  
  const serviceKeywords = [
    "lessons", "class", "classes", "training", "course", "tutoring", "coaching",
    "massage", "spa", "salon", "haircut", "manicure", "pedicure", "facial",
    "cleaning", "lawn", "repair", "installation", "consultation", "therapy"
  ];
  
  const membershipKeywords = [
    "membership", "subscription", "gym", "fitness", "club", "pass", "season ticket",
    "annual pass", "monthly pass", "access", "premium", "pro account"
  ];

  const form = useForm<CustomItemFormData>({
    resolver: zodResolver(customItemSchema),
    defaultValues: {
      name: "",
      description: "",
      price: "",
      url: "",
      imageUrl: "",
      priority: "medium",
      quantity: 1,
      category: undefined,
      itemType: "product",
    },
  });

  // Search query for Quick Add
  const { data: searchResults, isLoading: isSearching, isFetching, error: searchError } = useQuery({
    queryKey: ["/api/search", searchTerm],
    queryFn: async () => {
      const response = await fetch(`/api/search?q=${encodeURIComponent(searchTerm)}`, {
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: "Failed to search products" }));
        throw new Error(error.message || "Failed to search products");
      }
      return response.json();
    },
    enabled: searchTerm.length > 0,
    retry: 1,
    staleTime: 5 * 60 * 1000,
  });

  // Show error toast if search fails
  useEffect(() => {
    if (searchError) {
      toast({
        title: "Search Failed",
        description: (searchError as Error).message || "Unable to search products. Please try again.",
        variant: "destructive",
      });
    }
  }, [searchError, toast]);

  // Handle search with debouncing
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      setSearchTerm(searchQuery.trim());
    }
  };

  // Detect non-product queries and show suggestion
  useEffect(() => {
    const query = searchQuery.toLowerCase().trim();
    
    if (!query) {
      setShowExperienceSuggestion(false);
      setDetectedType(null);
      setSuggestionDismissed(false);
      setLastDismissedQuery("");
      return;
    }

    // If query changed from last dismissed query, reset dismissed state
    if (suggestionDismissed && query !== lastDismissedQuery) {
      setSuggestionDismissed(false);
      setLastDismissedQuery("");
    }

    // Don't show suggestion if user already dismissed it for this query
    if (suggestionDismissed && query === lastDismissedQuery) {
      return;
    }

    // Helper function to check for word boundary matches
    const hasKeywordMatch = (keywords: string[]) => {
      return keywords.some(keyword => {
        // Create regex with word boundaries to avoid false positives
        const regex = new RegExp(`\\b${keyword}\\b`, 'i');
        return regex.test(query);
      });
    };

    // Check for keyword matches with word boundaries
    const hasExperienceKeyword = hasKeywordMatch(experienceKeywords);
    const hasServiceKeyword = hasKeywordMatch(serviceKeywords);
    const hasMembershipKeyword = hasKeywordMatch(membershipKeywords);

    if (hasExperienceKeyword) {
      setShowExperienceSuggestion(true);
      setDetectedType("experience");
    } else if (hasServiceKeyword) {
      setShowExperienceSuggestion(true);
      setDetectedType("service");
    } else if (hasMembershipKeyword) {
      setShowExperienceSuggestion(true);
      setDetectedType("membership");
    } else {
      setShowExperienceSuggestion(false);
      setDetectedType(null);
    }
  }, [searchQuery, suggestionDismissed, lastDismissedQuery]);

  // Auto-search when URL is pasted
  useEffect(() => {
    if (searchQuery.trim() && searchQuery.includes("http")) {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        setSearchTerm(searchQuery.trim());
      }, 500);
    }
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchQuery]);

  // Add product from search results
  const addFromSearchMutation = useMutation({
    mutationFn: async ({ product, override = false }: { product: any; override?: boolean }) => {
      if (!selectedEventId) {
        throw new Error("Please select an event first");
      }
      
      const payload = {
        name: product.title,
        description: product.snippet || "",
        // Backend expects price as string or null, not number
        price: product.extracted_price !== undefined && product.extracted_price !== null ? String(product.extracted_price) : null,
        url: product.link || "",
        imageUrl: product.thumbnail || "",
        productId: product.product_id || null,
        source: "google_shopping",
        priority: "medium",
        quantity: 1,
        category: null,
        itemType: "product",
        familyId,
        eventId: selectedEventId,
        override, // Pass override flag to bypass duplicate check if needed
      };

      // Use organizer endpoint if adding for another user
      const endpoint = targetUserId 
        ? `/api/families/${familyId}/members/${targetUserId}/wishlist`
        : "/api/wishlist/from-search";

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        
        // Handle duplicate detection (409 Conflict)
        if (response.status === 409 && !override) {
          setDuplicateItem(error.duplicateItem);
          setPendingItem(product);
          setPendingItemType('search');
          setShowDuplicateDialog(true);
          return null; // Don't throw error, just show dialog
        }
        
        throw new Error(error.message || "Failed to add item");
      }

      return response.json();
    },
    onSuccess: (data) => {
      if (data) { // Only close if actually added (not duplicate dialog)
        onSuccess();
        handleClose();
      }
    },
  });

  // Add custom item
  const addCustomItemMutation = useMutation({
    mutationFn: async ({ data, override = false }: { data: CustomItemFormData; override?: boolean }) => {
      if (!selectedEventId) {
        throw new Error("Please select an event first");
      }
      
      const payload = {
        ...data,
        // Backend expects price as a string or null, not a number
        price: data.price || null,
        familyId,
        eventId: selectedEventId,
        override, // Pass override flag to bypass duplicate check if needed
      };

      // Use organizer endpoint if adding for another user
      const endpoint = targetUserId 
        ? `/api/families/${familyId}/members/${targetUserId}/wishlist`
        : "/api/wishlist";

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        
        // Handle duplicate detection (409 Conflict)
        if (response.status === 409 && !override) {
          setDuplicateItem(error.duplicateItem);
          setPendingItem(data);
          setPendingItemType('custom');
          setShowDuplicateDialog(true);
          return null; // Don't throw error, just show dialog
        }
        
        throw new Error(error.message || "Failed to add item");
      }

      return response.json();
    },
    onSuccess: (data) => {
      if (data) { // Only close if actually added (not duplicate dialog)
        onSuccess();
        handleClose();
      }
    },
  });

  const handleGetUploadParameters = async () => {
    const res = await apiRequest("POST", "/api/objects/upload", {});
    const data = await res.json();
    return {
      method: "PUT" as const,
      url: data.uploadURL,
    };
  };

  const handleUploadComplete = async (result: UploadResult<Record<string, unknown>, Record<string, unknown>>) => {
    if (result.successful && result.successful.length > 0) {
      const uploadedFileUrl = result.successful[0].uploadURL;
      
      try {
        // Set ACL policy for the uploaded image
        const res = await apiRequest("PUT", "/api/wishlist-images", {
          imageUrl: uploadedFileUrl,
        });
        const data = await res.json();
        
        // Update form with the normalized object path
        setUploadedImageUrl(data.objectPath);
        form.setValue("imageUrl", data.objectPath);
        
        toast({
          title: "Success",
          description: "Image uploaded successfully!",
        });
      } catch (error: any) {
        toast({
          title: "Error",
          description: error.message || "Failed to set image permissions",
          variant: "destructive",
        });
      }
    }
  };

  const handleImageSearch = async (base64Image: string) => {
    console.log("handleImageSearch called, image size:", Math.round(base64Image.length / 1024), "KB");
    
    setIsSearchingByImage(true);
    setImageSearchResults(null);
    setImageSearchError(null);

    try {
      console.log("Sending image search request...");
      
      const response = await fetch("/api/search/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ image: base64Image }),
      });

      console.log("Response status:", response.status);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: "Failed to search by image" }));
        console.error("API error:", error);
        throw new Error(error.message || "Failed to search by image");
      }

      const data = await response.json();
      console.log("Search results:", data);
      
      setImageSearchResults(data.results || []);

      if (!data.results || data.results.length === 0) {
        toast({
          title: "No Results",
          description: "Couldn't find any products matching this image. Try a clearer photo or search manually.",
        });
      } else {
        toast({
          title: "Products Found!",
          description: `Found ${data.results.length} matching product${data.results.length !== 1 ? 's' : ''}`,
        });
      }
    } catch (error: any) {
      console.error("Image search error:", error);
      const errorMessage = error.message || "Failed to search by image. Please try again.";
      setImageSearchError(errorMessage);
      toast({
        title: "Search Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSearchingByImage(false);
      console.log("Image search complete, isSearchingByImage set to false");
    }
  };

  const handleClose = () => {
    // Reset all dialog state
    setSearchQuery("");
    setSearchTerm(""); // This will disable the query and clear results
    setUploadedImageUrl("");
    setShowExperienceSuggestion(false);
    setDetectedType(null);
    setSuggestionDismissed(false);
    setLastDismissedQuery("");
    setIsSearchingByImage(false);
    setImageSearchResults(null);
    setImageSearchError(null);
    form.reset();
    setActiveTab("quick");
    onOpenChange(false);
  };

  const handleDismissSuggestion = () => {
    setSuggestionDismissed(true);
    setLastDismissedQuery(searchQuery.toLowerCase().trim());
    setShowExperienceSuggestion(false);
  };

  const handleSwitchToCustomItem = () => {
    // Pre-fill the form with the search query
    form.setValue("name", searchQuery);
    
    // Set the detected item type
    if (detectedType) {
      form.setValue("itemType", detectedType);
    }
    
    // Switch to custom tab
    setActiveTab("custom");
    
    // Clear the suggestion
    setShowExperienceSuggestion(false);
  };

  const onSubmitCustom = (data: CustomItemFormData) => {
    addCustomItemMutation.mutate({ data });
  };

  // Handle confirming to add duplicate item anyway
  const handleConfirmDuplicate = () => {
    if (pendingItemType === 'search' && pendingItem) {
      addFromSearchMutation.mutate({ product: pendingItem, override: true });
    } else if (pendingItemType === 'custom' && pendingItem) {
      addCustomItemMutation.mutate({ data: pendingItem, override: true });
    }
    setShowDuplicateDialog(false);
    setDuplicateItem(null);
    setPendingItem(null);
    setPendingItemType(null);
  };

  const handleCancelDuplicate = () => {
    setShowDuplicateDialog(false);
    setDuplicateItem(null);
    setPendingItem(null);
    setPendingItemType(null);
  };

  const getItemTypeIcon = (type: string) => {
    switch (type) {
      case "product":
        return <Gift className="w-4 h-4" />;
      case "experience":
        return <Sparkles className="w-4 h-4" />;
      case "service":
        return <Users className="w-4 h-4" />;
      case "membership":
        return <Ticket className="w-4 h-4" />;
      default:
        return <Plus className="w-4 h-4" />;
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{targetUserName ? `Add to ${targetUserName}'s Wish List` : "Add to Wishlist"}</DialogTitle>
            <DialogDescription>
              Search for a product or create a custom item
            </DialogDescription>
          </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="quick" data-testid="tab-quick-add">
              <Search className="w-4 h-4 mr-2" />
              Search
            </TabsTrigger>
            <TabsTrigger value="camera" data-testid="tab-camera">
              <Camera className="w-4 h-4 mr-2" />
              Camera
            </TabsTrigger>
            <TabsTrigger value="custom" data-testid="tab-custom-item">
              <Plus className="w-4 h-4 mr-2" />
              Manual
            </TabsTrigger>
          </TabsList>

          {/* Quick Add Tab */}
          <TabsContent value="quick" className="space-y-4 mt-4">
            <form onSubmit={handleSearch} className="flex gap-2">
              <Input
                placeholder="Paste a URL or search for anything..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="input-quick-search"
                className="flex-1"
              />
              <Button type="submit" disabled={isSearching || isFetching} data-testid="button-search">
                {isSearching || isFetching ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
              </Button>
            </form>

            {/* Smart Suggestion Card */}
            {showExperienceSuggestion && (
              <Card className="border-primary/20 bg-primary/5" data-testid="experience-suggestion-card">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      {detectedType === "experience" && <Sparkles className="w-5 h-5 text-primary" />}
                      {detectedType === "service" && <Users className="w-5 h-5 text-primary" />}
                      {detectedType === "membership" && <Ticket className="w-5 h-5 text-primary" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-sm mb-1">
                        {detectedType === "experience" && "This looks like an experience!"}
                        {detectedType === "service" && "This looks like a service!"}
                        {detectedType === "membership" && "This looks like a membership!"}
                      </h4>
                      <p className="text-sm text-muted-foreground mb-3">
                        {detectedType === "experience" && "Experiences like trips, concerts, or events work best as custom items."}
                        {detectedType === "service" && "Services like lessons, classes, or appointments work best as custom items."}
                        {detectedType === "membership" && "Memberships and subscriptions work best as custom items."}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button 
                          size="sm" 
                          onClick={handleSwitchToCustomItem}
                          data-testid="button-switch-to-custom"
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          Create Custom Item
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={handleDismissSuggestion}
                          data-testid="button-dismiss-suggestion"
                        >
                          {searchTerm ? "Not What I Meant" : "Search Anyway"}
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {searchResults && searchResults.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Found {searchResults.length} result{searchResults.length !== 1 ? "s" : ""}
                </p>
                <div className="grid grid-cols-1 gap-3 max-h-96 overflow-y-auto">
                  {searchResults.map((result: any, index: number) => (
                    <Card key={index} className="hover-elevate" data-testid={`search-result-${index}`}>
                      <CardContent className="p-4">
                        <div className="flex gap-4">
                          {result.thumbnail && (
                            <img
                              src={result.thumbnail}
                              alt={result.title}
                              className="w-20 h-20 object-cover rounded-md"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium line-clamp-2 mb-1">{result.title}</h4>
                            {result.snippet && (
                              <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                                {result.snippet}
                              </p>
                            )}
                            <div className="flex items-center gap-2 flex-wrap">
                              {result.extracted_price !== null && result.extracted_price !== undefined && (
                                <Badge variant="secondary">
                                  ${result.extracted_price.toFixed(2)}
                                </Badge>
                              )}
                              {result.source && (
                                <span className="text-xs text-muted-foreground">
                                  {result.source}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col gap-2">
                            <Button
                              size="sm"
                              onClick={() => addFromSearchMutation.mutate({ product: result })}
                              disabled={addFromSearchMutation.isPending}
                              data-testid={`button-add-result-${index}`}
                            >
                              {addFromSearchMutation.isPending ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <>
                                  <Plus className="w-4 h-4 mr-1" />
                                  Add
                                </>
                              )}
                            </Button>
                            {result.link && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => window.open(result.link, "_blank")}
                                data-testid={`button-view-result-${index}`}
                              >
                                <ExternalLink className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {searchError && searchTerm && (
              <div className="text-center py-8" data-testid="search-error-state">
                <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-3">
                  <Search className="w-8 h-8 text-destructive" />
                </div>
                <p className="text-destructive font-medium mb-1">Search Error</p>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  {(searchError as Error).message}
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Try again or use the "Custom Item" tab
                </p>
              </div>
            )}

            {!searchError && searchTerm && searchResults && searchResults.length === 0 && (
              <div className="text-center py-8 text-muted-foreground" data-testid="search-empty-state">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                  <Search className="w-8 h-8 text-muted-foreground" />
                </div>
                <p className="font-medium mb-1">No Results Found</p>
                <p className="text-sm">Try the "Custom Item" tab to add manually</p>
              </div>
            )}

            {!searchTerm && !searchError && (
              <div className="text-center py-8 text-muted-foreground" data-testid="search-initial-state">
                <Search className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Paste a product URL or search for anything</p>
              </div>
            )}
          </TabsContent>

          {/* Camera Tab */}
          <TabsContent value="camera" className="space-y-4 mt-4">
            <CameraCapture 
              onImageCaptured={handleImageSearch} 
              isProcessing={isSearchingByImage}
            />

            {/* Loading indicator */}
            {isSearchingByImage && (
              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="p-6 text-center">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-primary" />
                  <p className="text-sm font-medium">Searching for products...</p>
                  <p className="text-xs text-muted-foreground mt-1">This may take a few seconds</p>
                </CardContent>
              </Card>
            )}

            {/* Error message */}
            {!isSearchingByImage && imageSearchError && (
              <Card className="border-destructive/20 bg-destructive/5">
                <CardContent className="p-6 text-center">
                  <p className="text-sm font-medium text-destructive mb-1">Search Failed</p>
                  <p className="text-xs text-muted-foreground">{imageSearchError}</p>
                </CardContent>
              </Card>
            )}

            {/* No results message */}
            {!isSearchingByImage && !imageSearchError && imageSearchResults !== null && imageSearchResults.length === 0 && (
              <Card className="border-muted">
                <CardContent className="p-6 text-center">
                  <p className="text-sm text-muted-foreground">
                    No products found. Try taking a clearer photo or use the Search tab instead.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Image search results */}
            {!isSearchingByImage && imageSearchResults && imageSearchResults.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Found {imageSearchResults.length} result{imageSearchResults.length !== 1 ? "s" : ""}
                </p>
                <div className="grid grid-cols-1 gap-3 max-h-96 overflow-y-auto">
                  {imageSearchResults.map((result: any, index: number) => (
                    <Card key={index} className="hover-elevate" data-testid={`camera-result-${index}`}>
                      <CardContent className="p-4">
                        <div className="flex gap-4">
                          {result.thumbnail && (
                            <img
                              src={result.thumbnail}
                              alt={result.title}
                              className="w-20 h-20 object-cover rounded-md"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium line-clamp-2 mb-1">{result.title}</h4>
                            {result.snippet && (
                              <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                                {result.snippet}
                              </p>
                            )}
                            <div className="flex items-center gap-2 flex-wrap">
                              {result.extracted_price !== null && result.extracted_price !== undefined && (
                                <Badge variant="secondary">
                                  ${result.extracted_price.toFixed(2)}
                                </Badge>
                              )}
                              {result.source && (
                                <span className="text-xs text-muted-foreground">
                                  {result.source}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col gap-2">
                            <Button
                              size="sm"
                              onClick={() => addFromSearchMutation.mutate({ product: result })}
                              disabled={addFromSearchMutation.isPending}
                              data-testid={`button-add-camera-result-${index}`}
                            >
                              {addFromSearchMutation.isPending ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <>
                                  <Plus className="w-4 h-4 mr-1" />
                                  Add
                                </>
                              )}
                            </Button>
                            {result.link && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => window.open(result.link, "_blank")}
                                data-testid={`button-view-camera-result-${index}`}
                              >
                                <ExternalLink className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          {/* Custom Item Tab */}
          <TabsContent value="custom" className="mt-4">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmitCustom)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="itemType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Item Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-item-type">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="product" data-testid="option-product">
                            <div className="flex items-center gap-2">
                              <Gift className="w-4 h-4" />
                              Product
                            </div>
                          </SelectItem>
                          <SelectItem value="experience" data-testid="option-experience">
                            <div className="flex items-center gap-2">
                              <Sparkles className="w-4 h-4" />
                              Experience
                            </div>
                          </SelectItem>
                          <SelectItem value="service" data-testid="option-service">
                            <div className="flex items-center gap-2">
                              <Users className="w-4 h-4" />
                              Service
                            </div>
                          </SelectItem>
                          <SelectItem value="membership" data-testid="option-membership">
                            <div className="flex items-center gap-2">
                              <Ticket className="w-4 h-4" />
                              Membership
                            </div>
                          </SelectItem>
                          <SelectItem value="other" data-testid="option-other">
                            <div className="flex items-center gap-2">
                              <Plus className="w-4 h-4" />
                              Other
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., Trip to the Zoo, Music Lessons, Wireless Headphones"
                          {...field}
                          data-testid="input-item-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Tell your group more about this..."
                          className="resize-none h-24"
                          {...field}
                          data-testid="input-item-description"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Price</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="29.99"
                            {...field}
                            data-testid="input-item-price"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="quantity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Quantity</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="1"
                            {...field}
                            data-testid="input-item-quantity"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>URL (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          type="url"
                          placeholder="https://example.com/product"
                          {...field}
                          data-testid="input-item-url"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Priority</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-priority">
                            <SelectValue placeholder="Select priority" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="high" data-testid="option-high">Must-Have</SelectItem>
                          <SelectItem value="medium" data-testid="option-medium">Would Love</SelectItem>
                          <SelectItem value="low" data-testid="option-low">Just a Thought</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-2">
                  <Label>Image (Optional)</Label>
                  <div className="flex items-center gap-4">
                    <ObjectUploader
                      maxNumberOfFiles={1}
                      maxFileSize={10485760}
                      onGetUploadParameters={handleGetUploadParameters}
                      onComplete={handleUploadComplete}
                      buttonVariant="outline"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Upload Image
                    </ObjectUploader>
                    {uploadedImageUrl && (
                      <span className="text-sm text-muted-foreground">Image uploaded</span>
                    )}
                  </div>
                  {uploadedImageUrl && (
                    <div className="relative w-32 h-32 border rounded-md overflow-hidden">
                      <img
                        src={uploadedImageUrl}
                        alt="Uploaded preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleClose}
                    disabled={addCustomItemMutation.isPending}
                    data-testid="button-cancel"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={addCustomItemMutation.isPending}
                    data-testid="button-add-custom"
                    className="flex-1"
                  >
                    {addCustomItemMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      <>
                        {getItemTypeIcon(form.watch("itemType") || "product")}
                        <span className="ml-2">Add to Wishlist</span>
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </TabsContent>
        </Tabs>
        </DialogContent>
      </Dialog>

      {/* Duplicate item warning dialog */}
      <AlertDialog open={showDuplicateDialog} onOpenChange={setShowDuplicateDialog}>
        <AlertDialogContent data-testid="alert-duplicate-item">
          <AlertDialogHeader>
            <AlertDialogTitle>Item Already on Your Wishlist</AlertDialogTitle>
            <AlertDialogDescription>
              You already have "{duplicateItem?.name}" on your wishlist. 
              {duplicateItem?.url && (
                <span className="block mt-2 text-xs text-muted-foreground truncate">
                  {duplicateItem.url}
                </span>
              )}
              <span className="block mt-3">
                Do you want to add it again anyway?
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              onClick={handleCancelDuplicate}
              data-testid="button-cancel-duplicate"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDuplicate}
              data-testid="button-confirm-duplicate"
            >
              Add Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
