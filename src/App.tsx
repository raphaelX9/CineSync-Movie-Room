import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import ReactPlayer from 'react-player';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Play, Pause, Users, Film, ArrowRight, ArrowLeft, Plus, LogIn, 
  Share2, Check, MessageSquare, Send, RefreshCw, Menu as MenuIcon, 
  Heart, X, Lock, Sparkles, LogOut, Settings, Info
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { MOVIES, type Movie } from './movies';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const Player = ReactPlayer as any;

export default function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [roomId, setRoomId] = useState<string>('');
  const [inRoom, setInRoom] = useState(false);
  const [roomState, setRoomState] = useState<any>(null);
  const [userCount, setUserCount] = useState(0);
  const [playerKey, setPlayerKey] = useState(0);
  const [currentSwipeIndex, setCurrentSwipeIndex] = useState(0);
  const [matchedMovie, setMatchedMovie] = useState<Movie | null>(null);
  const [pin, setPin] = useState('');
  const [enteredPin, setEnteredPin] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isPinVerified, setIsPinVerified] = useState(false);
  const [showDescription, setShowDescription] = useState(false);

  const getSourceUrl = (id: string) => `https://vidsrc.me/embed/movie?tmdb=${id}`;
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Movie[]>([]);
  const [trendingMovies, setTrendingMovies] = useState<Movie[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<{ user: string, text: string }[]>([]);
  const playerRef = useRef<any>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const newSocket = io();
    setSocket(newSocket);

    newSocket.on('room-state', (state) => {
      setRoomState(state);
      if (state.currentMovie) {
        setIsPlaying(state.isPlaying);
        setCurrentTime(state.currentTime);
      }
    });

    newSocket.on('user-count', (count) => {
      setUserCount(count);
    });

    newSocket.on('movie-selected', (movie) => {
      setRoomState((prev: any) => ({ ...prev, currentMovie: movie, selectionPhase: false, swipingPhase: false }));
      setIsPlaying(false);
      setCurrentTime(0);
      setMatchedMovie(null);
    });

    newSocket.on('movie-matched', (movie) => {
      setMatchedMovie(movie);
      setTimeout(() => {
        setRoomState((prev: any) => ({ ...prev, currentMovie: movie, selectionPhase: false, swipingPhase: false }));
        setMatchedMovie(null);
      }, 4000);
    });

    newSocket.on('swipe-update', ({ userId, movieId, liked }) => {
      setRoomState((prev: any) => {
        if (!prev) return prev;
        const newUserSwipes = { ...prev.userSwipes };
        if (!newUserSwipes[userId]) newUserSwipes[userId] = {};
        newUserSwipes[userId][movieId] = liked;
        return { ...prev, userSwipes: newUserSwipes };
      });
    });

    newSocket.on('player-sync', ({ isPlaying, currentTime }) => {
      setIsPlaying(isPlaying);
      if (currentTime !== undefined && Math.abs((playerRef.current?.getCurrentTime() || 0) - currentTime) > 1) {
        playerRef.current?.seekTo(currentTime, 'seconds');
      }
    });

    newSocket.on('seek-sync', (time) => {
      playerRef.current?.seekTo(time, 'seconds');
      setCurrentTime(time);
    });

    newSocket.on('receive-message', (msg) => {
      setMessages((prev) => [...prev, msg]);
    });

    return () => {
      newSocket.close();
    };
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const createRoom = () => {
    const id = Math.random().toString(36).substring(2, 8).toUpperCase();
    joinRoom(id);
    if (pin) {
      socket?.emit('set-pin', { roomId: id, pin });
    }
    setIsPinVerified(true);
  };

  const joinRoom = (id: string) => {
    if (!id || !socket) return;
    socket.emit('join-room', id);
    setRoomId(id);
    setInRoom(true);
  };

  const startSwiping = () => {
    if (!socket || !roomId) return;
    socket.emit('start-swiping', { roomId, movies: trendingMovies.slice(0, 15) });
    setIsMenuOpen(false);
    setCurrentSwipeIndex(0);
  };

  const handleSwipe = (liked: boolean) => {
    if (!socket || !roomId || !roomState.swipingMovies[currentSwipeIndex]) return;
    const movieId = roomState.swipingMovies[currentSwipeIndex].id;
    socket.emit('swipe-movie', { roomId, movieId, liked });
    setCurrentSwipeIndex(prev => prev + 1);
    setShowDescription(false);
  };

  const selectMovie = (movie: Movie) => {
    if (!socket || !roomId) return;
    socket.emit('select-movie', { roomId, movie });
  };

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !socket || !roomId) return;
    socket.emit('send-message', { roomId, message });
    setMessage('');
  };

  const searchMovies = async (query: string) => {
    if (!query) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const apiKey = (import.meta as any).env.VITE_TMDB_API_KEY || 'bb3142ece0a9125c89d3cf9d13ac9c32';
      const response = await fetch(
        `https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&query=${encodeURIComponent(query)}`
      );
      const data = await response.json();
      
      if (data.status_code === 7) {
        throw new Error('Invalid API Key');
      }

      if (!data.results) {
        setSearchResults([]);
        return;
      }
      const movies: Movie[] = data.results.map((m: any) => ({
        id: m.id.toString(),
        title: m.title,
        description: m.overview,
        thumbnail: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : 'https://via.placeholder.com/500x750?text=No+Poster',
        videoUrl: `https://vidsrc.to/embed/movie/${m.id}`,
        year: m.release_date?.split('-')[0] || 'N/A',
        genre: 'Movie'
      }));
      setSearchResults(movies);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const fetchTrending = async () => {
    try {
      const apiKey = (import.meta as any).env.VITE_TMDB_API_KEY || 'bb3142ece0a9125c89d3cf9d13ac9c32';
      const response = await fetch(
        `https://api.themoviedb.org/3/trending/movie/week?api_key=${apiKey}`
      );
      const data = await response.json();

      if (data.status_code === 7) {
        throw new Error('Invalid API Key');
      }

      if (!data.results) {
        setTrendingMovies([]);
        return;
      }
      const movies: Movie[] = data.results.map((m: any) => ({
        id: m.id.toString(),
        title: m.title,
        description: m.overview,
        thumbnail: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : 'https://via.placeholder.com/500x750?text=No+Poster',
        videoUrl: `https://vidsrc.to/embed/movie/${m.id}`,
        year: m.release_date?.split('-')[0] || 'N/A',
        genre: 'Movie'
      }));
      setTrendingMovies(movies);
    } catch (error) {
      console.error('Trending error:', error);
    }
  };

  useEffect(() => {
    fetchTrending();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery) searchMovies(searchQuery);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  if (!inRoom) {
    return (
      <div className="min-h-screen bg-[#050505] text-white font-sans flex flex-col items-center justify-center p-6 relative overflow-hidden">
        {/* Background Gradients */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/10 blur-[120px] rounded-full" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-500/5 blur-[120px] rounded-full" />
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md space-y-12"
        >
          <div className="text-center space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs font-bold uppercase tracking-widest mb-4">
              <Sparkles className="w-3 h-3" />
              Next-Gen Watch Party
            </div>
            <h1 className="text-6xl font-black tracking-tighter italic">
              FLIX<span className="text-emerald-500">SYNC</span>
            </h1>
            <p className="text-zinc-500 text-lg font-medium">Watch together, wherever you are.</p>
          </div>

          <div className="space-y-6">
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Enter Room Code"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                className="w-full bg-zinc-900/50 border border-zinc-800 rounded-2xl px-6 py-4 text-center text-xl font-bold tracking-widest focus:outline-none focus:border-emerald-500/50 transition-all placeholder:text-zinc-700"
              />
              <input
                type="password"
                placeholder="Room PIN (Optional)"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className="w-full bg-zinc-900/50 border border-zinc-800 rounded-2xl px-6 py-4 text-center text-lg font-medium focus:outline-none focus:border-emerald-500/50 transition-all placeholder:text-zinc-700"
              />
              <button
                onClick={() => joinRoom(roomId)}
                className="w-full bg-white text-black h-16 rounded-2xl font-black text-lg hover:bg-emerald-500 hover:text-white transition-all transform hover:scale-[1.02] active:scale-[0.98]"
              >
                JOIN ROOM
              </button>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-zinc-800"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase tracking-widest font-bold">
                <span className="bg-[#050505] px-4 text-zinc-600">or</span>
              </div>
            </div>

            <button
              onClick={createRoom}
              className="w-full bg-zinc-900 border border-zinc-800 text-white h-16 rounded-2xl font-black text-lg hover:bg-zinc-800 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
            >
              CREATE NEW ROOM
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (!roomState) {
    return (
      <div className="min-h-screen bg-[#050505] text-white font-sans flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-zinc-500 animate-pulse">Connecting to room...</p>
        </div>
      </div>
    );
  }

  // PIN Check
  if (roomState.pin && !isPinVerified && roomState.users.length > 0 && !roomState.users.includes(socket?.id)) {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md space-y-6 text-center">
          <Lock className="w-12 h-12 mx-auto text-emerald-500" />
          <h2 className="text-3xl font-bold">Room is Locked</h2>
          <p className="text-zinc-500">Please enter the room PIN to join your friends.</p>
          <input
            type="password"
            placeholder="Enter PIN"
            value={enteredPin}
            onChange={(e) => setEnteredPin(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-6 py-4 text-center text-xl font-bold focus:outline-none focus:border-emerald-500 transition-all"
          />
          <button
            onClick={() => {
              if (enteredPin === roomState.pin) {
                setIsPinVerified(true);
              } else {
                alert('Incorrect PIN');
              }
            }}
            className="w-full bg-emerald-500 text-black h-14 rounded-2xl font-bold"
          >
            Unlock Room
          </button>
        </div>
      </div>
    );
  }

  if (roomState.swipingPhase) {
    const currentMovie = roomState.swipingMovies[currentSwipeIndex];
    
    if (!currentMovie) {
      return (
        <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-6">
          <div className="text-center space-y-6">
            <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto">
              <Sparkles className="w-10 h-10 text-emerald-500" />
            </div>
            <h2 className="text-3xl font-bold">All Swiped!</h2>
            <p className="text-zinc-500 max-w-xs mx-auto">Waiting for your friends to finish swiping. We'll start as soon as there's a match!</p>
            <div className="flex justify-center gap-2">
              {roomState.users.map((uid: string) => (
                <div 
                  key={uid} 
                  className={`w-3 h-3 rounded-full ${roomState.userSwipes[uid] && Object.keys(roomState.userSwipes[uid]).length >= roomState.swipingMovies.length ? 'bg-emerald-500' : 'bg-zinc-800'}`} 
                />
              ))}
            </div>
            <button 
              onClick={() => socket?.emit('reset-room', roomId)}
              className="text-zinc-500 hover:text-white text-sm font-bold uppercase tracking-widest"
            >
              Cancel Swiping
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="h-screen bg-[#050505] text-white flex flex-col items-center p-6 overflow-hidden">
        <div className="flex items-center gap-2 py-4">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">Slide Mode Active</span>
        </div>

        <div className="w-full max-w-md flex-1 flex flex-col min-h-0 gap-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentMovie.id}
              initial={{ scale: 0.9, opacity: 0, x: 50 }}
              animate={{ scale: 1, opacity: 1, x: 0 }}
              exit={{ scale: 0.9, opacity: 0, x: -50 }}
              className="flex-1 flex flex-col min-h-0 gap-4"
            >
              <div 
                onClick={() => setShowDescription(!showDescription)}
                className={cn(
                  "relative rounded-[2.5rem] overflow-hidden border border-zinc-800 shadow-2xl cursor-pointer group transition-all duration-500",
                  showDescription ? "h-[40vh]" : "flex-1"
                )}
              >
                <img 
                  src={currentMovie.thumbnail} 
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                {!showDescription && (
                  <div className="absolute bottom-0 left-0 right-0 p-8">
                    <h2 className="text-3xl font-black italic tracking-tighter">{currentMovie.title}</h2>
                    <p className="text-zinc-400 text-xs mt-1">Tap for details</p>
                  </div>
                )}
              </div>

              {showDescription && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex-1 overflow-y-auto custom-scrollbar px-2 space-y-4"
                >
                  <div className="space-y-1">
                    <h2 className="text-3xl font-black italic tracking-tighter">{currentMovie.title}</h2>
                    <div className="flex gap-2">
                      <span className="px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-[10px] font-bold uppercase tracking-wider">{currentMovie.year}</span>
                      <span className="px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-[10px] font-bold uppercase tracking-wider">{currentMovie.genre}</span>
                    </div>
                  </div>
                  <p className="text-zinc-400 text-sm leading-relaxed">{currentMovie.description}</p>
                </motion.div>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="flex justify-center gap-6 py-4">
            <button 
              onClick={() => handleSwipe(false)}
              className="w-16 h-16 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 hover:bg-red-500 hover:text-white hover:border-red-500 transition-all transform hover:scale-110 active:scale-95"
            >
              <X className="w-6 h-6" />
            </button>
            <button 
              onClick={() => handleSwipe(true)}
              className="w-16 h-16 rounded-full bg-emerald-500 flex items-center justify-center text-black hover:bg-emerald-400 transition-all transform hover:scale-110 active:scale-95 shadow-[0_0_30px_rgba(16,185,129,0.3)]"
            >
              <Heart className="w-6 h-6 fill-current" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (matchedMovie) {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-6">
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center space-y-8"
        >
          <div className="relative inline-block">
            <div className="absolute inset-0 bg-emerald-500 blur-[60px] opacity-50 animate-pulse" />
            <Sparkles className="w-20 h-20 text-emerald-500 relative z-10 mx-auto" />
          </div>
          <div className="space-y-2">
            <h1 className="text-6xl font-black italic tracking-tighter uppercase">It's a Match!</h1>
            <p className="text-zinc-500 text-xl">Everyone wants to watch</p>
          </div>
          <div className="w-64 aspect-[2/3] mx-auto rounded-3xl overflow-hidden border-4 border-emerald-500 shadow-2xl">
            <img src={matchedMovie.thumbnail} className="w-full h-full object-cover" />
          </div>
          <h2 className="text-3xl font-bold">{matchedMovie.title}</h2>
        </motion.div>
      </div>
    );
  }

  if (roomState.selectionPhase) {
    const displayMovies = searchQuery ? searchResults : trendingMovies;

    return (
      <div className="min-h-screen bg-[#050505] text-white font-sans flex flex-col">
        {/* Navigation / Menu */}
        <header className="p-6 md:p-8 flex justify-between items-center bg-black/40 backdrop-blur-md sticky top-0 z-50 border-b border-zinc-800/50">
          <div className="flex items-center gap-8">
            <h1 className="text-3xl font-black tracking-tighter italic">
              FLIX<span className="text-emerald-500">SYNC</span>
            </h1>
            <div className="hidden md:flex items-center gap-6 text-xs font-bold uppercase tracking-widest text-zinc-500">
              <span className="text-emerald-500">Discover</span>
              <span className="hover:text-white cursor-pointer transition-colors">Movies</span>
              <span className="hover:text-white cursor-pointer transition-colors">Series</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-zinc-900/50 rounded-xl border border-zinc-800">
              <Users className="w-4 h-4 text-emerald-500" />
              <span className="text-sm font-bold">{userCount} Online</span>
            </div>
            <div className="relative">
              <button 
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="p-3 bg-zinc-900 hover:bg-zinc-800 rounded-xl border border-zinc-800 transition-all"
              >
                <MenuIcon className="w-5 h-5" />
              </button>
              
              <AnimatePresence>
                {isMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    className="absolute right-0 mt-2 w-64 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-2 z-50"
                  >
                    <div className="p-3 border-b border-zinc-800 mb-2">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Room Controls</p>
                      <p className="text-sm font-bold mt-1">Room: {roomId}</p>
                    </div>
                    <button 
                      onClick={startSwiping}
                      className="w-full flex items-center gap-3 p-3 hover:bg-emerald-500 hover:text-black rounded-xl transition-all text-left group"
                    >
                      <Sparkles className="w-5 h-5" />
                      <div>
                        <p className="text-sm font-bold">Slide Mode</p>
                        <p className="text-[10px] opacity-70">Swipe to find a match</p>
                      </div>
                    </button>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(window.location.href);
                        setIsMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-3 p-3 hover:bg-zinc-800 rounded-xl transition-all text-left"
                    >
                      <Share2 className="w-5 h-5" />
                      <p className="text-sm font-bold">Invite Friends</p>
                    </button>
                    <button 
                      onClick={() => window.location.reload()}
                      className="w-full flex items-center gap-3 p-3 hover:bg-red-500/10 hover:text-red-500 rounded-xl transition-all text-left"
                    >
                      <LogOut className="w-5 h-5" />
                      <p className="text-sm font-bold">Leave Room</p>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto p-6 md:p-12 w-full">
          <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-2">
              <h2 className="text-5xl font-black italic tracking-tighter">
                {searchQuery ? `RESULTS FOR "${searchQuery.toUpperCase()}"` : 'TRENDING NOW'}
              </h2>
              <p className="text-zinc-500 font-medium">Pick a movie or start Slide Mode to find a match together.</p>
            </div>
            
            <div className="flex-1 max-w-md w-full relative">
              <input 
                type="text"
                placeholder="Search movies..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-6 py-4 focus:outline-none focus:border-emerald-500 transition-all pl-14"
              />
              <Film className="absolute left-5 top-1/2 -translate-y-1/2 w-6 h-6 text-zinc-600" />
              {isSearching && (
                <div className="absolute right-5 top-1/2 -translate-y-1/2">
                  <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-8">
            {displayMovies.map((movie) => (
              <motion.div 
                key={movie.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ y: -10 }}
                className="group relative cursor-pointer"
                onClick={() => selectMovie(movie)}
              >
                <div className="aspect-[2/3] rounded-3xl overflow-hidden border border-zinc-800 transition-all group-hover:border-emerald-500 shadow-2xl">
                  <img 
                    src={movie.thumbnail} 
                    alt={movie.title}
                    className="w-full h-full object-cover grayscale-[0.5] group-hover:grayscale-0 transition-all duration-500"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-6">
                    <button className="w-full bg-emerald-500 text-black font-black py-4 rounded-2xl flex items-center justify-center gap-2 transform translate-y-4 group-hover:translate-y-0 transition-transform shadow-[0_0_30px_rgba(16,185,129,0.4)]">
                      <Play className="w-5 h-5 fill-black" />
                      WATCH
                    </button>
                  </div>
                </div>
                <div className="mt-4 space-y-1">
                  <h3 className="font-black text-lg line-clamp-1 group-hover:text-emerald-500 transition-colors italic tracking-tight">{movie.title.toUpperCase()}</h3>
                  <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                    <span>{movie.year}</span>
                    <span className="w-1 h-1 rounded-full bg-zinc-800" />
                    <span>{movie.genre}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {displayMovies.length === 0 && !isSearching && (
            <div className="text-center py-32 bg-zinc-900/10 rounded-[3rem] border border-dashed border-zinc-800">
              <Film className="w-20 h-20 mx-auto mb-6 opacity-10" />
              <p className="text-zinc-500 text-xl font-medium max-w-xs mx-auto">
                No movies found. Try a different search.
              </p>
            </div>
          )}
        </main>
      </div>
    );
  }

  if (!roomState.currentMovie) {
    return (
      <div className="min-h-screen bg-[#050505] text-white font-sans flex items-center justify-center">
        <div className="text-center space-y-4">
          <Film className="w-12 h-12 mx-auto text-zinc-800" />
          <p className="text-zinc-500">No movie selected. Returning to selection...</p>
          <button 
            onClick={() => socket?.emit('reset-room', roomId)}
            className="text-emerald-500 hover:underline"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      <header className="p-4 md:p-6 border-b border-zinc-800 flex justify-between items-center bg-black/40 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => socket?.emit('reset-room', roomId)}
            className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <Film className="w-5 h-5 text-emerald-500" />
            <h1 className="font-bold text-lg line-clamp-1">{roomState.currentMovie.title}</h1>
            <button 
              onClick={() => setPlayerKey(prev => prev + 1)}
              className="p-1.5 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-400 hover:text-white"
              title="Refresh Player"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden md:flex bg-zinc-900 px-4 py-2 rounded-full items-center gap-2 text-sm border border-zinc-800">
            <Users className="w-4 h-4 text-emerald-500" />
            <span>{userCount} watching together</span>
          </div>
          <button 
            onClick={() => {
              navigator.clipboard.writeText(window.location.href);
              alert('Invite link copied!');
            }}
            className="bg-emerald-500 text-black px-4 py-2 rounded-xl font-bold text-sm hover:bg-emerald-400 transition-all"
          >
            Invite Friends
          </button>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        <div className="flex-1 flex flex-col bg-black">
          <div className="flex-1 flex items-center justify-center relative group">
            <iframe
              key={`${roomState.currentMovie.id}-${playerKey}`}
              src={getSourceUrl(roomState.currentMovie.id)}
              className="w-full h-full border-0"
              allowFullScreen
              referrerPolicy="origin"
            />
          </div>

          {/* Movie Info Section Below Player */}
          <div className="p-6 md:p-8 bg-zinc-900/30 border-t border-zinc-800">
            <div className="max-w-4xl flex flex-col md:flex-row gap-8">
              <img 
                src={roomState.currentMovie.thumbnail} 
                alt={roomState.currentMovie.title}
                className="w-32 md:w-48 aspect-[2/3] object-cover rounded-xl shadow-2xl border border-zinc-800"
                referrerPolicy="no-referrer"
              />
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <h2 className="text-3xl font-bold">{roomState.currentMovie.title}</h2>
                  <span className="px-3 py-1 bg-zinc-800 rounded-full text-xs font-bold text-zinc-400">
                    {roomState.currentMovie.year}
                  </span>
                </div>
                <p className="text-zinc-400 leading-relaxed text-lg">
                  {roomState.currentMovie.description}
                </p>
                <div className="flex gap-2">
                  <span className="px-3 py-1 bg-emerald-500/10 text-emerald-500 rounded-lg text-xs font-bold border border-emerald-500/20">
                    {roomState.currentMovie.genre}
                  </span>
                  <span className="px-3 py-1 bg-zinc-800 text-zinc-400 rounded-lg text-xs font-bold">
                    HD Streaming
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <aside className="w-full lg:w-[400px] border-l border-zinc-800 flex flex-col bg-[#0a0a0a]">
          <div className="p-4 border-b border-zinc-800 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-emerald-500" />
            <span className="font-bold">Live Chat</span>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex flex-col ${msg.user === 'System' ? 'items-center' : ''}`}>
                {msg.user !== 'System' && (
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1 px-1">
                    {msg.user}
                  </span>
                )}
                <div className={`px-4 py-2 rounded-2xl text-sm max-w-[85%] ${
                  msg.user === 'System' 
                    ? 'bg-zinc-900/50 text-zinc-500 italic text-xs' 
                    : 'bg-zinc-900 text-zinc-200 border border-zinc-800'
                }`}>
                  {msg.text}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          <form onSubmit={sendMessage} className="p-4 border-t border-zinc-800 bg-black/40">
            <div className="relative">
              <input 
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Say something..."
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 pr-12 focus:outline-none focus:border-emerald-500 transition-all"
              />
              <button 
                type="submit"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-emerald-500 hover:text-emerald-400"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </form>
        </aside>
      </div>
    </div>
  );
}
