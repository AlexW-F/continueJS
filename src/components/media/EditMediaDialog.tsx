'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { MediaItem, MediaType, MediaStatus, EditMediaFormData } from '@/lib/types';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { toast } from 'sonner';

const editMediaSchema = z.object({
  mediaItemId: z.string(),
  name: z.string().min(1, 'Name is required'),
  mediaType: z.nativeEnum(MediaType),
  status: z.nativeEnum(MediaStatus),
  coverArtUrl: z.string().optional(),
  currentProgress: z.number().min(0).optional(),
  totalProgress: z.number().min(1).optional(),
  external: z.object({
    id: z.string().optional(),
    source: z.string().optional(),
    score: z.number().optional(),
    genres: z.array(z.string()).optional(),
    synopsis: z.string().optional(),
  }).optional(),
});

interface EditMediaDialogProps {
  media: MediaItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (media: EditMediaFormData) => void;
}

export function EditMediaDialog({ media, open, onOpenChange, onEdit }: EditMediaDialogProps) {
  const form = useForm<EditMediaFormData>({
    resolver: zodResolver(editMediaSchema),
  });

  useEffect(() => {
    if (media && open) {
      form.reset({
        mediaItemId: media.mediaItemId,
        name: media.name || '',
        mediaType: media.mediaType,
        status: media.status,
        coverArtUrl: media.coverArtUrl || '',
        currentProgress: media.progress?.current || 0,
        totalProgress: media.progress?.total || undefined,
        external: media.external,
      });
    }
  }, [media, open, form]);

  const handleSubmit = (data: EditMediaFormData) => {
    onEdit(data);
    onOpenChange(false);
    toast.success('Media updated successfully!');
  };

  if (!media) return null;

  const getProgressLabel = (mediaType: MediaType) => {
    switch (mediaType) {
      case MediaType.Book:
        return { current: 'Current Page', total: 'Total Pages' };
      case MediaType.Anime:
        return { current: 'Current Episode', total: 'Total Episodes' };
      case MediaType.Manga:
        return { current: 'Current Chapter', total: 'Total Chapters' };
      case MediaType.Show:
        return { current: 'Current Episode', total: 'Total Episodes' };
      default:
        return { current: 'Current Progress', total: 'Total Progress' };
    }
  };

  const progressLabels = getProgressLabel(form.watch('mediaType'));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Media</DialogTitle>
          <DialogDescription>
            Update the details and progress for your media item.
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter name..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="mediaType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Media Type</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={MediaType.Book}>Book</SelectItem>
                        <SelectItem value={MediaType.Anime}>Anime</SelectItem>
                        <SelectItem value={MediaType.Manga}>Manga</SelectItem>
                        <SelectItem value={MediaType.Show}>TV Show</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={MediaStatus.InProgress}>In Progress</SelectItem>
                        <SelectItem value={MediaStatus.Paused}>Paused</SelectItem>
                        <SelectItem value={MediaStatus.Archived}>Archived</SelectItem>
                        <SelectItem value={MediaStatus.Completed}>Completed</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="coverArtUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cover Art URL (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="https://..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="currentProgress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{progressLabels.current}</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min="0"
                        placeholder="0"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="totalProgress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{progressLabels.total}</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min="1"
                        placeholder="100"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || undefined)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {media.external?.synopsis && (
              <div className="bg-muted p-3 rounded-md">
                <h4 className="text-sm font-medium mb-2">Synopsis</h4>
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {media.external.synopsis}
                </p>
              </div>
            )}

            <div className="flex gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
                Cancel
              </Button>
              <Button type="submit" className="flex-1">
                Save Changes
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
