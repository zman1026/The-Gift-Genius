import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Gift, Users, ShoppingBag, Heart } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center justify-between px-4 md:px-8">
          <div className="flex items-center gap-2">
            <Gift className="w-6 h-6 text-primary" />
            <span className="font-serif text-lg font-semibold text-foreground">
              The Gift Genius
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Button
              className="hidden md:inline-flex"
              onClick={() => window.location.href = '/api/login'}
              data-testid="button-nav-get-started"
            >
              Get Started
            </Button>
            <Button
              variant="outline"
              onClick={() => window.location.href = '/api/login'}
              data-testid="button-nav-login"
            >
              Login
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <div className="relative h-[500px] md:h-[600px] overflow-hidden">
        {/* Gradient overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-background z-10" />
        
        {/* Hero background with festive colors */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-accent/10 to-background" />
        
        {/* Decorative elements */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 w-32 h-32 rounded-full bg-primary blur-3xl" />
          <div className="absolute bottom-20 right-10 w-40 h-40 rounded-full bg-accent blur-3xl" />
        </div>

        {/* Hero content */}
        <div className="relative z-20 h-full flex flex-col items-center justify-center px-4 text-center">
          <div className="space-y-6 max-w-4xl">
            <div className="flex justify-center mb-4">
              <Gift className="w-16 h-16 md:w-20 md:h-20 text-primary" />
            </div>
            <h1 className="font-serif text-4xl md:text-6xl lg:text-7xl font-bold text-white tracking-tight">
              The Gift Genius
            </h1>
            <p className="text-xl md:text-2xl text-white/90 max-w-2xl mx-auto">
              Share the joy of giving with your loved ones. Create wishlists for any occasion, coordinate gifts, and make celebrations delightful all year round.
            </p>
            <div className="pt-4">
              <Button
                size="lg"
                className="h-12 px-8 text-lg"
                onClick={() => window.location.href = '/api/login'}
                data-testid="button-login"
              >
                Get Started
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-16 md:py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="font-serif text-3xl md:text-4xl font-semibold text-center mb-12 text-foreground">
            Everything You Need for Joyful Gift Giving
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="hover-elevate">
              <CardContent className="p-6 space-y-4">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Users className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold text-lg text-foreground">Gift Groups</h3>
                <p className="text-muted-foreground text-sm">
                  Create groups and invite members with a simple code. Everyone stays organized together.
                </p>
              </CardContent>
            </Card>

            <Card className="hover-elevate">
              <CardContent className="p-6 space-y-4">
                <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center">
                  <Gift className="w-6 h-6 text-accent" />
                </div>
                <h3 className="font-semibold text-lg text-foreground">Easy Wishlists</h3>
                <p className="text-muted-foreground text-sm">
                  Add items manually or search products directly from Google Shopping with one click.
                </p>
              </CardContent>
            </Card>

            <Card className="hover-elevate">
              <CardContent className="p-6 space-y-4">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <ShoppingBag className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold text-lg text-foreground">Secret Coordination</h3>
                <p className="text-muted-foreground text-sm">
                  Mark gifts as purchased with private notes. List owners never see who bought what.
                </p>
              </CardContent>
            </Card>

            <Card className="hover-elevate">
              <CardContent className="p-6 space-y-4">
                <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center">
                  <Heart className="w-6 h-6 text-accent" />
                </div>
                <h3 className="font-semibold text-lg text-foreground">No Surprises Ruined</h3>
                <p className="text-muted-foreground text-sm">
                  Purchase tracking is hidden from wishlist owners, keeping the magic of Christmas alive.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="py-16 md:py-20 px-4 bg-gradient-to-br from-primary/5 via-accent/5 to-transparent">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <h2 className="font-serif text-3xl md:text-4xl font-semibold text-foreground">
            Ready to Make This Christmas Special?
          </h2>
          <p className="text-lg text-muted-foreground">
            Join groups who are already using our platform to coordinate the perfect gifts.
          </p>
          <Button
            size="lg"
            className="h-12 px-8 text-lg"
            onClick={() => window.location.href = '/api/login'}
            data-testid="button-login-cta"
          >
            Start Your Wishlist
          </Button>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-border">
        <div className="max-w-6xl mx-auto text-center text-muted-foreground text-sm">
          <p>© 2025 The Gift Genius. Making gift giving magical.</p>
        </div>
      </footer>
    </div>
  );
}
