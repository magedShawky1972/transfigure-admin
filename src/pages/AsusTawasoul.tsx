import { useState, useEffect, useRef } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Send, Paperclip, Search, Users, X, Check, CheckCheck, MessageCircle } from "lucide-react";

interface UserProfile {
  id: string;
  user_id: string;
  user_name: string;
  email: string;
  avatar_url: string | null;
  is_active: boolean;
}

interface Conversation {
  id: string;
  is_group: boolean;
  group_id: string | null;
  conversation_name: string | null;
  created_at: string;
  participants: UserProfile[];
  last_message?: Message;
  unread_count: number;
}

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  message_text: string | null;
  media_url: string | null;
  media_type: string | null;
  is_read: boolean;
  created_at: string;
  sender?: UserProfile;
}

const AsusTawasoul = () => {
  const { language } = useLanguage();
  const isRTL = language === 'ar';
  
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [attachmentPreview, setAttachmentPreview] = useState<{ file: File; type: string; preview: string } | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);

  const focusMessageInput = () => {
    const el = messageInputRef.current;
    if (!el) return;
    try {
      (el as any).focus({ preventScroll: true });
    } catch {
      el.focus();
    }
  };

  const translations = {
    en: {
      title: "Asus Tawasoul",
      search: "Search users...",
      users: "Users",
      groups: "Groups",
      typeMessage: "Type a message...",
      send: "Send",
      newChat: "New Chat",
      selectUsers: "Select Users",
      selectGroup: "Select Group",
      startChat: "Start Chat",
      cancel: "Cancel",
      noMessages: "No messages yet",
      noConversations: "No conversations",
      online: "Online",
      offline: "Offline",
      attachment: "Attachment",
      image: "Image",
      video: "Video",
    },
    ar: {
      title: "أسس تواصل",
      search: "البحث عن المستخدمين...",
      users: "المستخدمين",
      groups: "المجموعات",
      typeMessage: "اكتب رسالة...",
      send: "إرسال",
      newChat: "محادثة جديدة",
      selectUsers: "اختر المستخدمين",
      selectGroup: "اختر المجموعة",
      startChat: "بدء المحادثة",
      cancel: "إلغاء",
      noMessages: "لا توجد رسائل بعد",
      noConversations: "لا توجد محادثات",
      online: "متصل",
      offline: "غير متصل",
      attachment: "مرفق",
      image: "صورة",
      video: "فيديو",
    }
  };

  const t = translations[language] || translations.en;

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
        await Promise.all([
          fetchUsers(),
          fetchConversations(user.id)
        ]);
      }
      setIsLoading(false);
    };
    init();
  }, []);

  useEffect(() => {
    if (!currentUserId) return;

    const channel = supabase
      .channel('internal-messages')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'internal_messages'
      }, (payload) => {
        const newMessage = payload.new as Message;
        if (selectedConversation && newMessage.conversation_id === selectedConversation.id) {
          fetchMessages(selectedConversation.id);
        }
        fetchConversations(currentUserId);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, selectedConversation]);

  useEffect(() => {
    if (selectedConversation && messages.length > 0) {
      scrollToBottom();
    }
  }, [messages, selectedConversation]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  };

  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('is_active', true)
      .order('user_name');
    
    if (!error && data) {
      setUsers(data);
    }
  };

  const fetchConversations = async (userId: string) => {
    const { data: participations, error } = await supabase
      .from('internal_conversation_participants')
      .select(`
        conversation_id,
        last_read_at,
        internal_conversations (
          id,
          is_group,
          group_id,
          conversation_name,
          created_at
        )
      `)
      .eq('user_id', userId);

    if (error || !participations) return;

    const conversationIds = participations
      .map(p => (p.internal_conversations as any)?.id)
      .filter(Boolean);

    if (conversationIds.length === 0) {
      setConversations([]);
      return;
    }

    // Batch fetch all participants, last messages, and unread counts
    const [allParticipantsRes, lastMessagesRes, unreadCountsRes] = await Promise.all([
      supabase
        .from('internal_conversation_participants')
        .select('conversation_id, user_id')
        .in('conversation_id', conversationIds),
      supabase
        .from('internal_messages')
        .select('*')
        .in('conversation_id', conversationIds)
        .order('created_at', { ascending: false }),
      supabase
        .from('internal_messages')
        .select('conversation_id', { count: 'exact' })
        .in('conversation_id', conversationIds)
        .eq('is_read', false)
        .neq('sender_id', userId)
    ]);

    const allParticipantIds = [...new Set(allParticipantsRes.data?.map(p => p.user_id) || [])];
    const { data: allProfiles } = await supabase
      .from('profiles')
      .select('*')
      .in('user_id', allParticipantIds);

    const profilesMap = new Map(allProfiles?.map(p => [p.user_id, p]) || []);
    
    // Group last messages by conversation (take first one for each)
    const lastMessageMap = new Map<string, any>();
    lastMessagesRes.data?.forEach(msg => {
      if (!lastMessageMap.has(msg.conversation_id)) {
        lastMessageMap.set(msg.conversation_id, msg);
      }
    });

    // Count unread per conversation
    const unreadMap = new Map<string, number>();
    unreadCountsRes.data?.forEach(row => {
      unreadMap.set(row.conversation_id, (unreadMap.get(row.conversation_id) || 0) + 1);
    });

    const convos: Conversation[] = participations.map(part => {
      const conv = part.internal_conversations as any;
      if (!conv) return null;

      const participantUserIds = allParticipantsRes.data
        ?.filter(p => p.conversation_id === conv.id)
        .map(p => p.user_id) || [];
      
      const participants = participantUserIds
        .map(uid => profilesMap.get(uid))
        .filter(Boolean) as UserProfile[];

      return {
        id: conv.id,
        is_group: conv.is_group,
        group_id: conv.group_id,
        conversation_name: conv.conversation_name,
        created_at: conv.created_at,
        participants,
        last_message: lastMessageMap.get(conv.id) || undefined,
        unread_count: unreadMap.get(conv.id) || 0
      };
    }).filter(Boolean) as Conversation[];

    convos.sort((a, b) => {
      const aTime = a.last_message?.created_at || a.created_at;
      const bTime = b.last_message?.created_at || b.created_at;
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    });

    setConversations(convos);
  };

  const fetchMessages = async (conversationId: string) => {
    const { data, error } = await supabase
      .from('internal_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (!error && data) {
      const messagesWithSenders = await Promise.all(data.map(async (msg) => {
        const sender = users.find(u => u.user_id === msg.sender_id);
        return { ...msg, sender };
      }));
      setMessages(messagesWithSenders);
      
      // Mark messages as read (via backend function to avoid permission/RLS issues)
      try {
        const { data: markData, error: markError } = await supabase.functions.invoke(
          'mark-internal-messages-read',
          {
            body: { conversationId }
          }
        );
        if (markError) {
          console.error('Mark read error:', markError);
        } else {
          console.log('Marked messages as read:', markData);
        }
      } catch (e) {
        console.error('Mark read invoke error:', e);
      }

      // Optimistically update unread counters
      setConversations((prev) =>
        prev.map((c) => (c.id === conversationId ? { ...c, unread_count: 0 } : c))
      );
      setSelectedConversation((prev) => (prev && prev.id === conversationId ? { ...prev, unread_count: 0 } : prev));

      if (currentUserId) {
        await fetchConversations(currentUserId);
      }
    }
  };

  const handleSelectConversation = async (conversation: Conversation) => {
    setSelectedConversation(conversation);
    await fetchMessages(conversation.id);
    setTimeout(() => focusMessageInput(), 0);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      toast({
        title: language === 'ar' ? "حجم الملف كبير جداً" : "File too large",
        description: language === 'ar' ? "الحد الأقصى 20 ميجابايت" : "Maximum 20MB allowed",
        variant: "destructive"
      });
      return;
    }

    const type = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'file';
    const preview = URL.createObjectURL(file);
    setAttachmentPreview({ file, type, preview });
  };

  const removeAttachment = () => {
    if (attachmentPreview) {
      URL.revokeObjectURL(attachmentPreview.preview);
      setAttachmentPreview(null);
    }
  };

  const uploadAttachment = async (file: File): Promise<{ url: string; type: string } | null> => {
    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
      const base64 = await base64Promise;

      const folder = file.type.startsWith('video/') ? 'Edara_Videos' : 'Edara_Images';
      const resourceType = file.type.startsWith('video/') ? 'video' : 'image';

      const { data, error } = await supabase.functions.invoke('upload-to-cloudinary', {
        body: {
          file: base64,
          folder,
          resourceType
        }
      });

      if (error) throw error;
      return { url: data.url, type: resourceType };
    } catch (error) {
      console.error('Upload error:', error);
      return null;
    }
  };

  const handleSendMessage = async () => {
    if ((!messageText.trim() && !attachmentPreview) || !selectedConversation || !currentUserId) return;

    setIsSending(true);
    try {
      let mediaUrl = null;
      let mediaType = null;

      if (attachmentPreview) {
        const result = await uploadAttachment(attachmentPreview.file);
        if (result) {
          mediaUrl = result.url;
          mediaType = result.type;
        }
        removeAttachment();
      }

      const { error } = await supabase.from('internal_messages').insert({
        conversation_id: selectedConversation.id,
        sender_id: currentUserId,
        message_text: messageText.trim() || null,
        media_url: mediaUrl,
        media_type: mediaType
      });

      if (error) throw error;

      setMessageText("");

      // Send notifications to other participants
      const otherParticipants = selectedConversation.participants.filter(p => p.user_id !== currentUserId);
      const currentUser = users.find(u => u.user_id === currentUserId);

      for (const participant of otherParticipants) {
        // Create in-app notification
        await supabase.from('notifications').insert({
          user_id: participant.user_id,
          title: language === 'ar' ? 'رسالة جديدة' : 'New Message',
          message: `${currentUser?.user_name || 'User'}: ${messageText.slice(0, 50)}${messageText.length > 50 ? '...' : ''}`,
          type: 'custom',
          sender_id: currentUserId,
          sender_name: currentUser?.user_name
        });

        // Send push notification
        await supabase.functions.invoke('send-push-notification', {
          body: {
            userId: participant.user_id,
            title: language === 'ar' ? 'رسالة جديدة من أسس تواصل' : 'New Message from Asus Tawasoul',
            body: `${currentUser?.user_name || 'User'}: ${messageText.slice(0, 50)}${messageText.length > 50 ? '...' : ''}`
          }
        });
      }

      await fetchMessages(selectedConversation.id);
      if (currentUserId) await fetchConversations(currentUserId);
    } catch (error) {
      console.error('Send error:', error);
      toast({
        title: language === 'ar' ? "خطأ" : "Error",
        description: language === 'ar' ? "فشل في إرسال الرسالة" : "Failed to send message",
        variant: "destructive"
      });
    } finally {
      setIsSending(false);
    }
  };

  const getConversationName = (conv: Conversation) => {
    if (conv.conversation_name) return conv.conversation_name;
    const otherParticipants = conv.participants.filter(p => p.user_id !== currentUserId);
    return otherParticipants.map(p => p.user_name).join(', ') || 'Unknown';
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString(language === 'ar' ? 'ar-SA' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Sort users by most recent *message* activity with CURRENT user only
  // (Conversations with no messages should NOT float to the top)
  const filteredUsers = users
    .filter(
      (u) => u.user_id !== currentUserId && u.user_name.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      const convoA = conversations.find(
        (c) =>
          !c.is_group &&
          c.participants.length === 2 &&
          c.participants.some((p) => p.user_id === a.user_id) &&
          c.participants.some((p) => p.user_id === currentUserId)
      );
      const convoB = conversations.find(
        (c) =>
          !c.is_group &&
          c.participants.length === 2 &&
          c.participants.some((p) => p.user_id === b.user_id) &&
          c.participants.some((p) => p.user_id === currentUserId)
      );

      const timeA = convoA?.last_message?.created_at; // ONLY last message time
      const timeB = convoB?.last_message?.created_at;

      if (timeA && timeB) return new Date(timeB).getTime() - new Date(timeA).getTime();
      if (timeA) return -1;
      if (timeB) return 1;

      // No messages between current user and both users => sort by name
      return a.user_name.localeCompare(b.user_name);
    });

  const filteredConversations = conversations.filter(c => {
    const name = getConversationName(c);
    return name.toLowerCase().includes(searchTerm.toLowerCase());
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const findOrCreateConversation = async (targetUserId: string) => {
    if (!currentUserId) return;

    try {
      // Use RPC function to find or create conversation (bypasses RLS issues)
      const { data: convId, error } = await supabase.rpc('find_or_create_direct_conversation', {
        other_user_id: targetUserId
      });

      if (error) throw error;

      await fetchConversations(currentUserId);
      
      // Find and select the conversation
      const targetUser = users.find(u => u.user_id === targetUserId);
      const newConvo: Conversation = {
        id: convId,
        is_group: false,
        group_id: null,
        conversation_name: null,
        created_at: new Date().toISOString(),
        participants: [
          users.find(u => u.user_id === currentUserId)!,
          targetUser!
        ].filter(Boolean),
        unread_count: 0
      };
      setSelectedConversation(newConvo);
      await fetchMessages(convId);
      setTimeout(() => focusMessageInput(), 0);
    } catch (error) {
      console.error('Create chat error:', error);
      toast({
        title: language === 'ar' ? "خطأ" : "Error",
        variant: "destructive"
      });
    }
  };

  const usersList = (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="p-4 border-b">
        <div className="relative">
          <Search
            className={`absolute ${isRTL ? "right-3" : "left-3"} top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground`}
          />
          <Input
            placeholder={t.search}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={isRTL ? "pr-10" : "pl-10"}
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {filteredUsers.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              {language === "ar" ? "لا يوجد مستخدمين" : "No users found"}
            </p>
          ) : (
            filteredUsers.map((user) => {
              // Check if there's an existing conversation with this user
              const existingConvo = conversations.find(
                (c) => !c.is_group && c.participants.length === 2 && c.participants.some((p) => p.user_id === user.user_id)
              );
              const isSelected = selectedConversation && existingConvo?.id === selectedConversation.id;
              const unreadCount = existingConvo?.unread_count || 0;
              const lastMessage = existingConvo?.last_message;

              return (
                <div
                  key={user.id}
                  className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                    isSelected ? "bg-primary/10" : "hover:bg-muted"
                  }`}
                  onClick={() => findOrCreateConversation(user.user_id)}
                >
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={user.avatar_url || undefined} />
                    <AvatarFallback>{user.user_name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="font-medium truncate">{user.user_name}</p>
                      {lastMessage && (
                        <span className="text-xs text-muted-foreground">{formatTime(lastMessage.created_at)}</span>
                      )}
                    </div>
                    {lastMessage ? (
                      <p className="text-sm text-muted-foreground truncate">
                        {lastMessage.message_text ||
                          (lastMessage.media_type === "image" ? "📷 " + t.image : "🎥 " + t.video)}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <Badge variant="default" className="rounded-full">
                      {unreadCount}
                    </Badge>
                  )}
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );

  const chatArea = (
    <div className="h-full flex flex-col overflow-hidden">
      {!selectedConversation ? (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <div className="text-center">
            <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>{language === "ar" ? "اختر محادثة للبدء" : "Select a conversation to start"}</p>
          </div>
        </div>
      ) : (
        <>
          <div className="p-4 border-b flex items-center gap-3">
            <Avatar className="h-10 w-10">
              {selectedConversation.is_group ? (
                <AvatarFallback>
                  <Users className="h-5 w-5" />
                </AvatarFallback>
              ) : (
                <>
                  <AvatarImage
                    src={
                      selectedConversation.participants.find((p) => p.user_id !== currentUserId)?.avatar_url || undefined
                    }
                  />
                  <AvatarFallback>{getConversationName(selectedConversation).charAt(0)}</AvatarFallback>
                </>
              )}
            </Avatar>
            <div>
              <h3 className="font-semibold">{getConversationName(selectedConversation)}</h3>
              {selectedConversation.is_group && (
                <p className="text-xs text-muted-foreground">
                  {selectedConversation.participants.length} {language === "ar" ? "أعضاء" : "members"}
                </p>
              )}
            </div>
          </div>

          <ScrollArea className="flex-1 min-h-0 p-4">
            <div className="space-y-4">
              {messages.length === 0 ? (
                <p className="text-center text-muted-foreground">{t.noMessages}</p>
              ) : (
                messages.map((msg) => {
                  const isOwn = msg.sender_id === currentUserId;
                  return (
                    <div key={msg.id} className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[70%] ${isOwn ? "order-2" : ""}`}>
                        {!isOwn && selectedConversation.is_group && (
                          <p className="text-xs text-muted-foreground mb-1">{msg.sender?.user_name}</p>
                        )}
                        <div
                          className={`rounded-lg p-3 ${
                            isOwn ? "bg-primary text-primary-foreground" : "bg-muted"
                          }`}
                        >
                          {msg.media_url && (
                            <div className="mb-2">
                              {msg.media_type === "image" ? (
                                <img
                                  src={msg.media_url}
                                  alt=""
                                  className="rounded max-w-full max-h-60 object-cover"
                                  loading="lazy"
                                />
                              ) : (
                                <video src={msg.media_url} controls className="rounded max-w-full max-h-60" />
                              )}
                            </div>
                          )}
                          {msg.message_text && <p>{msg.message_text}</p>}
                          <div
                            className={`flex items-center justify-end gap-1 mt-1 ${
                              isOwn ? "text-primary-foreground/70" : "text-muted-foreground"
                            }`}
                          >
                            <span className="text-xs">{formatTime(msg.created_at)}</span>
                            {isOwn && (msg.is_read ? <CheckCheck className="h-3 w-3" /> : <Check className="h-3 w-3" />)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {attachmentPreview && (
            <div className="px-4 py-2 border-t bg-muted/50">
              <div className="flex items-center gap-2">
                {attachmentPreview.type === "image" ? (
                  <img
                    src={attachmentPreview.preview}
                    alt=""
                    className="h-16 w-16 object-cover rounded"
                    loading="lazy"
                  />
                ) : (
                  <video src={attachmentPreview.preview} className="h-16 w-16 object-cover rounded" />
                )}
                <span className="flex-1 truncate">{attachmentPreview.file.name}</span>
                <Button variant="ghost" size="icon" onClick={removeAttachment}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          <div className="p-4 border-t">
            <div className="flex items-center gap-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept="image/*,video/*"
                className="hidden"
              />
              <Button variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()}>
                <Paperclip className="h-5 w-5" />
              </Button>
              <Input
                ref={messageInputRef}
                placeholder={t.typeMessage}
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                className="flex-1"
              />
              <Button onClick={handleSendMessage} disabled={isSending || (!messageText.trim() && !attachmentPreview)}>
                <Send className={`h-5 w-5 ${isRTL ? "rotate-180" : ""}`} />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="container mx-auto py-4" dir={isRTL ? "rtl" : "ltr"}>
      <h1 className="text-2xl font-bold mb-4">{t.title}</h1>

      <Card className="h-[calc(100vh-140px)]">
        <CardContent className="p-0 h-full overflow-hidden">
          <div
            className={cn(
              "grid grid-cols-1 md:grid-cols-3 h-full min-h-0",
              isRTL ? "md:grid-flow-col-dense" : "",
            )}
          >
            <div
              className={cn(
                "border-b md:border-b-0 h-full min-h-0 overflow-hidden",
                isRTL ? "md:border-l md:col-start-3" : "md:border-r",
              )}
            >
              {usersList}
            </div>
            <div
              className={cn(
                "col-span-2 h-full min-h-0 overflow-hidden",
                isRTL ? "md:col-start-1 md:col-end-3" : "",
              )}
            >
              {chatArea}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AsusTawasoul;
