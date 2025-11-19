import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Search as SearchIcon, Plus, ExternalLink, Gift } from "lucide-react";

export default function Search() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

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

  const { data: results, isLoading, refetch } = useQuery({
    queryKey: ["/api/search", searchTerm],
    enabled: searchTerm.length > 0,
    retry: false,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setSearchTerm(searchQuery.trim());
    }
  };

  const addToWishlistMutation = useMutation({
    mutationFn: async (product: any) => {
      return await apiRequest("POST", "/api/wishlist/from-search", {
        name: product.title,
        price: product.extracted_price || product.price,
        url: product.link,
        imageUrl: product.thumbnail,
        productId: product.product_id,
        source: "google_shopping",
        description: product.snippet || "",
        priority: "medium",
        quantity: 1,
        category: null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/wishlist"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
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

  return (
    <div className="p-6 md:p-8 lg:p-12 space-y-6">
      <div>
        <h1 className="font-serif text-3xl md:text-4xl font-semibold text-foreground">
          Search Products
        </h1>
        <p className="text-muted-foreground mt-1">
          Search for products and add them to your wishlist with one click
        </p>
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSearch} className="max-w-3xl">
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

      {/* Results */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-96" />
          ))}
        </div>
      )}

      {!isLoading && searchTerm && results && (
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
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
                        onClick={() => addToWishlistMutation.mutate(product)}
                        disabled={addToWishlistMutation.isPending}
                        data-testid={`button-add-to-wishlist-${index}`}
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Add to List
                      </Button>
                      {product.link && (
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
    </div>
  );
}
