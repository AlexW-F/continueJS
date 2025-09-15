'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { MediaType, MediaStatus, AddMediaFormData, AnimeSearchResult, MangaSearchResult, ShowSearchResult, BookSearchResult } from '@/lib/types';
import { searchService } from '@/lib/api';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Search, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import Image from 'next/image';
import { v4 as uuidv4 } from 'uuid';

const addMediaSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  mediaType: z.nativeEnum(MediaType),
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

interface AddMediaDialogProps {
  onAdd: (media: AddMediaFormData) => void;
  children?: React.ReactNode;
}

type SearchResult = AnimeSearchResult | MangaSearchResult | ShowSearchResult | BookSearchResult;

export function AddMediaDialog({ onAdd, children }: AddMediaDialogProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'type' | 'search' | 'manual' | 'details'>('type');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);

  const form = useForm<AddMediaFormData>({
    resolver: zodResolver(addMediaSchema),
    defaultValues: {
      mediaType: MediaType.Book,
      currentProgress: 0,
    },
  });

  const mediaType = form.watch('mediaType');

  useEffect(() => {
    if (step === 'type') {
      form.reset({
        mediaType: MediaType.Book,
        currentProgress: 0,
      });
      setSearchQuery('');
      setSearchResults([]);
      setSelectedResult(null);
    }
  }, [step, form]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      let results: SearchResult[] = [];
      
      switch (mediaType) {
        case MediaType.Anime:
          results = await searchService.searchAnime(searchQuery);
          break;
        case MediaType.Manga:
          results = await searchService.searchManga(searchQuery);
          break;
        case MediaType.Show:
          results = await searchService.searchShows(searchQuery);
          break;
        case MediaType.Book:
          results = await searchService.searchBooks(searchQuery);
          break;
      }

      setSearchResults(results);
      if (results.length === 0) {
        toast.info('No results found. You can add the item manually.');
      }
    } catch (error) {
      console.error('Search failed:', error);
      toast.error('Search failed. You can add the item manually.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectResult = (result: SearchResult) => {
    setSelectedResult(result);
    
    // Pre-fill form based on search result
    if ('mal_id' in result) {
      // Anime/Manga result
      form.setValue('name', result.title || result.title_english || '');
      form.setValue('coverArtUrl', result.images?.jpg?.image_url);
      
      // Handle episodes for anime, chapters for manga
      if ('episodes' in result) {
        form.setValue('totalProgress', result.episodes);
      } else if ('chapters' in result) {
        form.setValue('totalProgress', result.chapters);
      }
      
      form.setValue('external', {
        id: result.mal_id.toString(),
        source: 'MyAnimeList',
        score: result.score,
        genres: result.genres?.map(g => g.name),
        synopsis: result.synopsis,
      });
    } else if ('id' in result && typeof result.id === 'number') {
      // TV Show result
      const show = result as ShowSearchResult;
      form.setValue('name', show.name);
      form.setValue('coverArtUrl', show.poster_path ? `https://image.tmdb.org/t/p/w500${show.poster_path}` : undefined);
      form.setValue('totalProgress', show.number_of_episodes);
      form.setValue('external', {
        id: show.id.toString(),
        source: 'TMDB',
        score: show.vote_average,
        synopsis: show.overview,
      });
    } else if ('volumeInfo' in result) {
      // Book result
      const book = result as BookSearchResult;
      form.setValue('name', book.volumeInfo.title);
      form.setValue('coverArtUrl', book.volumeInfo.imageLinks?.thumbnail);
      form.setValue('totalProgress', book.volumeInfo.pageCount);
      form.setValue('external', {
        id: book.id,
        source: 'Google Books',
        score: book.volumeInfo.averageRating,
        genres: book.volumeInfo.categories,
        synopsis: book.volumeInfo.description,
      });
    }

    setStep('details');
  };

  const handleSubmit = (data: AddMediaFormData) => {
    onAdd(data);
    setOpen(false);
    setStep('type');
    form.reset();
    toast.success('Media added successfully!');
  };

  const renderSearchResults = () => {
    return (
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {searchResults.map((result, index) => {
          let title = '';
          let imageUrl = '';
          let subtitle = '';

          if ('mal_id' in result) {
            title = result.title || result.title_english || '';
            imageUrl = result.images?.jpg?.small_image_url || result.images?.jpg?.image_url || '';
            subtitle = `${result.type || 'Unknown'} • ${result.status || 'Unknown'}`;
          } else if ('id' in result && typeof result.id === 'number') {
            const show = result as ShowSearchResult;
            title = show.name;
            imageUrl = show.poster_path ? `https://image.tmdb.org/t/p/w92${show.poster_path}` : '';
            subtitle = show.first_air_date ? `TV Show • ${new Date(show.first_air_date).getFullYear()}` : 'TV Show';
          } else if ('volumeInfo' in result) {
            const book = result as BookSearchResult;
            title = book.volumeInfo.title;
            imageUrl = book.volumeInfo.imageLinks?.smallThumbnail || '';
            subtitle = book.volumeInfo.authors?.join(', ') || 'Unknown Author';
          }

          return (
            <Card key={index} className="cursor-pointer hover:bg-muted/50" onClick={() => handleSelectResult(result)}>
              <CardContent className="flex items-center gap-3 p-3">
                <div className="w-12 h-16 bg-muted rounded flex-shrink-0 overflow-hidden">
                  {imageUrl ? (
                    <Image 
                      src={imageUrl} 
                      alt={title}
                      width={48}
                      height={64}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                      No Image
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-sm truncate">{title}</h4>
                  <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  };

  const renderStepContent = () => {
    switch (step) {
      case 'type':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="mediaType">Media Type</Label>
              <Select value={mediaType} onValueChange={(value) => form.setValue('mediaType', value as MediaType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={MediaType.Book}>Book</SelectItem>
                  <SelectItem value={MediaType.Anime}>Anime</SelectItem>
                  <SelectItem value={MediaType.Manga}>Manga</SelectItem>
                  <SelectItem value={MediaType.Show}>TV Show</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setStep('search')} className="flex-1">
                <Search className="w-4 h-4 mr-2" />
                Search Online
              </Button>
              <Button variant="outline" onClick={() => setStep('manual')} className="flex-1">
                Add Manually
              </Button>
            </div>
          </div>
        );

      case 'search':
        return (
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder={`Search for ${mediaType.toLowerCase()}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
              <Button onClick={handleSearch} disabled={isSearching || !searchQuery.trim()}>
                {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </Button>
            </div>
            
            {searchResults.length > 0 && renderSearchResults()}
            
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep('type')}>
                Back
              </Button>
              <Button variant="outline" onClick={() => setStep('manual')} className="flex-1">
                Add Manually Instead
              </Button>
            </div>
          </div>
        );

      case 'manual':
      case 'details':
        return (
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

              {step === 'manual' && (
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
              )}

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="currentProgress"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current Progress</FormLabel>
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
                      <FormLabel>Total Progress</FormLabel>
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

              <div className="flex gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setStep(step === 'details' ? 'search' : 'type')}
                >
                  Back
                </Button>
                <Button type="submit" className="flex-1">
                  Add Media
                </Button>
              </div>
            </form>
          </Form>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Add Media
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {step === 'type' && 'Add New Media'}
            {step === 'search' && `Search ${mediaType}`}
            {step === 'manual' && `Add ${mediaType} Manually`}
            {step === 'details' && `Add ${mediaType}`}
          </DialogTitle>
          <DialogDescription>
            {step === 'type' && 'Choose the type of media you want to add to your collection.'}
            {step === 'search' && `Search for ${mediaType} to add from external sources.`}
            {step === 'manual' && `Manually enter details for your ${mediaType}.`}
            {step === 'details' && `Review and confirm the details for your ${mediaType}.`}
          </DialogDescription>
        </DialogHeader>
        {renderStepContent()}
      </DialogContent>
    </Dialog>
  );
}
