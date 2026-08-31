import { useState } from "react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Camera, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AvatarUploadProps {
  userId: string;
  currentAvatarUrl?: string | null;
  userName: string;
  onUploadComplete?: (url: string) => void;
}

export const AvatarUpload = ({ userId, currentAvatarUrl, userName, onUploadComplete }: AvatarUploadProps) => {
  const [uploading, setUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(currentAvatarUrl);

  const uploadAvatar = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);

      if (!event.target.files || event.target.files.length === 0) {
        throw new Error('You must select an image to upload.');
      }

      const file = event.target.files[0];

      const allowedTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/avif'];
      if (!allowedTypes.includes(file.type)) {
        throw new Error('Please upload a PNG, JPEG, GIF, WebP or AVIF image.');
      }

      const fileExt = (file.name.split('.').pop() || '').toLowerCase();
      const allowedExts = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif'];
      if (!allowedExts.includes(fileExt)) {
        throw new Error('Unsupported image file type.');
      }

      const filePath = `${userId}/avatar.${fileExt}`;

      // Delete old avatar if exists
      if (avatarUrl) {
        const oldPath = avatarUrl.split('/').slice(-2).join('/');
        await supabase.storage.from('avatars').remove([oldPath]);
      }

      // Upload new avatar
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const newUrl = data.publicUrl;
      setAvatarUrl(newUrl);

      // Update profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: newUrl })
        .eq('id', userId);

      if (updateError) throw updateError;

      toast.success('Profile picture updated!');
      onUploadComplete?.(newUrl);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setUploading(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="relative inline-block">
      <Avatar className="h-24 w-24">
        <AvatarImage src={avatarUrl || undefined} alt={userName} />
        <AvatarFallback className="text-2xl">{getInitials(userName)}</AvatarFallback>
      </Avatar>
      
      <label htmlFor="avatar-upload" className="absolute bottom-0 right-0">
        <Button
          size="icon"
          variant="secondary"
          className="h-8 w-8 rounded-full shadow-lg"
          disabled={uploading}
          asChild
        >
          <div>
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Camera className="h-4 w-4" />
            )}
          </div>
        </Button>
      </label>
      
      <input
        id="avatar-upload"
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp,image/avif"
        onChange={uploadAvatar}
        disabled={uploading}
        className="hidden"
      />
    </div>
  );
};
