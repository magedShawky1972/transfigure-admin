import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Search, Send, MessageCircle, User, Check, CheckCheck, Clock, Paperclip, X, FileIcon, ImageIcon, BadgeCheck, Receipt } from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { TawasoulTransactionsDialog } from "@/components/TawasoulTransactionsDialog";

interface Conversation {
  id: string;
  customer_phone: string;
  customer_name: string | null;
  last_message_at: string;
  unread_count: number;
  isRegistered?: boolean;
}

interface Message {
  id: string;
  conversation_id: string;
  sender_type: string;
  message_text: string;
  message_status: string | null;
  created_at: string;
  media_url?: string | null;
  media_type?: string | null;
}

interface AttachmentPreview {
  file: File;
  previewUrl: string;
  type: string;
}

const Tawasoul = () => {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [attachment, setAttachment] = useState<AttachmentPreview | null>(null);
  const [uploading, setUploading] = useState(false);
  const [registeredPhones, setRegisteredPhones] = useState<Set<string>>(new Set());
  const registeredPhonesRef = useRef<Set<string>>(new Set());
  const [transactionsDialogOpen, setTransactionsDialogOpen] = useState(false);
  const [transactionsCustomerPhone, setTransactionsCustomerPhone] = useState("");
  const [transactionsCustomerName, setTransactionsCustomerName] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Fetch conversations first, then check which phones are registered
    const init = async () => {
      const { data: convData } = await supabase
        .from("whatsapp_conversations")
        .select("customer_phone")
        .order("last_message_at", { ascending: false });
      
      const phones = convData?.map(c => c.customer_phone) || [];
      await fetchRegisteredCustomers(phones);
      fetchConversations();
    };
    init();
    
    // Real-time subscription for new messages
    const messagesChannel = supabase
      .channel('whatsapp-messages')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'whatsapp_messages',
        },
        (payload) => {
          // Message received
          if (selectedConversation) {
            fetchMessages(selectedConversation.id);
          }
          fetchConversations();
        }
      )
      .subscribe();

    // Real-time subscription for conversations
    const conversationsChannel = supabase
      .channel('whatsapp-conversations')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'whatsapp_conversations',
        },
        () => {
          fetchConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(conversationsChannel);
    };
  }, [selectedConversation]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Extract core phone digits (last 9-10 digits) for matching
  const extractCorePhone = (phone: string): string => {
    // Remove all non-digits
    const digits = phone.replace(/\D/g, '');
    // Return the last 10 digits (or less if shorter)
    return digits.slice(-10);
  };

  const fetchRegisteredCustomers = async (conversationPhones: string[]) => {
    try {
      if (!conversationPhones.length) {
        registeredPhonesRef.current = new Set();
        setRegisteredPhones(new Set());
        return;
      }
      
      // Fetch ALL customers using pagination
      const allCustomers: string[] = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;
      
      while (hasMore) {
        const { data, error } = await supabase
          .from("customers")
          .select("customer_phone")
          .range(page * pageSize, (page + 1) * pageSize - 1);
        
        if (error) throw error;
        
        if (data && data.length > 0) {
          allCustomers.push(...data.map(c => c.customer_phone));
          hasMore = data.length === pageSize;
          page++;
        } else {
          hasMore = false;
        }
      }
      
      // Build set of ALL customer core phones
      const allCustomerCorePhones = new Set<string>();
      allCustomers.forEach(phone => {
        const core = extractCorePhone(phone);
        allCustomerCorePhones.add(core);
      });
      
      
      registeredPhonesRef.current = allCustomerCorePhones;
      setRegisteredPhones(allCustomerCorePhones);
    } catch (error) {
      console.error("Error fetching registered customers:", error);
    }
  };

  const fetchConversations = async () => {
    try {
      const { data, error } = await supabase
        .from("whatsapp_conversations")
        .select("*")
        .order("last_message_at", { ascending: false });

      if (error) throw error;
      setConversations(data || []);
    } catch (error) {
      console.error("Error fetching conversations:", error);
    } finally {
      setLoading(false);
    }
  };

  const isCustomerRegistered = (phone: string) => {
    const corePhone = extractCorePhone(phone);
    return registeredPhonesRef.current.has(corePhone) || registeredPhones.has(corePhone);
  };

  const openTransactionsDialog = (phone: string, name: string | null, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setTransactionsCustomerPhone(phone);
    setTransactionsCustomerName(name);
    setTransactionsDialogOpen(true);
  };

  const fetchMessages = async (conversationId: string) => {
    try {
      const { data, error } = await supabase
        .from("whatsapp_messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setMessages(data || []);

      // Mark as read
      await supabase
        .from("whatsapp_conversations")
        .update({ unread_count: 0 })
        .eq("id", conversationId);
    } catch (error) {
      console.error("Error fetching messages:", error);
    }
  };

  const handleSelectConversation = (conversation: Conversation) => {
    setSelectedConversation(conversation);
    fetchMessages(conversation.id);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (max 16MB for Twilio)
    if (file.size > 16 * 1024 * 1024) {
      toast({
        title: language === "ar" ? "خطأ" : "Error",
        description: language === "ar" ? "حجم الملف كبير جداً (الحد الأقصى 16 ميجابايت)" : "File is too large (max 16MB)",
        variant: "destructive",
      });
      return;
    }

    const type = file.type.startsWith('image/') ? 'image' : 'file';
    const previewUrl = type === 'image' ? URL.createObjectURL(file) : '';
    
    setAttachment({ file, previewUrl, type });
  };

  const removeAttachment = () => {
    if (attachment?.previewUrl) {
      URL.revokeObjectURL(attachment.previewUrl);
    }
    setAttachment(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const uploadAttachment = async (file: File): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `attachments/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('whatsapp-attachments')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('whatsapp-attachments')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error("Error uploading attachment:", error);
      return null;
    }
  };

  const handleSendMessage = async () => {
    if ((!newMessage.trim() && !attachment) || !selectedConversation) return;

    setUploading(true);
    
    try {
      let mediaUrl: string | null = null;
      let mediaType: string | null = null;

      // Upload attachment if exists
      if (attachment) {
        mediaUrl = await uploadAttachment(attachment.file);
        mediaType = attachment.type;
        
        if (!mediaUrl) {
          toast({
            title: language === "ar" ? "خطأ" : "Error",
            description: language === "ar" ? "فشل في رفع المرفق" : "Failed to upload attachment",
            variant: "destructive",
          });
          setUploading(false);
          return;
        }
      }

      // First insert the message to get its ID
      const { data: insertedMessage, error } = await supabase
        .from("whatsapp_messages")
        .insert({
          conversation_id: selectedConversation.id,
          sender_type: "agent",
          message_text: newMessage.trim() || (attachment ? (language === "ar" ? "مرفق" : "Attachment") : ""),
          message_status: "sending",
          media_url: mediaUrl,
          media_type: mediaType,
        })
        .select()
        .single();

      if (error) throw error;

      // Update last message time
      await supabase
        .from("whatsapp_conversations")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", selectedConversation.id);

      const messageText = newMessage.trim();
      setNewMessage("");
      removeAttachment();

      // Send via Twilio API using edge function
      const { data: sendResult, error: sendError } = await supabase.functions.invoke(
        "send-whatsapp-message",
        {
          body: {
            to: selectedConversation.customer_phone,
            message: messageText || undefined,
            conversationId: selectedConversation.id,
            messageId: insertedMessage?.id,
            mediaUrl: mediaUrl || undefined,
            mediaType: mediaType || undefined,
          },
        }
      );

      if (sendError) {
        console.error("Twilio send error:", sendError);
        toast({
          title: language === "ar" ? "تحذير" : "Warning",
          description: language === "ar" ? "تم حفظ الرسالة لكن فشل الإرسال عبر WhatsApp" : "Message saved but failed to send via WhatsApp",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error sending message:", error);
      toast({
        title: language === "ar" ? "خطأ" : "Error",
        description: language === "ar" ? "فشل في إرسال الرسالة" : "Failed to send message",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const filteredConversations = conversations.filter(
    (conv) =>
      conv.customer_phone.includes(searchTerm) ||
      conv.customer_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return format(date, "HH:mm", { locale: language === "ar" ? ar : undefined });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return language === "ar" ? "اليوم" : "Today";
    } else if (date.toDateString() === yesterday.toDateString()) {
      return language === "ar" ? "أمس" : "Yesterday";
    }
    return format(date, "dd/MM/yyyy");
  };

  // Message status icon component
  const MessageStatusIcon = ({ status }: { status: string | null }) => {
    switch (status) {
      case "sending":
        return <Clock className="h-3 w-3 inline-block ml-1" />;
      case "sent":
      case "queued":
        return <Check className="h-3 w-3 inline-block ml-1" />;
      case "delivered":
        return <CheckCheck className="h-3 w-3 inline-block ml-1" />;
      case "read":
        return <CheckCheck className="h-3 w-3 inline-block ml-1 text-blue-400" />;
      case "failed":
        return <span className="text-xs text-red-400 ml-1">!</span>;
      default:
        return <Check className="h-3 w-3 inline-block ml-1" />;
    }
  };

  // Render attachment in message
  const MessageAttachment = ({ mediaUrl, mediaType }: { mediaUrl: string; mediaType: string | null }) => {
    if (mediaType === 'image') {
      return (
        <a href={mediaUrl} target="_blank" rel="noopener noreferrer" className="block mt-2">
          <img 
            src={mediaUrl} 
            alt="Attachment" 
            className="max-w-[200px] max-h-[200px] rounded-lg object-cover cursor-pointer hover:opacity-90 transition-opacity"
          />
        </a>
      );
    }
    
    return (
      <a 
        href={mediaUrl} 
        target="_blank" 
        rel="noopener noreferrer"
        className="flex items-center gap-2 mt-2 p-2 bg-black/10 rounded-lg hover:bg-black/20 transition-colors"
      >
        <FileIcon className="h-5 w-5" />
        <span className="text-sm underline">{language === "ar" ? "عرض المرفق" : "View attachment"}</span>
      </a>
    );
  };

  return (
    <div className="container mx-auto p-4 h-[calc(100vh-120px)]">
      <div className="flex items-center gap-3 mb-4">
        <MessageCircle className="h-8 w-8 text-primary" />
        <h1 className="text-2xl font-bold">
          {language === "ar" ? "تواصل" : "Tawasoul"}
        </h1>
      </div>

      <div className={`flex gap-4 h-full ${language === "ar" ? "flex-row-reverse" : "flex-row"}`}>
        {/* Conversations List - Right side for Arabic, Left for English */}
        <Card className="w-80 flex flex-col">
          <div className="p-3 border-b">
            <div className="relative">
              <Search className={`absolute top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground ${language === "ar" ? "right-3" : "left-3"}`} />
              <Input
                placeholder={language === "ar" ? "بحث..." : "Search..."}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={language === "ar" ? "pr-9" : "pl-9"}
              />
            </div>
          </div>

          <ScrollArea className="flex-1">
            {loading ? (
              <div className="p-4 text-center text-muted-foreground">
                {language === "ar" ? "جاري التحميل..." : "Loading..."}
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">
                <MessageCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>{language === "ar" ? "لا توجد محادثات" : "No conversations"}</p>
              </div>
            ) : (
              <div className="divide-y">
                {filteredConversations.map((conversation) => (
                  <div
                    key={conversation.id}
                    onClick={() => handleSelectConversation(conversation)}
                    className={`p-3 cursor-pointer hover:bg-muted/50 transition-colors ${
                      selectedConversation?.id === conversation.id
                        ? "bg-primary/10"
                        : ""
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0 relative">
                        <User className="h-5 w-5 text-primary" />
                        {isCustomerRegistered(conversation.customer_phone) && (
                          <BadgeCheck className="h-4 w-4 text-green-500 absolute -bottom-1 -right-1 bg-background rounded-full" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <div className="flex items-center gap-1 min-w-0">
                            <span className="font-medium truncate">
                              {conversation.customer_name || (language === "ar" ? "عميل" : "Customer")}
                            </span>
                            {isCustomerRegistered(conversation.customer_phone) && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 shrink-0"
                                onClick={(e) => openTransactionsDialog(conversation.customer_phone, conversation.customer_name, e)}
                                title={language === "ar" ? "عرض المعاملات" : "View Transactions"}
                              >
                                <Receipt className="h-3.5 w-3.5 text-muted-foreground hover:text-primary" />
                              </Button>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground shrink-0">
                            {formatDate(conversation.last_message_at)}
                          </span>
                        </div>
                        {conversation.unread_count > 0 && (
                          <Badge variant="default" className="mt-1 text-xs">
                            {conversation.unread_count}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </Card>

        {/* Chat Area - Left side for Arabic, Right for English */}
        <Card className="flex-1 flex flex-col">
          {selectedConversation ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center relative">
                  <User className="h-5 w-5 text-primary" />
                  {isCustomerRegistered(selectedConversation.customer_phone) && (
                    <BadgeCheck className="h-4 w-4 text-green-500 absolute -bottom-1 -right-1 bg-background rounded-full" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">
                      {selectedConversation.customer_name || (language === "ar" ? "عميل" : "Customer")}
                    </h3>
                    {isCustomerRegistered(selectedConversation.customer_phone) && (
                      <Badge variant="outline" className="text-xs text-green-600 border-green-500">
                        {language === "ar" ? "عميل مسجل" : "Registered"}
                      </Badge>
                    )}
                  </div>
                </div>
                {isCustomerRegistered(selectedConversation.customer_phone) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openTransactionsDialog(selectedConversation.customer_phone, selectedConversation.customer_name)}
                  >
                    <Receipt className="h-4 w-4 mr-1" />
                    {language === "ar" ? "المعاملات" : "Transactions"}
                  </Button>
                )}
              </div>

              {/* Messages */}
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${
                        message.sender_type === "agent"
                          ? language === "ar" ? "justify-start" : "justify-end"
                          : language === "ar" ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-[70%] rounded-lg px-4 py-2 ${
                          message.sender_type === "agent"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        }`}
                      >
                        {message.media_url && (
                          <MessageAttachment mediaUrl={message.media_url} mediaType={message.media_type || null} />
                        )}
                        {message.message_text && message.message_text !== (language === "ar" ? "مرفق" : "Attachment") && (
                          <p className="break-words">{message.message_text}</p>
                        )}
                        <div className={`flex items-center justify-end gap-1 mt-1 ${
                          message.sender_type === "agent"
                            ? "text-primary-foreground/70"
                            : "text-muted-foreground"
                        }`}>
                          <span className="text-xs">
                            {formatTime(message.created_at)}
                          </span>
                          {message.sender_type === "agent" && (
                            <MessageStatusIcon status={message.message_status} />
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {/* Attachment Preview */}
              {attachment && (
                <div className="px-4 py-2 border-t bg-muted/30">
                  <div className="flex items-center gap-2">
                    {attachment.type === 'image' ? (
                      <img 
                        src={attachment.previewUrl} 
                        alt="Preview" 
                        className="h-16 w-16 object-cover rounded-lg"
                      />
                    ) : (
                      <div className="h-16 w-16 bg-muted rounded-lg flex items-center justify-center">
                        <FileIcon className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{attachment.file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(attachment.file.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={removeAttachment}
                      className="shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Message Input */}
              <div className="p-4 border-t">
                <div className={`flex gap-2 ${language === "ar" ? "flex-row-reverse" : ""}`}>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    className="hidden"
                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                  />
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    <Paperclip className="h-4 w-4" />
                  </Button>
                  <Input
                    placeholder={language === "ar" ? "اكتب رسالة..." : "Type a message..."}
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && !uploading && handleSendMessage()}
                    className="flex-1"
                    disabled={uploading}
                  />
                  <Button 
                    onClick={handleSendMessage} 
                    size="icon"
                    disabled={uploading || (!newMessage.trim() && !attachment)}
                  >
                    <Send className={`h-4 w-4 ${language === "ar" ? "rotate-180" : ""}`} />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MessageCircle className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg">
                  {language === "ar"
                    ? "اختر محادثة للبدء"
                    : "Select a conversation to start"}
                </p>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Transactions Dialog */}
      <TawasoulTransactionsDialog
        open={transactionsDialogOpen}
        onOpenChange={setTransactionsDialogOpen}
        customerPhone={transactionsCustomerPhone}
        customerName={transactionsCustomerName}
      />
    </div>
  );
};

export default Tawasoul;
