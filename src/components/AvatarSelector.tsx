import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Upload, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

// Preset avatar options
const PRESET_AVATARS = [
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Luna",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Alex",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Max",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Sara",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=John",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Emma",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Oliver",
  "https://api.dicebear.com/7.x/bottts/svg?seed=Robot1",
  "https://api.dicebear.com/7.x/bottts/svg?seed=Robot2",
  "https://api.dicebear.com/7.x/bottts/svg?seed=Robot3",
  "https://api.dicebear.com/7.x/bottts/svg?seed=Robot4",
  "https://api.dicebear.com/7.x/identicon/svg?seed=User1",
  "https://api.dicebear.com/7.x/identicon/svg?seed=User2",
  "https://api.dicebear.com/7.x/identicon/svg?seed=User3",
  "https://api.dicebear.com/7.x/identicon/svg?seed=User4",
];

interface AvatarSelectorProps {
  currentAvatar: string | null;
  onAvatarChange: (avatarUrl: string | null) => void;
  userName: string;
  language?: string;
}

const AvatarSelector = ({ currentAvatar, onAvatarChange, userName, language = 'en' }: AvatarSelectorProps) => {
  const [uploading, setUploading] = useState(false);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: language === 'ar' ? 'يرجى اختيار صورة' : 'Please select an image file',
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: language === 'ar' ? 'حجم الصورة كبير جداً (الحد الأقصى 2 ميغابايت)' : 'Image is too large (max 2MB)',
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      // Convert to base64
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        
        // Upload to Cloudinary
        const { data, error } = await supabase.functions.invoke('upload-to-cloudinary', {
          body: {
            imageBase64: base64,
            folder: 'Edara_Avatars',
          },
        });

        if (error) throw error;
        
        onAvatarChange(data.url);
        toast({
          title: language === 'ar' ? 'تم' : 'Success',
          description: language === 'ar' ? 'تم رفع الصورة بنجاح' : 'Image uploaded successfully',
        });
      };
      reader.readAsDataURL(file);
    } catch (error: any) {
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: error.message,
        variant: "destructive",
      });
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
    <div className="space-y-4">
      <Label>{language === 'ar' ? 'صورة الملف الشخصي' : 'Profile Picture'}</Label>
      
      <div className="flex items-center gap-4">
        <Avatar className="h-20 w-20 border-2 border-border">
          <AvatarImage src={currentAvatar || undefined} alt={userName} />
          <AvatarFallback className="text-lg bg-primary text-primary-foreground">
            {getInitials(userName) || <User className="h-8 w-8" />}
          </AvatarFallback>
        </Avatar>
        
        {currentAvatar && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onAvatarChange(null)}
          >
            {language === 'ar' ? 'إزالة' : 'Remove'}
          </Button>
        )}
      </div>

      <Tabs defaultValue="presets" className="w-full">
        <TabsList className="w-full">
          <TabsTrigger value="presets" className="flex-1">
            {language === 'ar' ? 'صور جاهزة' : 'Preset Avatars'}
          </TabsTrigger>
          <TabsTrigger value="upload" className="flex-1">
            {language === 'ar' ? 'رفع صورة' : 'Upload'}
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="presets" className="mt-4">
          <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto p-1">
            {PRESET_AVATARS.map((avatar, index) => (
              <button
                key={index}
                type="button"
                onClick={() => onAvatarChange(avatar)}
                className={`rounded-full p-1 transition-all ${
                  currentAvatar === avatar 
                    ? 'ring-2 ring-primary ring-offset-2' 
                    : 'hover:ring-2 hover:ring-muted-foreground hover:ring-offset-1'
                }`}
              >
                <Avatar className="h-12 w-12">
                  <AvatarImage src={avatar} alt={`Avatar ${index + 1}`} />
                  <AvatarFallback><User className="h-4 w-4" /></AvatarFallback>
                </Avatar>
              </button>
            ))}
          </div>
        </TabsContent>
        
        <TabsContent value="upload" className="mt-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                disabled={uploading}
                className="cursor-pointer"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {language === 'ar' 
                ? 'الحد الأقصى: 2 ميغابايت، صيغ مدعومة: JPG، PNG، GIF' 
                : 'Max 2MB. Supported formats: JPG, PNG, GIF'}
            </p>
            {uploading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Upload className="h-4 w-4 animate-pulse" />
                {language === 'ar' ? 'جاري الرفع...' : 'Uploading...'}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AvatarSelector;
