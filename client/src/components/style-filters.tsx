import { useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Search, SlidersHorizontal, X, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StyleFiltersState {
  search: string;
  mood: string[];
  colorFamily: string[];
  sortBy: "newest" | "oldest" | "name";
}

interface StyleFiltersProps {
  filters: StyleFiltersState;
  onFiltersChange: (filters: StyleFiltersState) => void;
  className?: string;
}

const MOOD_OPTIONS = [
  "cheerful",
  "moody",
  "serene",
  "energetic",
  "nostalgic",
  "futuristic",
  "organic",
  "industrial",
  "playful",
  "sophisticated",
];

const COLOR_FAMILY_OPTIONS = [
  "warm",
  "cool",
  "neutral",
  "vibrant",
  "muted",
  "monochromatic",
  "pastel",
  "dark",
  "light",
  "earth tones",
];

const SORT_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "name", label: "Alphabetical" },
] as const;

export function StyleFilters({ filters, onFiltersChange, className }: StyleFiltersProps) {
  const [searchValue, setSearchValue] = useState(filters.search);

  const handleSearchChange = useCallback((value: string) => {
    setSearchValue(value);
  }, []);

  const handleSearchSubmit = useCallback(() => {
    onFiltersChange({ ...filters, search: searchValue });
  }, [filters, searchValue, onFiltersChange]);

  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearchSubmit();
    }
  }, [handleSearchSubmit]);

  const handleMoodToggle = useCallback((mood: string) => {
    const newMoods = filters.mood.includes(mood)
      ? filters.mood.filter((m) => m !== mood)
      : [...filters.mood, mood];
    onFiltersChange({ ...filters, mood: newMoods });
  }, [filters, onFiltersChange]);

  const handleColorFamilyToggle = useCallback((color: string) => {
    const newColors = filters.colorFamily.includes(color)
      ? filters.colorFamily.filter((c) => c !== color)
      : [...filters.colorFamily, color];
    onFiltersChange({ ...filters, colorFamily: newColors });
  }, [filters, onFiltersChange]);

  const handleSortChange = useCallback((value: string) => {
    onFiltersChange({ ...filters, sortBy: value as StyleFiltersState["sortBy"] });
  }, [filters, onFiltersChange]);

  const handleClearFilters = useCallback(() => {
    setSearchValue("");
    onFiltersChange({
      search: "",
      mood: [],
      colorFamily: [],
      sortBy: "newest",
    });
  }, [onFiltersChange]);

  const activeFilterCount = 
    (filters.search ? 1 : 0) + 
    filters.mood.length + 
    filters.colorFamily.length +
    (filters.sortBy !== "newest" ? 1 : 0);

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search styles..."
            value={searchValue}
            onChange={(e) => handleSearchChange(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            onBlur={handleSearchSubmit}
            className="pl-9 pr-4"
            data-testid="input-search-styles"
          />
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-2"
              data-testid="button-filter-mood"
            >
              <SlidersHorizontal className="w-4 h-4" />
              Mood
              {filters.mood.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                  {filters.mood.length}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-3" align="start">
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Filter by mood</p>
              <div className="flex flex-wrap gap-1.5">
                {MOOD_OPTIONS.map((mood) => (
                  <Badge
                    key={mood}
                    variant={filters.mood.includes(mood) ? "default" : "outline"}
                    className="cursor-pointer capitalize transition-colors"
                    onClick={() => handleMoodToggle(mood)}
                    data-testid={`filter-mood-${mood}`}
                  >
                    {mood}
                  </Badge>
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-2"
              data-testid="button-filter-color"
            >
              <SlidersHorizontal className="w-4 h-4" />
              Color
              {filters.colorFamily.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                  {filters.colorFamily.length}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-3" align="start">
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Filter by color family</p>
              <div className="flex flex-wrap gap-1.5">
                {COLOR_FAMILY_OPTIONS.map((color) => (
                  <Badge
                    key={color}
                    variant={filters.colorFamily.includes(color) ? "default" : "outline"}
                    className="cursor-pointer capitalize transition-colors"
                    onClick={() => handleColorFamilyToggle(color)}
                    data-testid={`filter-color-${color.replace(/\s+/g, "-")}`}
                  >
                    {color}
                  </Badge>
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <Select value={filters.sortBy} onValueChange={handleSortChange}>
          <SelectTrigger 
            className="w-[150px]" 
            data-testid="select-sort"
          >
            <ArrowUpDown className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((option) => (
              <SelectItem 
                key={option.value} 
                value={option.value}
                data-testid={`sort-option-${option.value}`}
              >
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {activeFilterCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearFilters}
            className="gap-1 text-muted-foreground hover:text-foreground"
            data-testid="button-clear-filters"
          >
            <X className="w-4 h-4" />
            Clear all
          </Button>
        )}
      </div>

      {(filters.mood.length > 0 || filters.colorFamily.length > 0 || filters.search) && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground mr-1">Active:</span>
          {filters.search && (
            <Badge variant="secondary" className="gap-1 pr-1">
              "{filters.search}"
              <button
                onClick={() => {
                  setSearchValue("");
                  onFiltersChange({ ...filters, search: "" });
                }}
                className="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5"
                data-testid="remove-filter-search"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          )}
          {filters.mood.map((mood) => (
            <Badge key={mood} variant="secondary" className="gap-1 pr-1 capitalize">
              {mood}
              <button
                onClick={() => handleMoodToggle(mood)}
                className="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5"
                data-testid={`remove-filter-mood-${mood}`}
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
          {filters.colorFamily.map((color) => (
            <Badge key={color} variant="secondary" className="gap-1 pr-1 capitalize">
              {color}
              <button
                onClick={() => handleColorFamilyToggle(color)}
                className="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5"
                data-testid={`remove-filter-color-${color.replace(/\s+/g, "-")}`}
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

export const DEFAULT_FILTERS: StyleFiltersState = {
  search: "",
  mood: [],
  colorFamily: [],
  sortBy: "newest",
};
