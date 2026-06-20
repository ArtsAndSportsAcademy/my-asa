import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface MemberComboboxProps {
  value: string;
  onChange: (value: string) => void;
  users: { id: string; name: string }[];
  placeholder?: string;
  className?: string;
}

export function MemberCombobox({
  value,
  onChange,
  users,
  placeholder = "Selecionar membro",
  className,
}: MemberComboboxProps) {
  const [open, setOpen] = useState(false);
  const selected = users.find((u) => u.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between font-normal h-9 text-sm", className)}
        >
          {selected ? (
            selected.name
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0" style={{ width: "var(--radix-popover-trigger-width)" }} align="start">
        <Command>
          <CommandInput placeholder="Buscar por nome..." className="h-9" />
          <CommandList>
            <CommandEmpty>Nenhum membro encontrado.</CommandEmpty>
            <CommandGroup className="max-h-48 overflow-auto">
              {users.map((u) => (
                <CommandItem
                  key={u.id}
                  value={u.name}
                  onSelect={() => {
                    onChange(u.id);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-3.5 w-3.5", value === u.id ? "opacity-100" : "opacity-0")} />
                  {u.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
