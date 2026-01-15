"use client";

import * as React from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  DragOverlay,
  type DraggableAttributes,
} from "@dnd-kit/core";
import type { SyntheticListenerMap } from "@dnd-kit/core/dist/hooks/utilities";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Category, Item } from "@/db/schema";

export interface ItemDragHandleProps {
  attributes: DraggableAttributes;
  listeners: SyntheticListenerMap | undefined;
  isDragging: boolean;
}

interface SortableItemListProps {
  items: Item[];
  categoryId: string;
  isOwner: boolean;
  renderItem: (item: Item, dragHandleProps: ItemDragHandleProps) => React.ReactNode;
  renderOverlayItem?: (item: Item) => React.ReactNode;
}

// Empty attributes for non-draggable items
const emptyDragHandleProps: ItemDragHandleProps = {
  attributes: {
    role: "button",
    tabIndex: 0,
    "aria-disabled": true,
    "aria-pressed": undefined,
    "aria-roledescription": "sortable",
    "aria-describedby": "",
  },
  listeners: undefined,
  isDragging: false,
};

export function SortableItemList({
  items,
  categoryId,
  isOwner,
  renderItem,
}: SortableItemListProps) {
  if (!isOwner) {
    // Non-owners see a non-sortable list
    return (
      <>
        {items.map((item) => (
          <div key={item.id}>
            {renderItem(item, emptyDragHandleProps)}
          </div>
        ))}
      </>
    );
  }

  return (
    <SortableContext
      id={categoryId}
      items={items.map((i) => i.id)}
      strategy={verticalListSortingStrategy}
    >
      {items.map((item) => (
        <SortableItem
          key={item.id}
          item={item}
          renderItem={renderItem}
        />
      ))}
    </SortableContext>
  );
}

interface SortableItemProps {
  item: Item;
  renderItem: (item: Item, dragHandleProps: ItemDragHandleProps) => React.ReactNode;
}

function SortableItem({ item, renderItem }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    position: "relative" as const,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      {renderItem(item, {
        attributes,
        listeners,
        isDragging,
      })}
    </div>
  );
}

// Type for the reorder event when items are moved
export interface ItemReorderEvent {
  itemId: string;
  sourceCategoryId: string;
  targetCategoryId: string;
  oldIndex: number;
  newIndex: number;
}

// Context for coordinating item drag-drop across categories
interface ItemDndContextValue {
  activeId: string | null;
  activeItem: Item | null;
}

const ItemDndContext = React.createContext<ItemDndContextValue>({
  activeId: null,
  activeItem: null,
});

export function useItemDndContext() {
  return React.useContext(ItemDndContext);
}

interface CategoryWithItems extends Category {
  items: Item[];
}

interface ItemDndProviderProps {
  categories: CategoryWithItems[];
  listId: string;
  isOwner: boolean;
  onCategoriesChange: (categories: CategoryWithItems[]) => void;
  children: React.ReactNode;
  renderOverlayItem?: (item: Item) => React.ReactNode;
}

export function ItemDndProvider({
  categories,
  listId,
  isOwner,
  onCategoriesChange,
  children,
  renderOverlayItem,
}: ItemDndProviderProps) {
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [activeItem, setActiveItem] = React.useState<Item | null>(null);
  // Store the initial categories state when drag starts
  const initialCategoriesRef = React.useRef<CategoryWithItems[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Find which category contains an item
  const findCategoryByItemId = React.useCallback((itemId: string, cats: CategoryWithItems[]): CategoryWithItems | undefined => {
    return cats.find((cat) => cat.items.some((item) => item.id === itemId));
  }, []);

  // Check if the dragged ID is an item (not a category)
  const isItemId = React.useCallback((id: string): boolean => {
    return categories.some((cat) => cat.items.some((item) => item.id === id));
  }, [categories]);

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const id = active.id as string;

    // Only handle item drags, not category drags
    if (!isItemId(id)) {
      return;
    }

    setActiveId(id);
    // Store initial state for potential revert
    initialCategoriesRef.current = categories;

    // Find the active item
    for (const category of categories) {
      const item = category.items.find((i) => i.id === active.id);
      if (item) {
        setActiveItem(item);
        break;
      }
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over || !activeId) return;

    const draggedId = active.id as string;
    const overId = over.id as string;

    // Only handle if we're actively dragging an item
    if (!isItemId(draggedId)) {
      return;
    }

    // Find the source category (where the item currently is)
    const sourceCategory = findCategoryByItemId(draggedId, categories);
    if (!sourceCategory) return;

    // Find target - could be an item or a category (for empty categories or dropping at end)
    let targetCategory = findCategoryByItemId(overId, categories);

    // If not found as an item, check if overId is a category id
    if (!targetCategory) {
      targetCategory = categories.find((cat) => cat.id === overId);
    }

    if (!targetCategory || sourceCategory.id === targetCategory.id) {
      return;
    }

    // Move item between categories (optimistically)
    const sourceIndex = sourceCategory.items.findIndex((i) => i.id === draggedId);
    const item = sourceCategory.items[sourceIndex];

    if (!item) return;

    // Calculate the target index
    let targetIndex = targetCategory.items.length;
    if (overId !== targetCategory.id) {
      // If dragging over an item, insert at that position
      const overIndex = targetCategory.items.findIndex((i) => i.id === overId);
      if (overIndex >= 0) {
        targetIndex = overIndex;
      }
    }

    // Create new categories array with the moved item
    const newCategories = categories.map((cat) => {
      if (cat.id === sourceCategory.id) {
        return {
          ...cat,
          items: cat.items.filter((i) => i.id !== draggedId),
        };
      }
      if (cat.id === targetCategory.id) {
        const newItems = [...cat.items];
        newItems.splice(targetIndex, 0, { ...item, categoryId: targetCategory.id });
        return {
          ...cat,
          items: newItems,
        };
      }
      return cat;
    });

    onCategoriesChange(newCategories);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    // If we weren't dragging an item, do nothing
    if (!activeId) {
      return;
    }

    setActiveId(null);
    setActiveItem(null);

    if (!over) {
      // Drag was cancelled, revert to initial state
      onCategoriesChange(initialCategoriesRef.current);
      return;
    }

    const draggedId = active.id as string;
    const overId = over.id as string;

    // Find current category of the dragged item (in current state, after dragOver changes)
    const currentCategory = findCategoryByItemId(draggedId, categories);
    if (!currentCategory) {
      // Item not found, something went wrong - revert
      onCategoriesChange(initialCategoriesRef.current);
      return;
    }

    const currentIndex = currentCategory.items.findIndex((i) => i.id === draggedId);

    // Determine if we need to reorder within the same category
    let finalCategories = categories;
    if (draggedId !== overId) {
      const overIndex = currentCategory.items.findIndex((i) => i.id === overId);
      if (overIndex >= 0 && overIndex !== currentIndex) {
        // Reordering within the same category
        finalCategories = categories.map((cat) => {
          if (cat.id === currentCategory.id) {
            return {
              ...cat,
              items: arrayMove(cat.items, currentIndex, overIndex),
            };
          }
          return cat;
        });
        onCategoriesChange(finalCategories);
      }
    }

    // Collect all items with their new positions
    const itemsToReorder: { id: string; categoryId: string; position: number }[] = [];

    for (const category of finalCategories) {
      for (let i = 0; i < category.items.length; i++) {
        const item = category.items[i];
        itemsToReorder.push({
          id: item.id,
          categoryId: category.id,
          position: i,
        });
      }
    }

    if (itemsToReorder.length === 0) return;

    // Send the reorder request to the API
    try {
      const response = await fetch("/api/items/reorder", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          listId,
          items: itemsToReorder,
        }),
      });

      if (!response.ok) {
        console.error("Failed to reorder items");
        // Revert on failure
        onCategoriesChange(initialCategoriesRef.current);
      }
    } catch (error) {
      console.error("Failed to reorder items:", error);
      // Revert on error
      onCategoriesChange(initialCategoriesRef.current);
    }
  };

  const handleDragCancel = () => {
    if (activeId) {
      // Revert to initial state
      onCategoriesChange(initialCategoriesRef.current);
    }
    setActiveId(null);
    setActiveItem(null);
  };

  if (!isOwner) {
    return (
      <ItemDndContext.Provider value={{ activeId: null, activeItem: null }}>
        {children}
      </ItemDndContext.Provider>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <ItemDndContext.Provider value={{ activeId, activeItem }}>
        {children}
        <DragOverlay>
          {activeItem && renderOverlayItem ? renderOverlayItem(activeItem) : null}
        </DragOverlay>
      </ItemDndContext.Provider>
    </DndContext>
  );
}
