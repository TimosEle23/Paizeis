import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Loader2, Image as ImageIcon, X } from "lucide-react";

interface VenueImageUploadProps {
  currentImageUrl: string;
  onUploadComplete: (url: string) => void;
  label?: string;
}

const VenueImageUpload = ({ currentImageUrl, onUploadComplete, label = "Venue Image" }: VenueImageUploadProps) => {
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const uploadImage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);

      if (!event.target.files || event.target.files.length === 0) {
        return;
      }

      const file = event.target.files[0];
      
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
      if (!allowedTypes.includes(file.type)) {
        toast.error("Invalid file type", { description: "Please upload a JPEG, PNG, WebP, or GIF image." });
        return;
      }

      // Validate file size (max 5MB)
      const maxSize = 5 * 1024 * 1024;
      if (file.size > maxSize) {
        toast.error("File too large", { description: "Please upload an image smaller than 5MB." });
        return;
      }

      // Create a unique file path scoped to the uploading admin
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Not signed in", { description: "Please sign in again to upload images." });
        return;
      }
      const fileExt = file.name.split('.').pop();
      const fileName = `venue-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      // Upload to the dedicated venue images bucket
      const { error: uploadError } = await supabase.storage
        .from('venue-images')
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        throw uploadError;
      }

      // Signed URL (10 years) so the image can be rendered publicly on venue cards
      const { data: signed, error: signedError } = await supabase.storage
        .from('venue-images')
        .createSignedUrl(filePath, 60 * 60 * 24 * 365 * 10);

      if (signedError || !signed?.signedUrl) {
        throw signedError ?? new Error("Could not generate image URL");
      }

      setPreviewUrl(signed.signedUrl);
      onUploadComplete(signed.signedUrl);
      toast.success("Image uploaded successfully");

    } catch (error: any) {
      toast.error("Upload failed", { description: error.message });
    } finally {
      setUploading(false);
    }
  };

  const clearImage = () => {
    setPreviewUrl(null);
    onUploadComplete("");
  };

  const displayUrl = previewUrl || currentImageUrl;

  return (
    <div className="space-y-3">
      <Label>{label}</Label>
      
      {displayUrl && (
        <div className="relative rounded-lg overflow-hidden border border-border bg-muted">
          <img 
            src={displayUrl} 
            alt="Venue preview" 
            className="w-full h-32 object-cover"
          />
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute top-2 right-2 h-6 w-6"
            onClick={clearImage}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={uploadImage}
            disabled={uploading}
            className="cursor-pointer"
            id={`image-upload-${label.replace(/\s/g, '-')}`}
          />
        </div>
        
        {uploading && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Uploading...</span>
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Supported formats: JPEG, PNG, WebP, GIF. Max size: 5MB
      </p>
    </div>
  );
};

export default VenueImageUpload;
