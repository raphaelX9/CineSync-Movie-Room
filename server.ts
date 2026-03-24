import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
    },
  });

  const PORT = 3000;

  // Room state management
  const rooms = new Map();

  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    socket.on("join-room", (roomId) => {
      socket.join(roomId);
      console.log(`User ${socket.id} joined room ${roomId}`);
      
      if (!rooms.has(roomId)) {
        rooms.set(roomId, {
          currentMovie: null,
          isPlaying: false,
          currentTime: 0,
          users: [],
          selectionPhase: true,
          swipingPhase: false,
          swipingMovies: [],
          userSwipes: {}, // userId -> { movieId: boolean }
          pin: null,
          votes: {} // movieId -> count
        });
      }
      
      const room = rooms.get(roomId);
      if (!room.users.includes(socket.id)) {
        room.users.push(socket.id);
      }
      
      socket.emit("room-state", room);
      io.to(roomId).emit("user-count", room.users.length);
    });

    socket.on("set-pin", ({ roomId, pin }) => {
      const room = rooms.get(roomId);
      if (room) {
        room.pin = pin;
        io.to(roomId).emit("room-state", room);
      }
    });

    socket.on("start-swiping", ({ roomId, movies }) => {
      const room = rooms.get(roomId);
      if (room) {
        room.swipingPhase = true;
        room.selectionPhase = false;
        room.swipingMovies = movies;
        room.userSwipes = {};
        io.to(roomId).emit("room-state", room);
        io.to(roomId).emit("receive-message", { user: "System", text: "Swiping mode started! Find a match with your friends." });
      }
    });

    socket.on("swipe-movie", ({ roomId, movieId, liked }) => {
      const room = rooms.get(roomId);
      if (room) {
        if (!room.userSwipes[socket.id]) {
          room.userSwipes[socket.id] = {};
        }
        room.userSwipes[socket.id][movieId] = liked;

        // Check for match
        if (liked) {
          const allLiked = room.users.every(uid => room.userSwipes[uid] && room.userSwipes[uid][movieId] === true);
          if (allLiked) {
            const matchedMovie = room.swipingMovies.find(m => m.id === movieId);
            if (matchedMovie) {
              room.currentMovie = matchedMovie;
              room.swipingPhase = false;
              room.selectionPhase = false;
              io.to(roomId).emit("movie-matched", matchedMovie);
              io.to(roomId).emit("receive-message", { user: "System", text: `IT'S A MATCH! Everyone wants to watch: ${matchedMovie.title}` });
            }
          }
        }
        
        io.to(roomId).emit("swipe-update", { userId: socket.id, movieId, liked });
      }
    });

    socket.on("select-movie", ({ roomId, movie }) => {
      const room = rooms.get(roomId);
      if (room) {
        room.currentMovie = movie;
        room.selectionPhase = false;
        room.isPlaying = false;
        room.currentTime = 0;
        io.to(roomId).emit("movie-selected", movie);
        io.to(roomId).emit("receive-message", { user: "System", text: `Movie selected: ${movie.title}` });
      }
    });

    socket.on("send-message", ({ roomId, message }) => {
      io.to(roomId).emit("receive-message", { user: socket.id.substring(0, 5), text: message });
    });

    socket.on("reset-room", (roomId) => {
      const room = rooms.get(roomId);
      if (room) {
        room.selectionPhase = true;
        room.currentMovie = null;
        io.to(roomId).emit("room-state", room);
      }
    });

    socket.on("player-state-change", ({ roomId, isPlaying, currentTime }) => {
      const room = rooms.get(roomId);
      if (room) {
        room.isPlaying = isPlaying;
        if (currentTime !== undefined) room.currentTime = currentTime;
        socket.to(roomId).emit("player-sync", { isPlaying, currentTime });
      }
    });

    socket.on("seek", ({ roomId, currentTime }) => {
      const room = rooms.get(roomId);
      if (room) {
        room.currentTime = currentTime;
        socket.to(roomId).emit("seek-sync", currentTime);
      }
    });

    socket.on("disconnecting", () => {
      for (const roomId of socket.rooms) {
        const room = rooms.get(roomId);
        if (room) {
          room.users = room.users.filter(id => id !== socket.id);
          io.to(roomId).emit("user-count", room.users.length);
          if (room.users.length === 0) {
            // Optional: Clean up empty rooms after some time
          }
        }
      }
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
