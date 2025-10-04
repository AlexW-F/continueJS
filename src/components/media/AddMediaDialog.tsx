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
  
  // Anime season tracking state
  const [useSeasonTracking, setUseSeasonTracking] = useState(false);
  const [seasonCount, setSeasonCount] = useState(1);
  const [seasonEpisodes, setSeasonEpisodes] = useState<number[]>([12]);
  const [currentSeason, setCurrentSeason] = useState(1);
  const [currentEpisodeInSeason, setCurrentEpisodeInSeason] = useState(0);

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
      
      // Store external info but don't auto-fill progress - let user choose
      if (animeResult.episodes !== undefined || 'chapters' in result) {
        form.setValue('external', {
          id: animeResult.mal_id.toString(),
          source: 'MyAnimeList',
          score: animeResult.score,
          genres: animeResult.genres?.map(g => g.name),
          synopsis: animeResult.synopsis,
        });
      }
      
      // For anime/manga from search, go directly to details (which now includes manual tracking options)
      setStep('details');
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
    // Process anime season tracking if enabled (for both manual and automatic/details)
    if (mediaType === MediaType.Anime && (step === 'manual' || step === 'details') && useSeasonTracking) {
      const totalEpisodes = seasonEpisodes.reduce((sum, eps) => sum + eps, 0);
      const episodesWatchedInPreviousSeasons = seasonEpisodes
        .slice(0, currentSeason - 1)
        .reduce((sum, eps) => sum + eps, 0);
      const totalEpisodesWatched = episodesWatchedInPreviousSeasons + currentEpisodeInSeason;
      
      // Store absolute progress across all seasons
      data.currentProgress = totalEpisodesWatched;
      data.totalProgress = totalEpisodes;
      data.seasonInfo = {
        currentSeason,
        totalSeasons: seasonCount,
        seasonName: `Season ${currentSeason}`,
        episodesInSeason: seasonEpisodes[currentSeason - 1],
        seasonEpisodes: seasonEpisodes, // Store full episode breakdown
      };
    }
    
    // Process TV show season tracking (uses API data)
    if (mediaType === MediaType.Show && data.seasonInfo?.seasonEpisodes) {
      const seasonEps = data.seasonInfo.seasonEpisodes;
      const currentSeason = data.seasonInfo.currentSeason || 1;
      const currentProgress = data.currentProgress || 0;
      
      // Calculate total episodes and absolute progress
      const totalEpisodes = seasonEps.reduce((sum, eps) => sum + eps, 0);
      const episodesInPreviousSeasons = seasonEps
        .slice(0, currentSeason - 1)
        .reduce((sum, eps) => sum + eps, 0);
      const absoluteProgress = episodesInPreviousSeasons + currentProgress;
      
      data.currentProgress = absoluteProgress;
      data.totalProgress = totalEpisodes;
    }
    
    onAdd(data);
    setOpen(false);
    setStep('type');
    
    // Reset all state
    form.reset({
      name: '',
      mediaType: MediaType.Book,
      coverArtUrl: '',
      currentProgress: 0,
      totalProgress: undefined,
      external: undefined,
      seasonInfo: undefined,
    });
    setUseSeasonTracking(false);
    setSeasonCount(1);
    setSeasonEpisodes([12]);
    setCurrentSeason(1);
    setCurrentEpisodeInSeason(0);
    
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
          <div className="space-y-6">
            <div>
              <Label className="mb-3 block">Media Type</Label>
              <div className="relative bg-muted rounded-lg p-1">
                {/* Animated background indicator */}
                <div
                  className="absolute top-1 bottom-1 rounded-md bg-primary transition-all duration-300 ease-in-out"
                  style={{
                    width: 'calc(25% - 4px)',
                    left: `calc(${
                      mediaType === MediaType.Book ? '0.25rem' :
                      mediaType === MediaType.Anime ? 'calc(25% + 0.25rem)' :
                      mediaType === MediaType.Manga ? 'calc(50% + 0.25rem)' :
                      'calc(75% + 0.25rem)'
                    })`,
                  }}
                />
                {/* Media type buttons */}
                <div className="relative grid grid-cols-4 gap-1">
                  {[
                    { value: MediaType.Book, label: 'Book' },
                    { value: MediaType.Anime, label: 'Anime' },
                    { value: MediaType.Manga, label: 'Manga' },
                    { value: MediaType.Show, label: 'TV Show' },
                  ].map((type) => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => {
                        form.setValue('mediaType', type.value);
                      }}
                      className={`relative z-10 px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${
                        mediaType === type.value
                          ? 'text-primary-foreground'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>
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
            {/* Database reliability warning for anime/manga */}
            {(mediaType === MediaType.Anime || mediaType === MediaType.Manga) && (
              <div className="p-3 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900 rounded-lg">
                <div className="flex items-start gap-2">
                  <div className="flex-shrink-0 mt-0.5">
                    <svg className="w-5 h-5 text-orange-600 dark:text-orange-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-sm text-orange-800 dark:text-orange-300">
                      Database Info May Be Inaccurate
                    </h4>
                    <p className="text-xs text-orange-700 dark:text-orange-400 mt-1">
                      {mediaType === MediaType.Anime 
                        ? 'Anime databases often have wrong episode counts and season info. Search is mainly useful for grabbing cover art—you\'ll set episode counts manually.'
                        : 'Manga databases often have incomplete chapter info. Search is mainly useful for grabbing cover art—you\'ll set chapter counts manually.'
                      }
                    </p>
                  </div>
                </div>
              </div>
            )}
            
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

              {/* Flexible Anime Season Tracking - show for both manual and automatic (details) */}
              {(step === 'manual' || step === 'details') && mediaType === MediaType.Anime && (
                <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                  {step === 'details' && selectedResult && (
                    <div className="mb-3 p-2 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded text-xs text-blue-700 dark:text-blue-400">
                      <strong>Cover art loaded.</strong> Now set your episode counts below—database info is often wrong.
                    </div>
                  )}
                  <div>
                    <h3 className="font-medium text-sm mb-3">
                      Anime Tracking Options
                    </h3>
                    
                    {/* Toggle for season tracking */}
                    <div className="flex items-center space-x-2 mb-4">
                      <input
                        type="checkbox"
                        id="use-season-tracking"
                        checked={useSeasonTracking}
                        onChange={(e) => {
                          setUseSeasonTracking(e.target.checked);
                          if (!e.target.checked) {
                            // Reset season-related state
                            form.setValue('seasonInfo', undefined);
                          }
                        }}
                        className="w-4 h-4 rounded border-gray-300"
                      />
                      <Label htmlFor="use-season-tracking" className="text-sm cursor-pointer">
                        Track by seasons (for multi-season anime)
                      </Label>
                    </div>

                    {useSeasonTracking ? (
                      <div className="space-y-4">
                        {/* Number of seasons */}
                        <div>
                          <Label htmlFor="season-count" className="text-sm">Number of Seasons</Label>
                          <Input
                            id="season-count"
                            type="number"
                            min="1"
                            max="20"
                            value={seasonCount}
                            onChange={(e) => {
                              const val = e.target.value === '' ? 1 : parseInt(e.target.value);
                              if (!isNaN(val)) {
                                const count = Math.max(1, Math.min(20, val));
                                setSeasonCount(count);
                                // Adjust seasonEpisodes array
                                const newEpisodes = [...seasonEpisodes];
                                while (newEpisodes.length < count) {
                                  newEpisodes.push(12);
                                }
                                setSeasonEpisodes(newEpisodes.slice(0, count));
                                // Adjust current season if needed
                                if (currentSeason > count) {
                                  setCurrentSeason(count);
                                }
                              }
                            }}
                            className="mt-1"
                          />
                        </div>

                        {/* Episodes per season */}
                        <div>
                          <Label className="text-sm mb-2 block">Episodes per Season</Label>
                          <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                            {Array.from({ length: seasonCount }, (_, i) => (
                              <div key={i} className="flex items-center gap-2">
                                <Label className="text-xs whitespace-nowrap min-w-16">Season {i + 1}:</Label>
                                <Input
                                  type="number"
                                  min="1"
                                  max="999"
                                  value={seasonEpisodes[i] || 12}
                                  onChange={(e) => {
                                    const val = e.target.value === '' ? 1 : parseInt(e.target.value);
                                    if (!isNaN(val)) {
                                      const newEpisodes = [...seasonEpisodes];
                                      newEpisodes[i] = Math.max(1, val);
                                      setSeasonEpisodes(newEpisodes);
                                    }
                                  }}
                                  className="h-8 text-sm"
                                />
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Current season selector */}
                        <div>
                          <Label htmlFor="current-season" className="text-sm">Current Season Watching</Label>
                          <Select
                            value={currentSeason.toString()}
                            onValueChange={(value) => {
                              setCurrentSeason(parseInt(value));
                              setCurrentEpisodeInSeason(0);
                            }}
                          >
                            <SelectTrigger className="mt-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Array.from({ length: seasonCount }, (_, i) => (
                                <SelectItem key={i + 1} value={(i + 1).toString()}>
                                  Season {i + 1} ({seasonEpisodes[i] || 12} episodes)
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Current episode in season */}
                        <div>
                          <Label htmlFor="current-episode-season" className="text-sm">
                            Current Episode in Season {currentSeason}
                          </Label>
                          <Input
                            id="current-episode-season"
                            type="number"
                            min="0"
                            max={seasonEpisodes[currentSeason - 1] || 12}
                            value={currentEpisodeInSeason}
                            onChange={(e) => {
                              const val = e.target.value === '' ? 0 : parseInt(e.target.value);
                              if (!isNaN(val)) {
                                const max = seasonEpisodes[currentSeason - 1] || 12;
                                setCurrentEpisodeInSeason(Math.max(0, Math.min(max, val)));
                              }
                            }}
                            className="mt-1"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Total across all seasons: {seasonEpisodes.slice(0, currentSeason - 1).reduce((sum, eps) => sum + eps, 0) + currentEpisodeInSeason} episodes
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <p className="text-xs text-muted-foreground">
                          Simple episode tracking without seasons. Use this for single-season anime or if you prefer not to track by seasons.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Manga tracking note - show for both manual and automatic (details) */}
              {(step === 'manual' || step === 'details') && mediaType === MediaType.Manga && (
                <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg">
                  {step === 'details' && selectedResult ? (
                    <p className="text-xs text-blue-700 dark:text-blue-400">
                      <strong>Cover art loaded.</strong> Now enter your current chapter and total chapters below.
                    </p>
                  ) : (
                    <p className="text-xs text-blue-700 dark:text-blue-400">
                      <strong>Tip:</strong> Enter current chapter and total chapters. Leave total blank if ongoing.
                    </p>
                  )}
                </div>
              )}

              {/* Only show these fields if NOT using season tracking for anime */}
              {!((step === 'manual' || step === 'details') && mediaType === MediaType.Anime && useSeasonTracking) && (
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
                          min="0"
                          max={(mediaType === MediaType.Show || mediaType === MediaType.Anime) && form.getValues('seasonInfo') 
                            ? form.getValues('seasonInfo')?.episodesInSeason 
                            : form.getValues('totalProgress') || undefined}
                          placeholder="0"
                          {...field}
                          value={field.value ?? ''}
                          onChange={(e) => {
                            const value = e.target.value === '' ? 0 : parseInt(e.target.value);
                            if (!isNaN(value)) {
                              const seasonInfo = form.getValues('seasonInfo');
                              const maxValue = (mediaType === MediaType.Show || mediaType === MediaType.Anime) && seasonInfo 
                                ? seasonInfo.episodesInSeason || 12
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
              )}

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
      <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === 'type' && 'Add New Media'}
            {step === 'search' && `Search ${mediaType}`}
            {step === 'manual' && `Add ${mediaType} Manually`}
            {step === 'details' && `Add ${mediaType}`}
            {step === 'season' && 'Select Season'}
          </DialogTitle>
          <DialogDescription>
            {step === 'type' && 'Choose the type of media you want to add to your collection.'}
            {step === 'search' && `Search for ${mediaType} to add from external sources.`}
            {step === 'manual' && `Manually enter details for your ${mediaType}.`}
            {step === 'details' && `Review and confirm the details for your ${mediaType}.`}
            {step === 'season' && 'Select which season you want to track.'}
          </DialogDescription>
        </DialogHeader>
        {renderStepContent()}
      </DialogContent>
    </Dialog>
  );
}
