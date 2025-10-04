'use client';

import { MediaItem, MediaStatus, KanbanColumn } from '@/lib/types';
import { MediaCard } from './MediaCard';
import { useMemo } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface KanbanBoardProps {
  media: MediaItem[];
  onUpdateStatus: (mediaId: string, newStatus: MediaStatus) => void;
  onEdit: (media: MediaItem) => void;
  onDelete: (id: string) => void;
}

interface SortableMediaCardProps {
  media: MediaItem;
  onEdit: (media: MediaItem) => void;
  onDelete: (id: string) => void;
  onMarkCompleted?: (media: MediaItem) => void;
}

function SortableMediaCard({ media, onEdit, onDelete, onMarkCompleted }: SortableMediaCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: media.mediaItemId || '' });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <MediaCard 
        media={media} 
        onEdit={onEdit} 
        onDelete={onDelete}
        onMarkCompleted={onMarkCompleted}
        className="cursor-grab active:cursor-grabbing"
      />
    </div>
  );
}

interface KanbanColumnProps {
  column: KanbanColumn;
  onEdit: (media: MediaItem) => void;
  onDelete: (id: string) => void;
  onMarkCompleted?: (media: MediaItem) => void;
}

function KanbanColumnComponent({ column, onEdit, onDelete, onMarkCompleted }: KanbanColumnProps) {
  const {
    setNodeRef,
    isOver,
  } = useSortable({ 
    id: column.id,
    data: {
      type: 'column',
      column,
    },
  });

  return (
    <div ref={setNodeRef} className="flex-1 min-w-80">
      <Card className={`h-full ${isOver ? 'ring-2 ring-blue-500' : ''}`}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold" style={{ color: column.color }}>
              {column.title}
            </CardTitle>
            <span className="text-sm text-muted-foreground bg-muted px-2 py-1 rounded-full">
              {column.items.length}
            </span>
          </div>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          {column.items.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">No items in {column.title.toLowerCase()}</p>
              <p className="text-xs mt-1">
                {column.id === MediaStatus.InProgress && "Start tracking your media progress!"}
                {column.id === MediaStatus.Paused && "Paused items will appear here"}
              </p>
            </div>
          ) : (
            <SortableContext items={column.items.map(item => item.mediaItemId || '')} strategy={verticalListSortingStrategy}>
              {column.items.map(media => (
                <SortableMediaCard
                  key={media.mediaItemId || 'no-id'}
                  media={media}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onMarkCompleted={onMarkCompleted}
                />
              ))}
            </SortableContext>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function KanbanBoard({ media, onUpdateStatus, onEdit, onDelete }: KanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  
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

  const handleMarkCompleted = (media: MediaItem) => {
    if (media.mediaItemId) {
      onUpdateStatus(media.mediaItemId, MediaStatus.Completed);
    }
  };

  const columns: KanbanColumn[] = useMemo(() => {
    const groupedMedia = media.reduce((acc, item) => {
      if (!acc[item.status]) {
        acc[item.status] = [];
      }
      acc[item.status].push(item);
      return acc;
    }, {} as Record<MediaStatus, MediaItem[]>);

    return [
      {
        id: MediaStatus.InProgress,
        title: 'In Progress',
        items: groupedMedia[MediaStatus.InProgress] || [],
        color: '#3b82f6', // blue-500
      },
      {
        id: MediaStatus.Paused,
        title: 'Paused',
        items: groupedMedia[MediaStatus.Paused] || [],
        color: '#eab308', // yellow-500
      },
    ];
  }, [media]);

  const activeMedia = useMemo(() => {
    if (!activeId) return null;
    return media.find(item => item.mediaItemId === activeId) || null;
  }, [activeId, media]);

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Find the active media item
    const activeMedia = media.find(item => item.mediaItemId === activeId);
    if (!activeMedia) return;

    // Check if we're dropping on a different column
    const overColumn = columns.find(col => col.id === overId);
    if (overColumn && activeMedia.status !== overColumn.id) {
      onUpdateStatus(activeId, overColumn.id);
      return;
    }

    // Check if we're dropping on another media item
    const overMedia = media.find(item => item.mediaItemId === overId);
    if (overMedia && activeMedia.status !== overMedia.status) {
      onUpdateStatus(activeId, overMedia.status);
      return;
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-6 overflow-x-auto pb-6">
        <SortableContext items={columns.map(col => col.id)} strategy={verticalListSortingStrategy}>
          {columns.map(column => (
            <KanbanColumnComponent
              key={column.id}
              column={column}
              onEdit={onEdit}
              onDelete={onDelete}
              onMarkCompleted={handleMarkCompleted}
            />
          ))}
        </SortableContext>
      </div>

      <DragOverlay>
        {activeMedia ? (
          <MediaCard
            media={activeMedia}
            onEdit={onEdit}
            onDelete={onDelete}
            onMarkCompleted={handleMarkCompleted}
            className="rotate-3 shadow-xl"
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
