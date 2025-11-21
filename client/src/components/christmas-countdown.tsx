import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles } from "lucide-react";

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export function ChristmasCountdown() {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(calculateTimeLeft());

  function calculateTimeLeft(): TimeLeft {
    const now = new Date();
    const currentYear = now.getFullYear();
    let christmas = new Date(currentYear, 11, 25); // December 25th

    // If Christmas has passed this year, calculate for next year
    if (now > christmas) {
      christmas = new Date(currentYear + 1, 11, 25);
    }

    const difference = christmas.getTime() - now.getTime();

    return {
      days: Math.floor(difference / (1000 * 60 * 60 * 24)),
      hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((difference / 1000 / 60) % 60),
      seconds: Math.floor((difference / 1000) % 60),
    };
  }

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const TimeUnit = ({ value, label, testId }: { value: number; label: string; testId: string }) => (
    <div className="flex flex-col items-center min-w-[70px] md:min-w-[90px]">
      <div className="relative">
        <div className="w-16 h-16 md:w-20 md:h-20 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 border-2 border-primary/30 flex items-center justify-center backdrop-blur-sm">
          <span className="text-2xl md:text-3xl font-bold text-primary tabular-nums" data-testid={testId}>
            {value.toString().padStart(2, '0')}
          </span>
        </div>
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full animate-pulse" />
      </div>
      <span className="text-xs md:text-sm font-medium text-muted-foreground mt-2 uppercase tracking-wide">
        {label}
      </span>
    </div>
  );

  return (
    <Card className="relative overflow-hidden border-primary/20 bg-gradient-to-br from-background to-primary/5">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0iTTM2IDM0djItMnptMCAzMnYtMnoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-50" />
      
      <CardContent className="p-6 md:p-8 relative">
        <div className="flex flex-col items-center space-y-4 md:space-y-6">
          {/* Header */}
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 md:w-6 md:h-6 text-primary animate-pulse" />
            <h2 className="font-serif text-xl md:text-2xl font-semibold text-foreground text-center">
              Christmas Countdown
            </h2>
            <Sparkles className="w-5 h-5 md:w-6 md:h-6 text-primary animate-pulse" />
          </div>

          {/* Countdown Display */}
          <div className="flex items-center justify-center gap-3 md:gap-6 flex-wrap">
            <TimeUnit value={timeLeft.days} label="Days" testId="text-countdown-days" />
            <div className="text-2xl md:text-3xl font-bold text-primary/40 hidden sm:block">:</div>
            <TimeUnit value={timeLeft.hours} label="Hours" testId="text-countdown-hours" />
            <div className="text-2xl md:text-3xl font-bold text-primary/40 hidden sm:block">:</div>
            <TimeUnit value={timeLeft.minutes} label="Minutes" testId="text-countdown-minutes" />
            <div className="text-2xl md:text-3xl font-bold text-primary/40 hidden sm:block">:</div>
            <TimeUnit value={timeLeft.seconds} label="Seconds" testId="text-countdown-seconds" />
          </div>

          {/* Subtitle */}
          <p className="text-sm md:text-base text-muted-foreground text-center">
            {timeLeft.days === 0 ? "It's Christmas Day!" : "Until the most wonderful time of the year!"}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
