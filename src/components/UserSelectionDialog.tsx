import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

interface User {
  id: string;
  user_id: string;
  user_name: string;
  email: string;
  avatar_url: string | null;
  job_position_id?: string | null;
  default_department_id?: string | null;
}

interface UserSelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  users: User[];
  onSelect: (userId: string) => void;
  onMultiSelect?: (userIds: string[]) => void;
  title?: string;
  multiSelect?: boolean;
}

const ITEMS_PER_PAGE = 8;

const UserSelectionDialog = ({
  open,
  onOpenChange,
  users,
  onSelect,
  onMultiSelect,
  title,
  multiSelect = false,
}: UserSelectionDialogProps) => {
  const { language } = useLanguage();
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  // Filter users based on search
  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users;
    const query = searchQuery.toLowerCase();
    return users.filter(
      (user) =>
        user.user_name.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query)
    );
  }, [users, searchQuery]);

  // Pagination
  const totalPages = Math.ceil(filteredUsers.length / ITEMS_PER_PAGE);
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredUsers.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredUsers, currentPage]);

  // Reset page when search changes
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSelect = () => {
    if (multiSelect) {
      if (selectedUserIds.length > 0 && onMultiSelect) {
        onMultiSelect(selectedUserIds);
        setSelectedUserIds([]);
        setSearchQuery("");
        setCurrentPage(1);
      }
    } else {
      if (selectedUserId) {
        onSelect(selectedUserId);
        setSelectedUserId(null);
        setSearchQuery("");
        setCurrentPage(1);
      }
    }
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      setSelectedUserId(null);
      setSelectedUserIds([]);
      setSearchQuery("");
      setCurrentPage(1);
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {title || (language === "ar" ? "اختر موظف" : "Select User")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={
                language === "ar" ? "بحث بالاسم أو البريد..." : "Search by name or email..."
              }
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Users List */}
          <ScrollArea className="h-[320px] rounded-md border">
            <div className="p-2 space-y-1">
              {paginatedUsers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {language === "ar" ? "لا توجد نتائج" : "No results found"}
                </div>
              ) : multiSelect ? (
                paginatedUsers.map((user) => (
                  <div
                    key={user.user_id}
                    onClick={() => toggleUserSelection(user.user_id)}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors",
                      selectedUserIds.includes(user.user_id)
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted"
                    )}
                  >
                    <Checkbox
                      checked={selectedUserIds.includes(user.user_id)}
                      onCheckedChange={() => toggleUserSelection(user.user_id)}
                      className={cn(
                        selectedUserIds.includes(user.user_id) && "border-primary-foreground"
                      )}
                    />
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={user.avatar_url || undefined} />
                      <AvatarFallback>
                        {user.user_name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{user.user_name}</div>
                      <div
                        className={cn(
                          "text-sm truncate",
                          selectedUserIds.includes(user.user_id)
                            ? "text-primary-foreground/80"
                            : "text-muted-foreground"
                        )}
                      >
                        {user.email}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                paginatedUsers.map((user) => (
                  <div
                    key={user.user_id}
                    onClick={() => setSelectedUserId(user.user_id)}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors",
                      selectedUserId === user.user_id
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted"
                    )}
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={user.avatar_url || undefined} />
                      <AvatarFallback>
                        {user.user_name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{user.user_name}</div>
                      <div
                        className={cn(
                          "text-sm truncate",
                          selectedUserId === user.user_id
                            ? "text-primary-foreground/80"
                            : "text-muted-foreground"
                        )}
                      >
                        {user.email}
                      </div>
                    </div>
                    {selectedUserId === user.user_id && (
                      <Check className="h-5 w-5 shrink-0" />
                    )}
                  </div>
                ))
              )}
            </div>
          </ScrollArea>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
                {language === "ar" ? "السابق" : "Previous"}
              </Button>
              <span className="text-sm text-muted-foreground">
                {language === "ar"
                  ? `${currentPage} من ${totalPages}`
                  : `${currentPage} of ${totalPages}`}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                {language === "ar" ? "التالي" : "Next"}
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Results count */}
          <div className="text-xs text-muted-foreground text-center">
            {multiSelect ? (
              language === "ar"
                ? `${selectedUserIds.length} مختار من ${filteredUsers.length} موظف`
                : `${selectedUserIds.length} selected of ${filteredUsers.length} users`
            ) : (
              language === "ar"
                ? `${filteredUsers.length} موظف`
                : `${filteredUsers.length} users`
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => handleClose(false)}
            >
              {language === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              className="flex-1"
              onClick={handleSelect}
              disabled={multiSelect ? selectedUserIds.length === 0 : !selectedUserId}
            >
              {language === "ar" ? "تعيين" : "Assign"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UserSelectionDialog;