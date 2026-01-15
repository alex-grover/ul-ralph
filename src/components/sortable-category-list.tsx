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

interface CategoryWithItems extends Category {
  items: Item[];
}

interface SortableCategoryListProps {
  categories: CategoryWithItems[];
  listId: string;
  isOwner: boolean;
  onReorder: (categories: CategoryWithItems[]) => void;
  renderCategory: (category: CategoryWithItems, dragHandleProps: DragHandleProps) => React.ReactNode;
}

export interface DragHandleProps {
  attributes: DraggableAttributes;
  listeners: SyntheticListenerMap | undefined;
  isDragging: boolean;
}

export function SortableCategoryList({
  categories,
  listId,
  isOwner,
  onReorder,
  renderCategory,
}: SortableCategoryListProps) {
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

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = categories.findIndex((c) => c.id === active.id);
      const newIndex = categories.findIndex((c) => c.id === over.id);

      const newCategories = arrayMove(categories, oldIndex, newIndex);

      // Optimistically update the UI
      onReorder(newCategories);

      // Send the reorder request to the API
      try {
        const response = await fetch("/api/categories/reorder", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            listId,
            categoryIds: newCategories.map((c) => c.id),
          }),
        });

        if (!response.ok) {
          // Revert on failure
          onReorder(categories);
          console.error("Failed to reorder categories");
        }
      } catch (error) {
        // Revert on error
        onReorder(categories);
        console.error("Failed to reorder categories:", error);
      }
    }
  };

  // Empty attributes for non-draggable categories
  const emptyDragHandleProps: DragHandleProps = {
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

  if (!isOwner) {
    // Non-owners see a non-sortable list
    return (
      <div className="space-y-6">
        {categories.map((category) => (
          <div key={category.id}>
            {renderCategory(category, emptyDragHandleProps)}
          </div>
        ))}
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={categories.map((c) => c.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-6">
          {categories.map((category) => (
            <SortableCategoryItem
              key={category.id}
              category={category}
              renderCategory={renderCategory}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

interface SortableCategoryItemProps {
  category: CategoryWithItems;
  renderCategory: (category: CategoryWithItems, dragHandleProps: DragHandleProps) => React.ReactNode;
}

function SortableCategoryItem({ category, renderCategory }: SortableCategoryItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    position: "relative" as const,
  };

  return (
    <div ref={setNodeRef} style={style}>
      {renderCategory(category, {
        attributes,
        listeners,
        isDragging,
      })}
    </div>
  );
}
