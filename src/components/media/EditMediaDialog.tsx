'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { MediaItem, MediaType, MediaStatus, EditMediaFormData, SeasonInfo } from '@/lib/types';
import { formatSeasonDisplay } from '@/lib/season-utils';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Calendar, ChevronLeft, ChevronRight, CheckCircle } from 'lucide-react';
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
    seasonInfo: z.object({
      currentSeason: z.number().optional(),
      totalSeasons: z.number().optional(),
      seasonName: z.string().optional(),
      episodesInSeason: z.number().optional(),
      seasonYear: z.number().optional(),
      seasonPeriod: z.string().optional(),
      seasonEpisodes: z.array(z.number()).optional(),
    }).optional(),
  }).optional(),
  seasonInfo: z.object({
    currentSeason: z.number().optional(),
    totalSeasons: z.number().optional(),
    seasonName: z.string().optional(),
    episodesInSeason: z.number().optional(),
    seasonYear: z.number().optional(),
    seasonPeriod: z.string().optional(),
    seasonEpisodes: z.array(z.number()).optional(),
  }).optional(),
});

interface EditMediaDialogProps {
  media: MediaItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (media: EditMediaFormData) => void;
}

export function EditMediaDialog({ media, open, onOpenChange, onEdit }: EditMediaDialogProps) {
  const [showSeasonCompleteMessage, setShowSeasonCompleteMessage] = useState(false);
  const [editingSeasons, setEditingSeasons] = useState(false);
  const [seasonCount, setSeasonCount] = useState(1);
  const [seasonEpisodes, setSeasonEpisodes] = useState<number[]>([12]);

  const form = useForm<EditMediaFormData>({
    resolver: zodResolver(editMediaSchema),
  });

  useEffect(() => {
    if (media && open) {
      // Initialize season editing state first
      let initialSeasonEpisodes: number[] = [];
      if (media.seasonInfo?.seasonEpisodes) {
        initialSeasonEpisodes = media.seasonInfo.seasonEpisodes;
        setSeasonCount(media.seasonInfo.seasonEpisodes.length);
        setSeasonEpisodes(media.seasonInfo.seasonEpisodes);
      } else if (media.seasonInfo?.totalSeasons && media.seasonInfo?.episodesInSeason) {
        initialSeasonEpisodes = Array(media.seasonInfo.totalSeasons).fill(media.seasonInfo.episodesInSeason);
        setSeasonCount(media.seasonInfo.totalSeasons);
        setSeasonEpisodes(initialSeasonEpisodes);
      }
      
      // For season-tracked items, convert absolute progress to relative (episode within season)
      let displayCurrentProgress = media.progress?.current || 0;
      let displayTotalProgress = media.progress?.total || undefined;
      
      if (media.seasonInfo?.seasonEpisodes && media.seasonInfo.currentSeason) {
        const currentSeason = media.seasonInfo.currentSeason;
        const absoluteProgress = media.progress?.current || 0;
        
        // Calculate episode within current season
        const episodesInPreviousSeasons = initialSeasonEpisodes
          .slice(0, currentSeason - 1)
          .reduce((sum, eps) => sum + eps, 0);
        
        displayCurrentProgress = absoluteProgress - episodesInPreviousSeasons;
        displayTotalProgress = initialSeasonEpisodes[currentSeason - 1];
      }
      
      form.reset({
        mediaItemId: media.mediaItemId,
        name: media.name || '',
        mediaType: media.mediaType,
        status: media.status,
        coverArtUrl: media.coverArtUrl || '',
        currentProgress: displayCurrentProgress,
        totalProgress: displayTotalProgress,
        external: media.external,
        seasonInfo: media.seasonInfo,
      });
      setShowSeasonCompleteMessage(false);
    }
  }, [media, open, form]);

  // Check if user has completed current season
  useEffect(() => {
    const currentProgress = form.watch('currentProgress');
    const seasonInfo = form.getValues('seasonInfo');
    
    if (seasonInfo?.episodesInSeason && currentProgress === seasonInfo.episodesInSeason) {
      const canAdvanceToNextSeason = !!(seasonInfo.currentSeason && seasonInfo.totalSeasons && 
                                         seasonInfo.currentSeason < seasonInfo.totalSeasons);
      setShowSeasonCompleteMessage(canAdvanceToNextSeason);
    } else {
      setShowSeasonCompleteMessage(false);
    }
  }, [form.watch('currentProgress')]);

  const handleSeasonChange = (direction: 'prev' | 'next') => {
    const seasonInfo = form.getValues('seasonInfo');
    if (!seasonInfo?.currentSeason) return;

    const newSeasonNumber = direction === 'next' 
      ? seasonInfo.currentSeason + 1 
      : seasonInfo.currentSeason - 1;

    // Validate season bounds
    if (newSeasonNumber < 1 || (seasonInfo.totalSeasons && newSeasonNumber > seasonInfo.totalSeasons)) {
      return;
    }

    // Get episodes in the new season
    let episodesInNewSeason = seasonInfo.episodesInSeason || 12;
    if (seasonInfo.seasonEpisodes && seasonInfo.seasonEpisodes[newSeasonNumber - 1]) {
      episodesInNewSeason = seasonInfo.seasonEpisodes[newSeasonNumber - 1];
    }

    // Update season info
    const updatedSeasonInfo = {
      ...seasonInfo,
      currentSeason: newSeasonNumber,
      seasonName: `Season ${newSeasonNumber}`,
      episodesInSeason: episodesInNewSeason,
    };

    form.setValue('seasonInfo', updatedSeasonInfo);
    
    // Reset to episode 1 of the new season
    form.setValue('currentProgress', 1);
    
    // Update total progress to the new season's episode count
    form.setValue('totalProgress', episodesInNewSeason);

    setShowSeasonCompleteMessage(false);
    toast.success(`Advanced to Season ${newSeasonNumber}`);
  };

  const advanceToNextSeason = () => {
    handleSeasonChange('next');
  };

  const handleSeasonEpisodesUpdate = (seasonIndex: number, episodes: number) => {
    const newSeasonEpisodes = [...seasonEpisodes];
    newSeasonEpisodes[seasonIndex] = episodes;
    setSeasonEpisodes(newSeasonEpisodes);
  };

  const handleSeasonCountChange = (newCount: number) => {
    setSeasonCount(newCount);
    
    // Adjust seasonEpisodes array
    if (newCount > seasonEpisodes.length) {
      // Add new seasons with default 12 episodes
      setSeasonEpisodes([...seasonEpisodes, ...Array(newCount - seasonEpisodes.length).fill(12)]);
    } else {
      // Remove extra seasons
      setSeasonEpisodes(seasonEpisodes.slice(0, newCount));
    }
  };

  const applySeasonEdits = () => {
    const currentSeason = form.getValues('seasonInfo.currentSeason') || 1;
    const currentProgress = form.getValues('currentProgress') || 0;
    
    // Update form with new season info
    form.setValue('seasonInfo', {
      ...form.getValues('seasonInfo'),
      totalSeasons: seasonCount,
      episodesInSeason: seasonEpisodes[currentSeason - 1],
      seasonEpisodes: seasonEpisodes,
    });
    
    // Update totalProgress to show episodes in current season (for display purposes)
    // The actual total will be calculated in handleSubmit
    form.setValue('totalProgress', seasonEpisodes[currentSeason - 1]);
    
    // Ensure currentProgress doesn't exceed episodes in current season
    if (currentProgress > seasonEpisodes[currentSeason - 1]) {
      form.setValue('currentProgress', seasonEpisodes[currentSeason - 1]);
    }
    
    setEditingSeasons(false);
    toast.success('Season information updated!');
  };

  const handleSubmit = (data: EditMediaFormData) => {
    // Recalculate absolute progress if season tracking is enabled
    if (data.seasonInfo?.seasonEpisodes) {
      const currentSeason = data.seasonInfo.currentSeason || 1;
      const currentProgress = data.currentProgress || 0;
      const seasonEps = data.seasonInfo.seasonEpisodes;
      
      const episodesInPreviousSeasons = seasonEps
        .slice(0, currentSeason - 1)
        .reduce((sum, eps) => sum + eps, 0);
      const totalEpisodes = seasonEps.reduce((sum, eps) => sum + eps, 0);
      
      data.currentProgress = episodesInPreviousSeasons + currentProgress;
      data.totalProgress = totalEpisodes;
    }
    
    onEdit(data);
    onOpenChange(false);
    toast.success('Media updated successfully!');
  };

  if (!media) return null;

  const getProgressLabel = (mediaType: MediaType, seasonInfo?: SeasonInfo) => {
    if ((mediaType === MediaType.Show || mediaType === MediaType.Anime) && seasonInfo?.currentSeason) {
      return { 
        current: `Episode in Season ${seasonInfo.currentSeason}`, 
        total: `Episodes in Season ${seasonInfo.currentSeason}` 
      };
    }

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

  const mediaType = form.watch('mediaType');
  const seasonInfo = form.getValues('seasonInfo');
  const progressLabels = getProgressLabel(mediaType, seasonInfo);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-y-auto">
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

            {/* Season Information Display with Navigation */}
            {(form.watch('mediaType') === MediaType.Show || form.watch('mediaType') === MediaType.Anime) && 
             form.getValues('seasonInfo') && form.getValues('seasonInfo.currentSeason') && (
              <div className="bg-muted/50 p-4 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-sm">
                    <Calendar className="w-4 h-4" />
                    <span className="font-medium">Season Information</span>
                  </div>
                  
                  {/* Season Navigation Controls */}
                  <div className="flex items-center space-x-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleSeasonChange('prev')}
                      disabled={!form.getValues('seasonInfo.currentSeason') || (form.getValues('seasonInfo.currentSeason') || 0) <= 1}
                      className="h-8 w-8 p-0"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    
                    <span className="text-sm font-medium min-w-[80px] text-center">
                      Season {form.getValues('seasonInfo.currentSeason')}
                    </span>
                    
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleSeasonChange('next')}
                      disabled={!form.getValues('seasonInfo.currentSeason') || 
                               !form.getValues('seasonInfo.totalSeasons') || 
                               (form.getValues('seasonInfo.currentSeason') || 0) >= (form.getValues('seasonInfo.totalSeasons') || 0)}
                      className="h-8 w-8 p-0"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                
                <div className="space-y-1 text-sm text-muted-foreground">
                  <div>{formatSeasonDisplay(form.getValues('seasonInfo')!)}</div>
                  {form.getValues('seasonInfo.episodesInSeason') && (
                    <div>Episodes in season: {form.getValues('seasonInfo.episodesInSeason')}</div>
                  )}
                </div>
                
                {/* Edit Season Info Button */}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingSeasons(true)}
                  className="w-full"
                >
                  Edit Season Information
                </Button>
                
                {/* Season Complete Message */}
                {showSeasonCompleteMessage && (
                  <div className="bg-green-50 border border-green-200 rounded-md p-3">
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span className="text-sm font-medium text-green-800">Season Complete!</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-sm text-green-700">
                        You've finished Season {form.getValues('seasonInfo.currentSeason')}. Ready for the next one?
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        onClick={advanceToNextSeason}
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        Next Season
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Season Editing Dialog */}
            {editingSeasons && (
              <div className="bg-muted p-4 rounded-lg space-y-3 border-2 border-primary">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium">Edit Season Information</h3>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingSeasons(false)}
                  >
                    Cancel
                  </Button>
                </div>
                
                {/* Season Count */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Number of Seasons</label>
                  <Input
                    type="number"
                    min="1"
                    max="20"
                    value={seasonCount}
                    onChange={(e) => handleSeasonCountChange(parseInt(e.target.value) || 1)}
                  />
                </div>
                
                {/* Episodes per Season */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Episodes per Season</label>
                  <div className="grid grid-cols-4 gap-2 max-h-40 overflow-y-auto p-1 border rounded">
                    {Array.from({ length: seasonCount }, (_, i) => (
                      <div key={i} className="space-y-1">
                        <label className="text-xs text-muted-foreground">S{i + 1}</label>
                        <Input
                          type="number"
                          min="1"
                          max="100"
                          value={seasonEpisodes[i] || 12}
                          onChange={(e) => handleSeasonEpisodesUpdate(i, parseInt(e.target.value) || 12)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
                
                <Button
                  type="button"
                  onClick={applySeasonEdits}
                  className="w-full"
                >
                  Apply Changes
                </Button>
              </div>
            )}

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
                        max={seasonInfo?.episodesInSeason 
                          ? seasonInfo.episodesInSeason 
                          : form.getValues('totalProgress') || undefined}
                        placeholder="0"
                        {...field}
                        value={field.value ?? ''}
                        onChange={(e) => {
                          const value = e.target.value === '' ? 0 : parseInt(e.target.value);
                          if (!isNaN(value)) {
                            const maxValue = seasonInfo?.episodesInSeason 
                              ? seasonInfo.episodesInSeason 
                              : form.getValues('totalProgress') || Number.MAX_SAFE_INTEGER;
                            field.onChange(Math.min(Math.max(value, 0), maxValue));
                          }
                        }}
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
                        value={field.value ?? ''}
                        onChange={(e) => {
                          const value = e.target.value === '' ? undefined : parseInt(e.target.value);
                          if (value === undefined || !isNaN(value)) {
                            field.onChange(value);
                            // Update current progress if it exceeds new total
                            const currentProgress = form.getValues('currentProgress') || 0;
                            if (value && currentProgress > value) {
                              form.setValue('currentProgress', value);
                            }
                          }
                        }}
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
