
import { getStore } from "@netlify/blobs";

const store = getStore("obedy-movies");

export default async (request) => {
  try {
    if (request.method === "GET") {
      const movies = await store.get("movies", {
        type: "json"
      }) || [];

      return Response.json({ movies });
    }

    if (request.method === "POST") {
      const pin = request.headers.get("x-admin-pin");

      if (!process.env.ADMIN_PIN ||
          pin !== process.env.ADMIN_PIN) {
        return Response.json(
          { error: "PIN si sahihi." },
          { status: 401 }
        );
      }

      const movie = await request.json();

      if (!movie.title || !movie.watch) {
        return Response.json(
          { error: "Jaza jina na link ya movie." },
          { status: 400 }
        );
      }

      const movies = await store.get("movies", {
        type: "json"
      }) || [];

      movies.push({
        title: String(movie.title),
        description: String(movie.description || ""),
        image: String(movie.image || ""),
        watch: String(movie.watch)
      });

      await store.setJSON("movies", movies);

      return Response.json({ success: true });
    }

    return Response.json(
      { error: "Method not allowed" },
      { status: 405 }
    );

  } catch (error) {
    return Response.json(
      { error: "Hitilafu ya server." },
      { status: 500 }
    );
  }
};

