import { ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface ApeTab {
  value: string;
  label: string;
  count?: number;
  content: ReactNode;
}

interface ApeTabsProps {
  tabs: ApeTab[];
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  sticky?: boolean;
}

export function ApeTabs({ 
  tabs, 
  defaultValue, 
  value, 
  onValueChange,
  className,
  sticky = true
}: ApeTabsProps) {
  return (
    <Tabs 
      defaultValue={defaultValue || tabs[0]?.value} 
      value={value}
      onValueChange={onValueChange}
      className={cn("w-full", className)}
    >
      <div className={cn(
        "bg-background border-b border-border",
        sticky && "sticky top-14 z-30"
      )}>
        <TabsList className="w-full h-12 bg-transparent rounded-none border-0 p-0 grid" style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}>
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none h-full"
            >
              <span className="text-sm font-medium">
                {tab.label}
                {typeof tab.count === "number" && (
                  <span className="ml-1 text-xs text-muted-foreground">({tab.count})</span>
                )}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      {tabs.map((tab) => (
        <TabsContent 
          key={tab.value} 
          value={tab.value}
          className="mt-0"
        >
          {tab.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}
