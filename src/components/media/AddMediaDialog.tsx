'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { MediaType, MediaStatus, AddMediaFormData, AnimeSearchResult, MangaSearchResult, ShowSearchResult, ShowDetailsResult, BookSearchResult, SeasonInfo } from '@/lib/types';
import { searchService, mediaService } from '@/lib/api';
import { 
  extractSeasonFromAnimeTitle, 
  createSeasonInfoFromAnime, 
  createSeasonInfoFromShow, 
  getSeasonOptions 
} from '@/lib/season-utils';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Search, Loader2, Calendar, Hash } from 'lucide-react';
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
    seasonInfo: z.object({
      currentSeason: z.number().optional(),
      totalSeasons: z.number().optional(),
      seasonName: z.string().optional(),
      episodesInSeason: z.number().optional(),
      seasonYear: z.number().optional(),
      seasonPeriod: z.string().optional(),
    }).optional(),
  }).optional(),
  seasonInfo: z.object({
    currentSeason: z.number().optional(),
    totalSeasons: z.number().optional(),
    seasonName: z.string().optional(),
    episodesInSeason: z.number().optional(),
    seasonYear: z.number().optional(),
    seasonPeriod: z.string().optional(),
  }).optional(),
});

interface AddMediaDialogProps {
  onAdd: (media: AddMediaFormData) => void;
  children?: React.ReactNode;
}

type SearchResult = AnimeSearchResult | MangaSearchResult | ShowSearchResult | BookSearchResult;

export function AddMediaDialog({ onAdd, children }: AddMediaDialogProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'type' | 'search' | 'manual' | 'season' | 'details'>('type');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);
  const [showDetails, setShowDetails] = useState<ShowDetailsResult | null>(null);
  const [isLoadingShowDetails, setIsLoadingShowDetails] = useState(false);

  const form = useForm<AddMediaFormData>({
    resolver: zodResolver(addMediaSchema),
    defaultValues: {
      name: '',
      mediaType: MediaType.Book,
      coverArtUrl: '',
      currentProgress: 0,
      totalProgress: undefined,
      external: undefined,
      seasonInfo: undefined,
    },
  });

  const mediaType = form.watch('mediaType');

  useEffect(() => {
    if (step === 'type') {
      form.reset({
        name: '',
        mediaType: MediaType.Book,
        coverArtUrl: '',
        currentProgress: 0,
        totalProgress: undefined,
        external: undefined,
        seasonInfo: undefined,
      });
      setSearchQuery('');
      setSearchResults([]);
      setSelectedResult(null);
      setShowDetails(null);
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

  const handleSelectResult = async (result: SearchResult) => {
    setSelectedResult(result);
    
    // Pre-fill form based on search result
    if ('mal_id' in result) {
      // Anime/Manga result
      const animeResult = result as AnimeSearchResult;
      const { cleanTitle } = extractSeasonFromAnimeTitle(animeResult.title);
      
      form.setValue('name', cleanTitle);
      form.setValue('coverArtUrl', animeResult.images?.jpg?.image_url);
      
      // Handle episodes for anime, chapters for manga
      if ('episodes' in animeResult) {
        form.setValue('totalProgress', animeResult.episodes);
      } else if ('chapters' in result) {
        form.setValue('totalProgress', (result as MangaSearchResult).chapters);
      }
      
      // Create season info for anime
      if (animeResult.episodes !== undefined) {
        const seasonInfo = createSeasonInfoFromAnime(animeResult);
        form.setValue('seasonInfo', seasonInfo);
        form.setValue('external', {
          id: animeResult.mal_id.toString(),
          source: 'MyAnimeList',
          score: animeResult.score,
          genres: animeResult.genres?.map(g => g.name),
          synopsis: animeResult.synopsis,
          seasonInfo,
        });
      } else {
        form.setValue('external', {
          id: animeResult.mal_id.toString(),
          source: 'MyAnimeList',
          score: animeResult.score,
          genres: animeResult.genres?.map(g => g.name),
          synopsis: animeResult.synopsis,
        });
      }
      
      // For anime with seasons, go to season selection, otherwise to details
      if ((animeResult.episodes !== undefined) && (animeResult.title.includes('Season') || animeResult.title.includes('Part'))) {
        setStep('season');
      } else {
        setStep('details');
      }
    } else if ('id' in result && typeof result.id === 'number') {
      // TV Show result - fetch detailed info
      const show = result as ShowSearchResult;
      setIsLoadingShowDetails(true);
      
      try {
        const details = await mediaService.getShowDetails(show.id.toString());
        setShowDetails(details);
        
        form.setValue('name', show.name);
        form.setValue('coverArtUrl', show.poster_path ? `https://image.tmdb.org/t/p/w500${show.poster_path}` : undefined);
        form.setValue('totalProgress', details.number_of_episodes);
        form.setValue('external', {
          id: show.id.toString(),
          source: 'TMDB',
          score: show.vote_average,
          synopsis: show.overview,
        });
        
        // If multiple seasons, go to season selection
        if (details.number_of_seasons > 1) {
          setStep('season');
        } else {
          // Single season, create season info and go to details
          const seasonInfo = createSeasonInfoFromShow(details, 1);
          form.setValue('seasonInfo', seasonInfo);
          form.setValue('totalProgress', seasonInfo.episodesInSeason);
          setStep('details');
        }
      } catch (error) {
        console.error('Failed to fetch show details:', error);
        toast.error('Failed to load show details. Please try again.');
        // Fall back to basic info
        form.setValue('name', show.name);
        form.setValue('coverArtUrl', show.poster_path ? `https://image.tmdb.org/t/p/w500${show.poster_path}` : undefined);
        form.setValue('totalProgress', show.number_of_episodes);
        form.setValue('external', {
          id: show.id.toString(),
          source: 'TMDB',
          score: show.vote_average,
          synopsis: show.overview,
        });
        setStep('details');
      } finally {
        setIsLoadingShowDetails(false);
      }
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
      setStep('details');
    }
  };

  const handleSubmit = (data: AddMediaFormData) => {
    onAdd(data);
    setOpen(false);
    setStep('type');
    form.reset({
      name: '',
      mediaType: MediaType.Book,
      coverArtUrl: '',
      currentProgress: 0,
      totalProgress: undefined,
      external: undefined,
      seasonInfo: undefined,
    });
    toast.success('Media added successfully!');
  };

  const handleSeasonSelect = (seasonNumber: number) => {
    if (showDetails) {
      // For TV shows
      const seasonInfo = createSeasonInfoFromShow(showDetails, seasonNumber);
      form.setValue('seasonInfo', seasonInfo);
      
      // Set total progress to the current season's episode count (not entire show)
      form.setValue('totalProgress', seasonInfo.episodesInSeason);
      
      // Set initial current progress to episode 1 of the selected season (in season terms)
      form.setValue('currentProgress', 1); // Episode 1 of the selected season
      
      // Update external metadata with season info
      const currentExternal = form.getValues('external');
      form.setValue('external', {
        ...currentExternal,
        seasonInfo,
      });
    } else if (selectedResult && 'mal_id' in selectedResult) {
      // For anime - update season info
      const currentSeasonInfo = form.getValues('seasonInfo');
      const updatedSeasonInfo = {
        ...currentSeasonInfo,
        currentSeason: seasonNumber,
        seasonName: `Season ${seasonNumber}`,
      };
      form.setValue('seasonInfo', updatedSeasonInfo);
      
      // Set initial progress to episode 1 of the selected season
      form.setValue('currentProgress', 1);
      
      // For anime, keep the single season episode count as total
      // This assumes user is tracking just this season of the anime
      const currentExternal = form.getValues('external');
      form.setValue('external', {
        ...currentExternal,
        seasonInfo: updatedSeasonInfo,
      });
    }
    
    setStep('details');
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

      case 'season':
        return (
          <div className="space-y-4">
            <div className="text-center">
              <h3 className="text-lg font-semibold">{form.getValues('name')}</h3>
              <p className="text-sm text-muted-foreground">Which season are you currently on?</p>
              <p className="text-xs text-muted-foreground mt-1">
                All previous episodes will be marked as watched
              </p>
            </div>
            
            {isLoadingShowDetails ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="w-6 h-6 animate-spin" />
                <span className="ml-2">Loading season information...</span>
              </div>
            ) : showDetails ? (
              // TV Show seasons
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {getSeasonOptions(showDetails).map((season) => (
                  <Card key={season.value} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSeasonSelect(season.value)}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium">{season.label}</h4>
                          <p className="text-sm text-muted-foreground">{season.episodes} episodes</p>
                        </div>
                        <div className="flex items-center text-muted-foreground">
                          <Hash className="w-4 h-4 mr-1" />
                          <span>{season.value}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : selectedResult && 'mal_id' in selectedResult ? (
              // Anime season input
              <div className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  This appears to be part of a series. Which season are you currently on?
                  <br />
                  <span className="text-xs">All previous episodes will be considered watched.</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {[1, 2, 3, 4, 5].map((seasonNum) => (
                    <Button
                      key={seasonNum}
                      variant="outline"
                      onClick={() => handleSeasonSelect(seasonNum)}
                      className="h-16 flex flex-col items-center justify-center"
                    >
                      <Hash className="w-4 h-4 mb-1" />
                      Season {seasonNum}
                    </Button>
                  ))}
                </div>
                <div className="flex items-center space-x-2">
                  <Input
                    type="number"
                    min="1"
                    placeholder="Other season number..."
                    className="flex-1"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const value = parseInt((e.target as HTMLInputElement).value);
                        if (value && value > 0) {
                          handleSeasonSelect(value);
                        }
                      }
                    }}
                  />
                  <Button
                    variant="outline"
                    onClick={(e) => {
                      const input = (e.target as HTMLElement).previousElementSibling as HTMLInputElement;
                      const value = parseInt(input.value);
                      if (value && value > 0) {
                        handleSeasonSelect(value);
                      }
                    }}
                  >
                    Select
                  </Button>
                </div>
              </div>
            ) : null}
            
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep('search')}>
                Back
              </Button>
              <Button variant="outline" onClick={() => setStep('details')} className="flex-1">
                Skip Season Selection
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
                      <Input placeholder="Enter name..." value={field.value ?? ''} onChange={field.onChange} />
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
                        <Input placeholder="https://..." value={field.value ?? ''} onChange={field.onChange} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Season Information Display */}
              {(mediaType === MediaType.Show || mediaType === MediaType.Anime) && form.getValues('seasonInfo') && (
                <div className="bg-muted/50 p-3 rounded-lg">
                  <div className="flex items-center space-x-2 text-sm">
                    <Calendar className="w-4 h-4" />
                    <span className="font-medium">Season Information</span>
                  </div>
                  <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                    {form.getValues('seasonInfo.seasonName') && (
                      <div>Season: {form.getValues('seasonInfo.seasonName')}</div>
                    )}
                    {form.getValues('seasonInfo.episodesInSeason') && (
                      <div>Episodes: {form.getValues('seasonInfo.episodesInSeason')}</div>
                    )}
                    {form.getValues('seasonInfo.seasonYear') && (
                      <div>Year: {form.getValues('seasonInfo.seasonYear')}</div>
                    )}
                    {form.getValues('seasonInfo.seasonPeriod') && (
                      <div>Period: {form.getValues('seasonInfo.seasonPeriod')}</div>
                    )}
                  </div>
                  {(showDetails?.number_of_seasons || 0) > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={() => setStep('season')}
                    >
                      Change Season
                    </Button>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="currentProgress"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {(mediaType === MediaType.Show || mediaType === MediaType.Anime) && form.getValues('seasonInfo') 
                          ? `Episode in ${form.getValues('seasonInfo')?.seasonName || 'Season'}` 
                          : 'Current Progress'
                        }
                      </FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min="1"
                          max={(mediaType === MediaType.Show || mediaType === MediaType.Anime) && form.getValues('seasonInfo') 
                            ? form.getValues('seasonInfo')?.episodesInSeason 
                            : form.getValues('totalProgress') || undefined}
                          placeholder="1"
                          value={field.value ?? ''}
                          onChange={(e) => {
                            const value = parseInt(e.target.value) || 1;
                            const seasonInfo = form.getValues('seasonInfo');
                            const maxValue = (mediaType === MediaType.Show || mediaType === MediaType.Anime) && seasonInfo 
                              ? seasonInfo.episodesInSeason || 12
                              : form.getValues('totalProgress') || Number.MAX_SAFE_INTEGER;
                            field.onChange(Math.min(Math.max(value, 1), maxValue));
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
                      <FormLabel>
                        {(mediaType === MediaType.Show || mediaType === MediaType.Anime) && form.getValues('seasonInfo') 
                          ? `Episodes in ${form.getValues('seasonInfo')?.seasonName || 'Season'}` 
                          : 'Total Progress'
                        }
                      </FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min="1"
                          placeholder={form.getValues('seasonInfo')?.episodesInSeason?.toString() || "100"}
                          value={field.value ?? ''}
                          onChange={(e) => {
                            const value = parseInt(e.target.value) || undefined;
                            field.onChange(value);
                            // Update current progress if it exceeds new total
                            const currentProgress = form.getValues('currentProgress') || 0;
                            if (value && currentProgress > value) {
                              form.setValue('currentProgress', value);
                            }
                          }}
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
