import { useState, useEffect } from "react";
import { Bell, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";

type User = {
  user_id: string;
  user_name: string;
  email: string;
};

export const SendNotificationDialog = () => {
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [userPickerOpen, setUserPickerOpen] = useState(false);
  const { language } = useLanguage();
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchUsers();
    }
  }, [open]);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, user_name, email")
        .eq("is_active", true)
        .order("user_name");

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  const handleSelectUser = (user: User) => {
    if (!selectedUsers.find((u) => u.user_id === user.user_id)) {
      setSelectedUsers([...selectedUsers, user]);
    }
    setUserPickerOpen(false);
  };

  const handleRemoveUser = (userId: string) => {
    setSelectedUsers(selectedUsers.filter((u) => u.user_id !== userId));
  };

  const handleSend = async () => {
    if (selectedUsers.length === 0) {
      toast({
        title: language === "ar" ? "خطأ" : "Error",
        description: language === "ar" ? "يرجى اختيار مستخدم واحد على الأقل" : "Please select at least one user",
        variant: "destructive",
      });
      return;
    }

    if (!subject.trim()) {
      toast({
        title: language === "ar" ? "خطأ" : "Error",
        description: language === "ar" ? "يرجى إدخال العنوان" : "Please enter a subject",
        variant: "destructive",
      });
      return;
    }

    if (!body.trim()) {
      toast({
        title: language === "ar" ? "خطأ" : "Error",
        description: language === "ar" ? "يرجى إدخال الرسالة" : "Please enter a message",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      // Send push notification to each selected user
      const results = await Promise.allSettled(
        selectedUsers.map((user) =>
          supabase.functions.invoke("send-push-notification", {
            body: {
              userId: user.user_id,
              title: subject,
              body: body,
            },
          })
        )
      );

      // Also create in-app notifications for each user
      const notifications = selectedUsers.map((user) => ({
        user_id: user.user_id,
        title: subject,
        message: body,
        type: "custom",
        is_read: false,
      }));

      await supabase.from("notifications").insert(notifications);

      const successCount = results.filter((r) => r.status === "fulfilled").length;

      toast({
        title: language === "ar" ? "تم الإرسال" : "Sent",
        description:
          language === "ar"
            ? `تم إرسال الإشعار إلى ${successCount} مستخدم`
            : `Notification sent to ${successCount} user(s)`,
      });

      // Reset form
      setSelectedUsers([]);
      setSubject("");
      setBody("");
      setOpen(false);
    } catch (error) {
      console.error("Error sending notifications:", error);
      toast({
        title: language === "ar" ? "خطأ" : "Error",
        description: language === "ar" ? "فشل في إرسال الإشعار" : "Failed to send notification",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full text-xs">
          <Send className="h-3 w-3 mr-1" />
          {language === "ar" ? "إرسال إشعار" : "Send Notification"}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            {language === "ar" ? "إرسال إشعار" : "Send Notification"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* To Field */}
          <div className="space-y-2">
            <Label>{language === "ar" ? "إلى" : "To"}</Label>
            <Popover open={userPickerOpen} onOpenChange={setUserPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-muted-foreground"
                >
                  {language === "ar" ? "اختر المستخدمين..." : "Select users..."}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[400px] p-0" align="start">
                <Command>
                  <CommandInput
                    placeholder={language === "ar" ? "بحث عن مستخدم..." : "Search user..."}
                  />
                  <CommandList>
                    <CommandEmpty>
                      {language === "ar" ? "لا يوجد مستخدمين" : "No users found"}
                    </CommandEmpty>
                    <CommandGroup>
                      {users
                        .filter((u) => !selectedUsers.find((s) => s.user_id === u.user_id))
                        .map((user) => (
                          <CommandItem
                            key={user.user_id}
                            onSelect={() => handleSelectUser(user)}
                          >
                            <span>{user.user_name}</span>
                            <span className="text-muted-foreground text-xs ml-2">
                              ({user.email})
                            </span>
                          </CommandItem>
                        ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            {/* Selected Users */}
            {selectedUsers.length > 0 && (
              <ScrollArea className="max-h-24">
                <div className="flex flex-wrap gap-1 mt-2">
                  {selectedUsers.map((user) => (
                    <Badge
                      key={user.user_id}
                      variant="secondary"
                      className="flex items-center gap-1"
                    >
                      {user.user_name}
                      <X
                        className="h-3 w-3 cursor-pointer hover:text-destructive"
                        onClick={() => handleRemoveUser(user.user_id)}
                      />
                    </Badge>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>

          {/* Subject Field */}
          <div className="space-y-2">
            <Label>{language === "ar" ? "العنوان" : "Subject"}</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={language === "ar" ? "أدخل العنوان" : "Enter subject"}
            />
          </div>

          {/* Body Field */}
          <div className="space-y-2">
            <Label>{language === "ar" ? "الرسالة" : "Message"}</Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={language === "ar" ? "أدخل الرسالة" : "Enter message"}
              rows={4}
            />
          </div>

          {/* Send Button */}
          <Button
            onClick={handleSend}
            disabled={isLoading}
            className="w-full"
          >
            <Send className="h-4 w-4 mr-2" />
            {isLoading
              ? language === "ar"
                ? "جاري الإرسال..."
                : "Sending..."
              : language === "ar"
              ? "إرسال"
              : "Send"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
