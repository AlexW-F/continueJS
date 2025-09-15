# Continue - Next.js Migration

A modern media progress tracker built with Next.js, TypeScript, and Firebase. Track your progress across books, anime, manga, and TV shows with a beautiful Kanban-style interface.

## ✨ Features

- **Multi-Media Support**: Track books, anime, manga, and TV shows
- **Kanban Interface**: Drag-and-drop cards between status columns (In Progress, Paused, Archived, Completed)
- **External API Integration**: 
  - Jikan API for anime/manga search
  - TMDB API for TV shows
  - Google Books API for books
- **Firebase Authentication**: Secure Google OAuth login
- **Real-time Sync**: Data stored in Firebase Firestore
- **Responsive Design**: Mobile-first design with desktop optimizations
- **Progress Tracking**: Visual progress bars with percentage calculations
- **Search & Discovery**: Find and add media from external APIs
- **Modern UI**: Built with shadcn/ui components and Tailwind CSS

## 🚀 Tech Stack

- **Framework**: Next.js 14+ with App Router
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS + shadcn/ui
- **Authentication**: Firebase Auth
- **Database**: Firebase Firestore
- **State Management**: TanStack Query (React Query)
- **Drag & Drop**: @dnd-kit
- **Forms**: React Hook Form + Zod validation
- **Deployment**: Vercel

## 🛠️ Setup Instructions

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Firebase project with Authentication and Firestore enabled

### Environment Variables

Create a `.env.local` file in the root directory:

```bash
# Firebase Client Config
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=your_measurement_id

# External API Keys
NEXT_PUBLIC_TMDB_API_KEY=your_tmdb_api_key
NEXT_PUBLIC_GOOGLE_BOOKS_API_KEY=your_google_books_api_key

# Backend API URL
NEXT_PUBLIC_API_BASE_URL=https://your-backend-api.com/
```

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

### Build for Production

```bash
npm run build
npm run start
```

## 📱 Usage

1. **Sign In**: Use Google OAuth to authenticate
2. **Add Media**: Click "Add Media" and search for items or add manually
3. **Track Progress**: Update progress by editing media items
4. **Organize**: Drag cards between columns to change status
5. **View Completed**: Check the "Completed" page for finished items
6. **Manage Account**: Access settings for account management

## 🎨 UI Components

The application uses a consistent design system with:

- **Status Colors**: 
  - In Progress (Blue) - with animated striped progress bars
  - Paused (Yellow)
  - Archived (Gray)
  - Completed (Green)
- **Responsive Layout**: Mobile-first with touch-friendly interactions
- **Dark/Light Mode**: Supports system preference
- **Smooth Animations**: Drag & drop with visual feedback

## 📊 Data Model

```typescript
interface MediaItem {
  mediaItemId: string;
  name?: string;
  mediaType: MediaType; // Book, Anime, Manga, Show
  status: MediaStatus; // InProgress, Paused, Archived, Completed
  dateAdded: Date;
  datePaused?: Date;
  coverArtUrl?: string;
  progress?: ProgressData;
  additionalProgress?: Record<string, ProgressData>;
  external?: ExternalMetadata;
}
```

## 🔒 Security

- Firebase Authentication handles user sessions
- Firestore security rules ensure users can only access their own data
- API keys are properly scoped and environment-specific
- Client-side validation with server-side enforcement

## 🚀 Deployment

### Vercel (Recommended)

1. Connect your GitHub repository to Vercel
2. Add environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

### Firebase Hosting

1. Install Firebase CLI: `npm install -g firebase-tools`
2. Login: `firebase login`
3. Initialize: `firebase init hosting`
4. Build: `npm run build`
5. Deploy: `firebase deploy`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

- [Next.js](https://nextjs.org/) for the framework
- [Firebase](https://firebase.google.com/) for authentication and database
- [shadcn/ui](https://ui.shadcn.com/) for the component library
- [Jikan API](https://jikan.moe/) for anime/manga data
- [TMDB](https://www.themoviedb.org/) for TV show data
- [Google Books API](https://developers.google.com/books) for book data
