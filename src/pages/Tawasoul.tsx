import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Search, Send, MessageCircle, User, Phone } from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

interface Conversation {
  id: string;
  customer_phone: string;
  customer_name: string | null;
  last_message_at: string;
  unread_count: number;
}

interface Message {
  id: string;
  conversation_id: string;
  sender_type: string;
  message_text: string;
  message_status: string | null;
  created_at: string;
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchConversations();
    
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
          console.log('Message change:', payload);
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

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation) return;

    try {
      // First insert the message to get its ID
      const { data: insertedMessage, error } = await supabase
        .from("whatsapp_messages")
        .insert({
          conversation_id: selectedConversation.id,
          sender_type: "agent",
          message_text: newMessage.trim(),
          message_status: "sending",
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

      // Send via Twilio API using edge function
      const { data: sendResult, error: sendError } = await supabase.functions.invoke(
        "send-whatsapp-message",
        {
          body: {
            to: selectedConversation.customer_phone,
            message: messageText,
            conversationId: selectedConversation.id,
            messageId: insertedMessage?.id,
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
        return;
      }

      toast({
        title: language === "ar" ? "تم الإرسال" : "Sent",
        description: language === "ar" ? "تم إرسال الرسالة بنجاح" : "Message sent successfully",
      });
    } catch (error) {
      console.error("Error sending message:", error);
      toast({
        title: language === "ar" ? "خطأ" : "Error",
        description: language === "ar" ? "فشل في إرسال الرسالة" : "Failed to send message",
        variant: "destructive",
      });
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

  return (
    <div className="container mx-auto p-4 h-[calc(100vh-120px)]">
      <div className="flex items-center gap-3 mb-4">
        <MessageCircle className="h-8 w-8 text-primary" />
        <h1 className="text-2xl font-bold">
          {language === "ar" ? "تواصل" : "Tawasoul"}
        </h1>
      </div>

      <div className={`flex gap-4 h-full ${language === "ar" ? "flex-row-reverse" : ""}`}>
        {/* Conversations List - Right side for Arabic, Left for English */}
        <Card className={`w-80 flex flex-col ${language === "ar" ? "order-1" : "order-1"}`}>
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
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-medium truncate">
                            {conversation.customer_name || conversation.customer_phone}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(conversation.last_message_at)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground truncate" dir="ltr">
                            {conversation.customer_phone}
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
        <Card className={`flex-1 flex flex-col ${language === "ar" ? "order-2" : "order-2"}`}>
          {selectedConversation ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">
                    {selectedConversation.customer_name || selectedConversation.customer_phone}
                  </h3>
                  <p className="text-sm text-muted-foreground" dir="ltr">
                    {selectedConversation.customer_phone}
                  </p>
                </div>
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
                        <p className="break-words">{message.message_text}</p>
                        <span className={`text-xs mt-1 block ${
                          message.sender_type === "agent"
                            ? "text-primary-foreground/70"
                            : "text-muted-foreground"
                        }`}>
                          {formatTime(message.created_at)}
                        </span>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {/* Message Input */}
              <div className="p-4 border-t">
                <div className={`flex gap-2 ${language === "ar" ? "flex-row-reverse" : ""}`}>
                  <Input
                    placeholder={language === "ar" ? "اكتب رسالة..." : "Type a message..."}
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                    className="flex-1"
                  />
                  <Button onClick={handleSendMessage} size="icon">
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
    </div>
  );
};

export default Tawasoul;
