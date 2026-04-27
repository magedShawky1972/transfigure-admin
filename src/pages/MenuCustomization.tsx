import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePageAccess } from "@/hooks/usePageAccess";
import { AccessDenied } from "@/components/AccessDenied";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_MENU } from "@/lib/menuRegistry";
import { fetchMenuCustomizations, groupKey, itemKey } from "@/lib/menuCustomizations";
import {
  GripVertical,
  Save,
  RotateCcw,
  Loader2,
  EyeOff,
  Settings2,
} from "lucide-react";

interface ItemRow {
  key: string;
  url: string;
  defaultEn: string;
  defaultAr: string;
  name_en: string;
  name_ar: string;
  hidden: boolean;
}
interface GroupRow {
  key: string;
  defaultEn: string;
  defaultAr: string;
  name_en: string;
  name_ar: string;
  hidden: boolean;
  items: ItemRow[];
}

function SortableRow({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} className="flex items-start gap-2">
      <button
        type="button"
        className="mt-2 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
        {...attributes}
        {...listeners}
        aria-label="Drag handle"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="flex-1">{children}</div>
    </div>
  );
}

export default function MenuCustomization() {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const { toast } = useToast();
  const { hasAccess, isLoading: accessLoading } = usePageAccess("/menu-customization");

  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const customs = await fetchMenuCustomizations();
    const built: GroupRow[] = DEFAULT_MENU.map((g, gi) => {
      const gKey = groupKey(g.defaultEn);
      const gc = customs[gKey];
      const itemsWithMeta = g.items.map((it, ii) => {
        const iKey = itemKey(it.url);
        const ic = customs[iKey];
        return {
          key: iKey,
          url: it.url,
          defaultEn: it.defaultEn,
          defaultAr: it.defaultAr,
          name_en: ic?.name_en ?? it.defaultEn,
          name_ar: ic?.name_ar ?? it.defaultAr,
          hidden: ic?.hidden ?? false,
          _order: ic?.sort_order ?? ii,
        };
      });
      itemsWithMeta.sort((a, b) => (a as any)._order - (b as any)._order);
      return {
        key: gKey,
        defaultEn: g.defaultEn,
        defaultAr: g.defaultAr,
        name_en: gc?.name_en ?? g.defaultEn,
        name_ar: gc?.name_ar ?? g.defaultAr,
        hidden: gc?.hidden ?? false,
        items: itemsWithMeta.map(({ _order, ...rest }: any) => rest),
        _order: gc?.sort_order ?? gi,
      } as any;
    });
    built.sort((a: any, b: any) => a._order - b._order);
    setGroups(built.map(({ _order, ...rest }: any) => rest));
    setLoading(false);
  };

  useEffect(() => {
    if (hasAccess) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasAccess]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const onGroupDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = groups.findIndex((g) => g.key === active.id);
    const newIdx = groups.findIndex((g) => g.key === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    setGroups(arrayMove(groups, oldIdx, newIdx));
  };

  const onItemDragEnd = (groupKeyStr: string) => (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setGroups((prev) =>
      prev.map((g) => {
        if (g.key !== groupKeyStr) return g;
        const oldIdx = g.items.findIndex((i) => i.key === active.id);
        const newIdx = g.items.findIndex((i) => i.key === over.id);
        if (oldIdx < 0 || newIdx < 0) return g;
        return { ...g, items: arrayMove(g.items, oldIdx, newIdx) };
      })
    );
  };

  const updateGroup = (k: string, patch: Partial<GroupRow>) =>
    setGroups((prev) => prev.map((g) => (g.key === k ? { ...g, ...patch } : g)));

  const updateItem = (gk: string, ik: string, patch: Partial<ItemRow>) =>
    setGroups((prev) =>
      prev.map((g) =>
        g.key === gk
          ? { ...g, items: g.items.map((i) => (i.key === ik ? { ...i, ...patch } : i)) }
          : g
      )
    );

  const handleSave = async () => {
    setSaving(true);
    const rows: any[] = [];
    groups.forEach((g, gi) => {
      rows.push({
        key: g.key,
        kind: "group",
        sort_order: gi,
        name_en: g.name_en,
        name_ar: g.name_ar,
        hidden: g.hidden,
        icon: null,
      });
      g.items.forEach((it, ii) => {
        rows.push({
          key: it.key,
          kind: "item",
          sort_order: ii,
          name_en: it.name_en,
          name_ar: it.name_ar,
          hidden: it.hidden,
          icon: null,
        });
      });
    });

    const { error } = await supabase
      .from("menu_customizations")
      .upsert(rows, { onConflict: "key" });
    setSaving(false);
    if (error) {
      toast({
        title: isAr ? "فشل الحفظ" : "Save failed",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    toast({
      title: isAr ? "تم الحفظ" : "Saved",
      description: isAr ? "تم تحديث القائمة." : "Menu updated.",
    });
  };

  const handleResetAll = async () => {
    if (!confirm(isAr ? "إعادة كل التخصيصات إلى الإفتراضي؟" : "Reset all customizations to defaults?")) return;
    const { error } = await supabase.from("menu_customizations").delete().neq("key", "");
    if (error) {
      toast({ title: isAr ? "فشل الإعادة" : "Reset failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: isAr ? "تمت الإعادة" : "Reset done" });
    load();
  };

  const visibleCount = useMemo(
    () => groups.reduce((acc, g) => acc + (g.hidden ? 0 : g.items.filter((i) => !i.hidden).length), 0),
    [groups]
  );

  if (accessLoading) return <AccessDenied isLoading />;
  if (hasAccess === false) return <AccessDenied />;

  return (
    <div className="container mx-auto p-6" dir={isAr ? "rtl" : "ltr"}>
      <div className="mb-6 rounded-lg border border-border bg-card shadow-sm overflow-hidden">
        <div className="bg-slate-900 dark:bg-slate-800 px-6 py-5 text-white">
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-white/10 ring-1 ring-white/20">
              <Settings2 className="h-5 w-5" />
            </span>
            {isAr ? "تخصيص القائمة" : "Menu Customization"}
          </h1>
          <p className="text-sm text-slate-200 mt-2 leading-relaxed">
            {isAr
              ? "أعد ترتيب المجموعات والعناصر، عدّل الأسماء بالعربية والإنجليزية، أو أخفِ ما لا تحتاجه. التغييرات تنطبق على جميع المستخدمين."
              : "Reorder groups and items, rename them in English and Arabic, or hide what you don't need. Changes apply to all users."}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">
            {groups.length} {isAr ? "مجموعة" : "groups"}
          </Badge>
          <Badge variant="outline">
            {visibleCount} {isAr ? "عنصر مرئي" : "visible items"}
          </Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleResetAll} disabled={saving || loading}>
            <RotateCcw className="h-4 w-4 mr-2" />
            {isAr ? "إعادة الكل" : "Reset all"}
          </Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            {isAr ? "حفظ" : "Save"}
          </Button>
        </div>
      </div>

      {loading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onGroupDragEnd}>
          <SortableContext items={groups.map((g) => g.key)} strategy={verticalListSortingStrategy}>
            <Accordion type="multiple" className="space-y-3">
              {groups.map((g) => (
                <SortableRow key={g.key} id={g.key}>
                  <AccordionItem value={g.key} className="border rounded-lg bg-card">
                    <div className="flex items-center gap-2 px-3 py-2">
                      <AccordionTrigger className="flex-1 hover:no-underline py-2">
                        <div className="flex items-center gap-3 text-left">
                          <span className="font-semibold">
                            {isAr ? g.name_ar : g.name_en}
                          </span>
                          {g.hidden && (
                            <Badge variant="outline" className="text-xs">
                              <EyeOff className="h-3 w-3 mr-1" />
                              {isAr ? "مخفي" : "Hidden"}
                            </Badge>
                          )}
                          <Badge variant="secondary" className="text-xs">
                            {g.items.filter((i) => !i.hidden).length}/{g.items.length}
                          </Badge>
                        </div>
                      </AccordionTrigger>
                      <div className="flex items-center gap-2 pr-3" onClick={(e) => e.stopPropagation()}>
                        <Label className="text-xs text-muted-foreground">
                          {isAr ? "ظاهر" : "Visible"}
                        </Label>
                        <Switch
                          checked={!g.hidden}
                          onCheckedChange={(v) => updateGroup(g.key, { hidden: !v })}
                        />
                      </div>
                    </div>
                    <AccordionContent className="px-4 pb-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 p-3 rounded-md bg-muted/40">
                        <div className="space-y-1">
                          <Label className="text-xs">{isAr ? "اسم المجموعة (إنجليزي)" : "Group name (EN)"}</Label>
                          <Input
                            value={g.name_en}
                            placeholder={g.defaultEn}
                            onChange={(e) => updateGroup(g.key, { name_en: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">{isAr ? "اسم المجموعة (عربي)" : "Group name (AR)"}</Label>
                          <Input
                            value={g.name_ar}
                            placeholder={g.defaultAr}
                            onChange={(e) => updateGroup(g.key, { name_ar: e.target.value })}
                          />
                        </div>
                      </div>

                      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onItemDragEnd(g.key)}>
                        <SortableContext items={g.items.map((i) => i.key)} strategy={verticalListSortingStrategy}>
                          <div className="space-y-2">
                            {g.items.map((it) => (
                              <SortableRow key={it.key} id={it.key}>
                                <div className="border rounded-md p-3 bg-background">
                                  <div className="flex items-center justify-between mb-2 gap-2">
                                    <code className="text-xs text-muted-foreground truncate">{it.url}</code>
                                    <div className="flex items-center gap-2">
                                      <Label className="text-xs text-muted-foreground">
                                        {isAr ? "ظاهر" : "Visible"}
                                      </Label>
                                      <Switch
                                        checked={!it.hidden}
                                        onCheckedChange={(v) => updateItem(g.key, it.key, { hidden: !v })}
                                      />
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    <Input
                                      value={it.name_en}
                                      placeholder={it.defaultEn}
                                      onChange={(e) => updateItem(g.key, it.key, { name_en: e.target.value })}
                                    />
                                    <Input
                                      value={it.name_ar}
                                      placeholder={it.defaultAr}
                                      onChange={(e) => updateItem(g.key, it.key, { name_ar: e.target.value })}
                                    />
                                  </div>
                                </div>
                              </SortableRow>
                            ))}
                          </div>
                        </SortableContext>
                      </DndContext>
                    </AccordionContent>
                  </AccordionItem>
                </SortableRow>
              ))}
            </Accordion>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
