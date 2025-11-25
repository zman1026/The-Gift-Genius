import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Gift, 
  Users, 
  ShoppingBag, 
  Eye, 
  EyeOff, 
  Search, 
  Check, 
  ArrowRight,
  Star,
  Sparkles,
  Lock,
  Share2,
  Calendar,
  TreePine
} from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex flex-wrap min-h-14 py-2 items-center justify-between gap-2 px-4 md:px-8">
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Gift className="w-5 h-5 text-primary" />
            </div>
            <span className="font-serif text-lg font-semibold text-foreground">
              The Gift Genius
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <Button
              variant="ghost"
              className="hidden md:inline-flex"
              onClick={() => {
                document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
              }}
              data-testid="button-nav-features"
            >
              Features
            </Button>
            <Button
              variant="ghost"
              className="hidden md:inline-flex"
              onClick={() => {
                document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' });
              }}
              data-testid="button-nav-how-it-works"
            >
              How It Works
            </Button>
            <Button
              variant="outline"
              onClick={() => window.location.href = '/api/login'}
              data-testid="button-nav-login"
            >
              Login
            </Button>
            <Button
              onClick={() => window.location.href = '/api/login'}
              data-testid="button-nav-get-started"
            >
              Get Started
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/5" />
        
        {/* Decorative elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-primary/5 blur-3xl" />
          <div className="absolute -bottom-40 -left-20 w-96 h-96 rounded-full bg-accent/5 blur-3xl" />
        </div>

        {/* Hero content */}
        <div className="relative z-10 container px-4 md:px-8 py-16 md:py-24 lg:py-32">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            {/* Badge */}
            <div className="flex justify-center">
              <Badge variant="secondary" className="px-4 py-1.5 text-sm">
                <TreePine className="w-3.5 h-3.5 mr-1.5 text-accent" />
                Perfect for Christmas Gift Exchanges
              </Badge>
            </div>
            
            {/* Heading */}
            <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl font-bold text-foreground tracking-tight leading-tight">
              Make Gift Giving{" "}
              <span className="text-primary">Magical</span>
              <br className="hidden sm:block" />
              {" "}for Your Whole Group
            </h1>
            
            {/* Subheading */}
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Create wishlists, coordinate gifts secretly, and make every celebration special. 
              No more duplicate gifts or ruined surprises.
            </p>
            
            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row flex-wrap gap-4 justify-center pt-4">
              <Button
                size="lg"
                className="h-12 px-8 text-base"
                onClick={() => window.location.href = '/api/login'}
                data-testid="button-hero-get-started"
              >
                Start Your Wishlist
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-12 px-8 text-base"
                onClick={() => {
                  document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' });
                }}
                data-testid="button-hero-learn-more"
              >
                See How It Works
              </Button>
            </div>
            
            {/* Social proof */}
            <div className="flex flex-wrap items-center justify-center gap-6 pt-8 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-accent" />
                <span>Free to use</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-accent" />
                <span>No credit card needed</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-accent" />
                <span>Works year-round</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-16 md:py-24 px-4 bg-card/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center space-y-4 mb-12">
            <Badge variant="secondary" className="px-3 py-1">
              <Sparkles className="w-3.5 h-3.5 mr-1.5 text-primary" />
              Features
            </Badge>
            <h2 className="font-serif text-3xl md:text-4xl font-semibold text-foreground">
              Everything You Need for Joyful Gifting
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              From creating wishlists to coordinating purchases, we have got you covered.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Feature 1 */}
            <Card className="hover-elevate border-border/50">
              <CardContent className="p-6 space-y-4">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Users className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold text-lg text-foreground">Gift Groups</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Create groups for family, friends, or coworkers. Invite members with a simple code and keep everyone organized.
                </p>
              </CardContent>
            </Card>

            {/* Feature 2 */}
            <Card className="hover-elevate border-border/50">
              <CardContent className="p-6 space-y-4">
                <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center">
                  <Search className="w-6 h-6 text-accent" />
                </div>
                <h3 className="font-semibold text-lg text-foreground">Smart Product Search</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Search millions of products from top retailers or add items manually. Even snap a photo and find products instantly.
                </p>
              </CardContent>
            </Card>

            {/* Feature 3 */}
            <Card className="hover-elevate border-border/50">
              <CardContent className="p-6 space-y-4">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <EyeOff className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold text-lg text-foreground">Secret Purchases</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Mark gifts as purchased without the wishlist owner knowing. Add private notes for coordination with other buyers.
                </p>
              </CardContent>
            </Card>

            {/* Feature 4 */}
            <Card className="hover-elevate border-border/50">
              <CardContent className="p-6 space-y-4">
                <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center">
                  <Lock className="w-6 h-6 text-accent" />
                </div>
                <h3 className="font-semibold text-lg text-foreground">Surprise Protection</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Wishlist owners never see purchase status or who bought what. The magic of gifting stays intact.
                </p>
              </CardContent>
            </Card>

            {/* Feature 5 */}
            <Card className="hover-elevate border-border/50">
              <CardContent className="p-6 space-y-4">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <ShoppingBag className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold text-lg text-foreground">Budget Tracking</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Set spending limits per person and track overall gift budgets. Keep your holiday spending on target.
                </p>
              </CardContent>
            </Card>

            {/* Feature 6 */}
            <Card className="hover-elevate border-border/50">
              <CardContent className="p-6 space-y-4">
                <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center">
                  <Share2 className="w-6 h-6 text-accent" />
                </div>
                <h3 className="font-semibold text-lg text-foreground">Personal Lists</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Create shareable wishlists for birthdays, weddings, or any occasion. Share a simple link with anyone.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-16 md:py-24 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center space-y-4 mb-16">
            <Badge variant="secondary" className="px-3 py-1">
              <Calendar className="w-3.5 h-3.5 mr-1.5 text-accent" />
              How It Works
            </Badge>
            <h2 className="font-serif text-3xl md:text-4xl font-semibold text-foreground">
              Get Started in Minutes
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Simple steps to organized, stress-free gift giving
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
            {/* Step 1 */}
            <div className="relative text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-6">
                <span className="text-2xl font-bold text-primary">1</span>
              </div>
              <h3 className="font-semibold text-lg text-foreground">Create Your Group</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Set up a gift exchange group and invite your family, friends, or coworkers with a simple invite code.
              </p>
              {/* Connector line (hidden on mobile) */}
              <div className="hidden md:block absolute top-8 left-[60%] w-[80%] h-0.5 bg-border" />
            </div>

            {/* Step 2 */}
            <div className="relative text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-accent/10 flex items-center justify-center mb-6">
                <span className="text-2xl font-bold text-accent">2</span>
              </div>
              <h3 className="font-semibold text-lg text-foreground">Build Your Wishlist</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Add items by searching products, snapping photos, or entering them manually. Set priorities and add notes.
              </p>
              {/* Connector line (hidden on mobile) */}
              <div className="hidden md:block absolute top-8 left-[60%] w-[80%] h-0.5 bg-border" />
            </div>

            {/* Step 3 */}
            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-6">
                <span className="text-2xl font-bold text-primary">3</span>
              </div>
              <h3 className="font-semibold text-lg text-foreground">Coordinate Secretly</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Browse others' lists, mark purchases privately, and track spending. No more duplicate gifts or spoiled surprises.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonial/Quote Section */}
      <section className="py-16 md:py-20 px-4 bg-gradient-to-br from-primary/5 via-background to-accent/5">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <div className="flex justify-center gap-1">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="w-5 h-5 fill-primary text-primary" />
            ))}
          </div>
          <blockquote className="font-serif text-2xl md:text-3xl text-foreground leading-relaxed">
            "Finally, a simple way to coordinate Christmas gifts with my family. No more awkward duplicate presents or ruined surprises!"
          </blockquote>
          <p className="text-muted-foreground">
            Join thousands of groups making gift-giving stress-free
          </p>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 md:py-24 px-4">
        <div className="max-w-3xl mx-auto">
          <Card className="overflow-hidden border-border/50">
            <CardContent className="p-8 md:p-12 text-center space-y-6">
              <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                <Gift className="w-8 h-8 text-primary" />
              </div>
              <h2 className="font-serif text-3xl md:text-4xl font-semibold text-foreground">
                Ready to Make Gifting Magical?
              </h2>
              <p className="text-lg text-muted-foreground max-w-xl mx-auto">
                Start your wishlist today and invite your group. It is completely free and takes less than a minute.
              </p>
              <div className="pt-4">
                <Button
                  size="lg"
                  className="h-12 px-8 text-base"
                  onClick={() => window.location.href = '/api/login'}
                  data-testid="button-cta-get-started"
                >
                  Get Started Free
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-border bg-card/30">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center">
                <Gift className="w-4 h-4 text-primary" />
              </div>
              <span className="font-serif text-sm font-semibold text-foreground">
                The Gift Genius
              </span>
            </div>
            <p className="text-muted-foreground text-sm">
              2025 The Gift Genius. Making gift giving magical.
            </p>
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <a href="mailto:hello@thegiftgeniusapp.com" className="hover:text-foreground transition-colors">
                Contact
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
