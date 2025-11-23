import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Camera, SwitchCamera, Loader2, AlertCircle, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CameraCaptureProps {
  onImageCaptured: (base64Image: string) => void;
  isProcessing?: boolean;
}

export function CameraCapture({ onImageCaptured, isProcessing = false }: CameraCaptureProps) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();

  // Check for multiple cameras
  useEffect(() => {
    const checkCameras = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        setHasMultipleCameras(videoDevices.length > 1);
      } catch (err) {
        console.error("Error checking cameras:", err);
      }
    };
    checkCameras();
  }, []);

  // Start camera
  useEffect(() => {
    const startCamera = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Stop any existing stream
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }

        // Request camera access
        const constraints: MediaStreamConstraints = {
          video: {
            facingMode: facingMode,
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        };

        const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
        setStream(mediaStream);

        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (err: any) {
        console.error("Camera error:", err);
        
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setError("Camera permission denied. Please allow camera access in your browser settings.");
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          setError("No camera found on this device.");
        } else if (err.name === 'NotReadableError') {
          setError("Camera is already in use by another application.");
        } else {
          setError("Failed to access camera. Please try again.");
        }

        toast({
          title: "Camera Error",
          description: err.message || "Failed to access camera",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    startCamera();

    // Cleanup on unmount
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [facingMode]);

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) {
      toast({
        title: "Error",
        description: "Failed to capture photo",
        variant: "destructive",
      });
      return;
    }

    // Set canvas size to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert to base64
    const base64Image = canvas.toDataURL('image/jpeg', 0.85);
    
    // Validate size (max 10MB as mentioned in replit.md for image uploads)
    const sizeInBytes = Math.ceil((base64Image.length * 3) / 4);
    const sizeInMB = sizeInBytes / (1024 * 1024);
    
    if (sizeInMB > 10) {
      toast({
        title: "Image Too Large",
        description: "Photo is too large. Please try again with better lighting.",
        variant: "destructive",
      });
      return;
    }

    onImageCaptured(base64Image);
  };

  const toggleCamera = () => {
    setFacingMode(prev => prev === "user" ? "environment" : "user");
  };

  const retryCamera = () => {
    setError(null);
    setFacingMode("environment"); // Reset to back camera
  };

  if (error) {
    return (
      <Card className="border-destructive/20 bg-destructive/5" data-testid="camera-error">
        <CardContent className="p-6">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-destructive" />
            </div>
            <div>
              <h3 className="font-semibold mb-2">Camera Access Required</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                {error}
              </p>
            </div>
            <Button onClick={retryCamera} data-testid="button-retry-camera">
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-0 relative">
          {isLoading && (
            <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-10 rounded-lg">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          )}
          
          <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
              data-testid="camera-preview"
            />
            
            {/* Camera controls overlay */}
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/60 to-transparent">
              <div className="flex items-center justify-center gap-4">
                {hasMultipleCameras && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={toggleCamera}
                    disabled={isProcessing || isLoading}
                    className="bg-black/40 hover:bg-black/60 text-white border-white/20"
                    data-testid="button-switch-camera"
                  >
                    <SwitchCamera className="w-5 h-5" />
                  </Button>
                )}
                
                <Button
                  size="lg"
                  onClick={capturePhoto}
                  disabled={isProcessing || isLoading || !stream}
                  className="rounded-full w-16 h-16 bg-white hover:bg-white/90 text-black shadow-lg"
                  data-testid="button-capture-photo"
                >
                  {isProcessing ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    <Camera className="w-6 h-6" />
                  )}
                </Button>
                
                <div className="w-10" /> {/* Spacer for symmetry */}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Hidden canvas for capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Instructions */}
      <div className="text-center text-sm text-muted-foreground space-y-1">
        <p>Position the product in the frame</p>
        <p className="text-xs">Take a clear photo for best results</p>
      </div>
    </div>
  );
}
