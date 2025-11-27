import { useEffect, useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useFamily } from "@/contexts/FamilyContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ProductDetailsDialog } from "@/components/product-details-dialog";
import { AddItemListPicker } from "@/components/add-item-list-picker";
import { Search as SearchIcon, Plus, ExternalLink, Gift } from "lucide-react";

export default function Search() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { selectedFamilyId } = useFamily();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [listPickerOpen, setListPickerOpen] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Use a ref to always get the current selectedFamilyId (prevents stale closure bugs)
  const selectedFamilyIdRef = useRef(selectedFamilyId);
  useEffect(() => {
    selectedFamilyIdRef.current = selectedFamilyId;
  }, [selectedFamilyId]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, authLoading, toast]);

  const { data: results, isLoading, isFetching } = useQuery({
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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      setSearchTerm(searchQuery.trim());
    }
  };

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const addToWishlistMutation = useMutation({
    mutationFn: async (details: any) => {
      if (!selectedProduct) {
        throw new Error("No product selected");
      }
      
      // Prepare payload with proper validation
      const payload: any = {
        name: details.name,
        price: typeof details.price === 'number' && !isNaN(details.price) ? details.price : null,
        url: details.url || selectedProduct.link || "",
        imageUrl: details.imageUrl || selectedProduct.thumbnail || "",
        productId: selectedProduct.product_id,
        source: "google_shopping",
        description: details.description || "",
        priority: details.priority,
        quantity: details.quantity,
        familyId: selectedFamilyIdRef.current,
      };
      
      // Only include category if it has a value
      if (details.category) {
        payload.category = details.category;
      }
      
      return await apiRequest("POST", "/api/wishlist/from-search", payload);
    },
    onSuccess: () => {
      const currentFamilyId = selectedFamilyIdRef.current;
      queryClient.invalidateQueries({ queryKey: ["/api/wishlist", currentFamilyId] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats", currentFamilyId] });
      setDetailsDialogOpen(false);
      setSelectedProduct(null);
      toast({
        title: "Success",
        description: "Item added to your wishlist!",
      });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: error.message || "Failed to add item to wishlist",
        variant: "destructive",
      });
    },
  });

  const handleAddToWishlist = (product: any) => {
    console.log('[Search] Adding product to wishlist:', {
      title: product.title,
      link: product.link,
      snippet: product.snippet,
      price: product.extracted_price,
      thumbnail: product.thumbnail,
    });
    setSelectedProduct(product);
    setDetailsDialogOpen(true);
  };

  const handleConfirmAdd = (details: any) => {
    addToWishlistMutation.mutate(details);
  };

  return (
    <div className="p-4 md:p-8 lg:p-12 space-y-6">
      <div>
        <h1 className="font-serif text-2xl md:text-4xl font-semibold text-foreground">
          Search Products
        </h1>
        <p className="text-sm md:text-base text-muted-foreground mt-1">
          Search for products and add them to your wishlist with one click
        </p>
      </div>

      {/* Search Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <form onSubmit={handleSearch} className="flex-1 max-w-3xl w-full">
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search for products... (e.g., wireless headphones, coffee maker)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-12"
                data-testid="input-search"
              />
            </div>
            <Button type="submit" size="lg" disabled={!searchQuery.trim()} data-testid="button-search">
              Search
            </Button>
          </div>
        </form>
        <Button 
          variant="outline" 
          size="lg" 
          onClick={() => setListPickerOpen(true)}
          data-testid="button-add-manually"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Manually
        </Button>
      </div>

      {/* Results */}
      {(isLoading || isFetching) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-96" />
          ))}
        </div>
      )}

      {!isLoading && !isFetching && searchTerm && results && (
        <div>
          <p className="text-sm text-muted-foreground mb-4">
            Found {results.length} results for "{searchTerm}"
          </p>
          {results.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
                  <SearchIcon className="w-10 h-10 text-muted-foreground" />
                </div>
                <h3 className="font-semibold text-xl mb-2 text-foreground">No Results Found</h3>
                <p className="text-muted-foreground max-w-md">
                  Try searching with different keywords or check your spelling.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
              {results.map((product: any, index: number) => (
                <Card key={`${product.product_id}-${index}`} className="overflow-hidden hover-elevate" data-testid={`search-result-${index}`}>
                  <div className="aspect-square bg-muted relative overflow-hidden">
                    {product.thumbnail ? (
                      <img
                        src={product.thumbnail}
                        alt={product.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Gift className="w-16 h-16 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <CardContent className="p-4 space-y-3">
                    <div>
                      <h3 className="font-semibold text-foreground line-clamp-2 mb-1" data-testid={`product-title-${index}`}>
                        {product.title}
                      </h3>
                      <p className="text-lg font-bold text-primary" data-testid={`product-price-${index}`}>
                        {product.price || `$${product.extracted_price?.toFixed(2) || 'N/A'}`}
                      </p>
                      {product.source && (
                        <p className="text-xs text-muted-foreground mt-1">from {product.source}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="default"
                        size="sm"
                        className="flex-1"
                        onClick={() => handleAddToWishlist(product)}
                        data-testid={`button-add-to-wishlist-${index}`}
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Add to List
                      </Button>
                      {/* Only show external link if it's a direct retailer URL, not a Google Shopping page */}
                      {product.link && !product.link.includes('google.com/shopping') && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(product.link, '_blank')}
                          data-testid={`button-view-product-${index}`}
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {!searchTerm && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <SearchIcon className="w-10 h-10 text-primary" />
            </div>
            <h3 className="font-semibold text-xl mb-2 text-foreground">Search for Products</h3>
            <p className="text-muted-foreground max-w-md">
              Use the search bar above to find products from Google Shopping and add them to your wishlist instantly.
            </p>
          </CardContent>
        </Card>
      )}

      <ProductDetailsDialog
        open={detailsDialogOpen}
        onOpenChange={setDetailsDialogOpen}
        product={selectedProduct}
        onConfirm={handleConfirmAdd}
        isPending={addToWishlistMutation.isPending}
      />

      <AddItemListPicker
        open={listPickerOpen}
        onOpenChange={setListPickerOpen}
        defaultTab="custom"
      />
    </div>
  );
}
