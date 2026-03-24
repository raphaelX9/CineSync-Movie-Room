export interface Movie {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  videoUrl: string;
  year: string;
  genre: string;
}

export const MOVIES: Movie[] = [
  {
    id: "1",
    title: "Big Buck Bunny",
    description: "A large, lovable rabbit deals with three tiny bullies, a flying squirrel, and two squirrels who discover that even the gentlest creature has a limit.",
    thumbnail: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Big_Buck_Bunny_Terminal_Core_v8.jpg/640px-Big_Buck_Bunny_Terminal_Core_v8.jpg",
    videoUrl: "https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/720/Big_Buck_Bunny_720_10s_1MB.mp4",
    year: "2008",
    genre: "Animation"
  },
  {
    id: "2",
    title: "Elephants Dream",
    description: "Friends Proog and Emo explore a strange industrial world of machines, where they have different perspectives on reality.",
    thumbnail: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e8/Elephants_Dream_s5_both.jpg/640px-Elephants_Dream_s5_both.jpg",
    videoUrl: "https://test-videos.co.uk/vids/jellyfish/mp4/h264/720/Jellyfish_720_10s_1MB.mp4",
    year: "2006",
    genre: "Sci-Fi"
  },
  {
    id: "3",
    title: "Sintel",
    description: "A young woman named Sintel searches for her baby dragon, Scales, in a beautiful but dangerous world.",
    thumbnail: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/94/Sintel_poster.jpg/640px-Sintel_poster.jpg",
    videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
    year: "2010",
    genre: "Fantasy"
  },
  {
    id: "4",
    title: "Tears of Steel",
    description: "In a future Amsterdam, a group of scientists try to save the world from destructive robots using a piece of their past.",
    thumbnail: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6a/Tears_of_Steel_poster.jpg/640px-Tears_of_Steel_poster.jpg",
    videoUrl: "https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_1mb.mp4",
    year: "2012",
    genre: "Sci-Fi"
  }
];
