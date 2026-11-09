
import { getStore } from "@netlify/blobs";
import { createHash, randomBytes, randomUUID } from "node:crypto";

const moviesStore = getStore("obedy-movies");
const requestsStore = getStore("obedy-payment-requests");
const codesStore = getStore("obedy-access-codes");

const reply = (data, status = 200) =>
  Response.json(data, { status });

const hashCode = code =>
  createHash("sha256")
    .update(String(code).trim().toUpperCase())
    .digest("hex");

function validVideoURL(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

async function getMovies() {
  const movies = await moviesStore.get("movies", {
    type: "json"
  }) || [];

  let changed = false;

  const updated = movies.map(movie => {
    if (movie.id) return movie;

    changed = true;

    return {
      ...movie,
      id: randomUUID(),
      kind: "movie",
      price: 1000
    };
  });

  if (changed) {
    await moviesStore.setJSON("movies", updated);
  }

  return updated;
}

export default async request => {
  try {
    const pin = request.headers.get("x-admin-pin");
    const isAdmin =
      Boolean(process.env.ADMIN_PIN) &&
      pin === process.env.ADMIN_PIN;

    if (request.method === "GET") {
      const movies = await getMovies();

      return reply({
        movies: movies.map(movie => ({
          id: movie.id,
          title: movie.title,
          description: movie.description || "",
          image: movie.image || "",
          kind: movie.kind || "movie",
          price: Number(movie.price) ||
            (movie.kind === "season" ? 2000 : 1000),
          episodeCount: Array.isArray(movie.episodes)
            ? movie.episodes.length
            : (movie.kind === "season" && movie.watch ? 1 : 0)
        }))
      });
    }

    if (request.method !== "POST") {
      return reply({ error: "Method not allowed" }, 405);
    }

    const body = await request.json();
    const action = body.action || "save";

    // CUSTOMER REQUESTS PAYMENT
    if (action === "request") {
      const movies = await getMovies();
      const movie = movies.find(m => m.id === body.movieId);
      const phone = String(body.phone || "").trim();

      if (!movie) {
        return reply({ error: "Movie haijapatikana." }, 404);
      }

      if (!/^[+0-9 ]{9,16}$/.test(phone)) {
        return reply({
          error: "Weka namba sahihi ya simu."
        }, 400);
      }

      const requests =
        await requestsStore.get("requests", {
          type: "json"
        }) || [];

      const item = {
        id: randomUUID(),
        movieId: movie.id,
        movieTitle: movie.title,
        price: Number(movie.price) ||
          (movie.kind === "season" ? 2000 : 1000),
        phone,
        status: "pending",
        createdAt: new Date().toISOString()
      };

      requests.unshift(item);

      await requestsStore.setJSON(
        "requests",
        requests.slice(0, 500)
      );

      return reply({
        success: true,
        requestId: item.id
      });
    }

    // CUSTOMER ENTERS SECRET CODE
    if (action === "redeem") {
      const code = String(body.code || "").trim();
      const movieId = String(body.movieId || "");

      if (!code || !movieId) {
        return reply({
          error: "Weka code ya malipo."
        }, 400);
      }

      const codes =
        await codesStore.get("codes", {
          type: "json"
        }) || [];

      const valid = codes.find(item =>
        item.movieId === movieId &&
        item.codeHash === hashCode(code)
      );

      if (!valid) {
        return reply({
          error: "Code si sahihi kwa movie hii."
        }, 403);
      }

      const movies = await getMovies();
      const movie = movies.find(m => m.id === movieId);

      if (!movie) {
        return reply({
          error: "Movie haipatikani."
        }, 404);
      }

      // SEASON: RETURN ALL EPISODES
      if (movie.kind === "season") {
        const episodes = Array.isArray(movie.episodes)
          ? movie.episodes
          : (movie.watch
              ? [{ title: "Episode 1", watch: movie.watch }]
              : []);

        if (!episodes.length) {
          return reply({
            error: "Episodes za season hazipatikani."
          }, 404);
        }

        return reply({
          success: true,
          kind: "season",
          episodes: episodes.map((episode, index) => ({
            title: episode.title || `Episode ${index + 1}`,
            watch: episode.watch
          }))
        });
      }

      // ORDINARY MOVIE
      if (!movie.watch) {
        return reply({
          error: "Video haipatikani."
        }, 404);
      }

      return reply({
        success: true,
        kind: "movie",
        watch: movie.watch
      });
    }

    // ALL OTHER ACTIONS REQUIRE ADMIN PIN
    if (!isAdmin) {
      return reply({ error: "PIN si sahihi." }, 401);
    }

    // ADMIN VIEWS PAYMENT REQUESTS
    if (action === "listRequests") {
      const requests =
        await requestsStore.get("requests", {
          type: "json"
        }) || [];

      return reply({ requests });
    }

    // ADMIN APPROVES PAYMENT
    if (action === "approve") {
      const requests =
        await requestsStore.get("requests", {
          type: "json"
        }) || [];

      const item = requests.find(
        r => r.id === body.requestId
      );

      if (!item) {
        return reply({
          error: "Ombi halijapatikana."
        }, 404);
      }

      if (item.status === "approved") {
        return reply({
          error: "Malipo tayari yameidhinishwa."
        }, 409);
      }

      const movies = await getMovies();
      const movie = movies.find(
        m => m.id === item.movieId
      );

      if (!movie) {
        return reply({
          error: "Movie haipatikani."
        }, 404);
      }

      const code = randomBytes(5)
        .toString("hex")
        .toUpperCase();

      const codes =
        await codesStore.get("codes", {
          type: "json"
        }) || [];

      codes.push({
        id: randomUUID(),
        movieId: item.movieId,
        requestId: item.id,
        codeHash: hashCode(code),
        createdAt: new Date().toISOString()
      });

      await codesStore.setJSON("codes", codes);

      item.status = "approved";
      item.approvedAt = new Date().toISOString();

      await requestsStore.setJSON(
        "requests",
        requests
      );

      return reply({
        success: true,
        code,
        phone: item.phone,
        movieTitle: item.movieTitle
      });
    }

    // ADMIN DELETES A MOVIE OR SEASON
    if (action === "delete") {
      const movieId = String(body.movieId || "");

      if (!movieId) {
        return reply({
          error: "Chagua movie ya kufuta."
        }, 400);
      }

      const movies = await getMovies();
      const movie = movies.find(m => m.id === movieId);

      if (!movie) {
        return reply({
          error: "Movie haijapatikana au tayari imefutwa."
        }, 404);
      }

      // REMOVE MOVIE
      const remainingMovies = movies.filter(
        m => m.id !== movieId
      );

      await moviesStore.setJSON(
        "movies",
        remainingMovies
      );

      // REMOVE ALL PAYMENT REQUESTS FOR THIS MOVIE
      const requests =
        await requestsStore.get("requests", {
          type: "json"
        }) || [];

      await requestsStore.setJSON(
        "requests",
        requests.filter(r => r.movieId !== movieId)
      );

      // REMOVE ALL ACCESS CODES FOR THIS MOVIE
      const codes =
        await codesStore.get("codes", {
          type: "json"
        }) || [];

      await codesStore.setJSON(
        "codes",
        codes.filter(c => c.movieId !== movieId)
      );

      return reply({
        success: true,
        message: "Movie, maombi na codes zake zimefutwa.",
        deletedMovie: movie.title
      });
    }

    // ADMIN SAVES A NEW MOVIE OR SEASON
    if (action === "save") {
      const movie = body.movie || body;
      const kind = movie.kind === "season"
        ? "season"
        : "movie";

      let episodes = [];

      if (kind === "season") {
        if (!Array.isArray(movie.episodes)) {
          return reply({
            error: "Chagua episodes za season."
          }, 400);
        }

        episodes = movie.episodes
          .filter(item =>
            item &&
            validVideoURL(item.watch)
          )
          .map((item, index) => ({
            title: String(
              item.title || `Episode ${index + 1}`
            ).trim(),
            watch: String(item.watch)
          }));

        if (!episodes.length) {
          return reply({
            error: "Hakuna episode yenye video sahihi."
          }, 400);
        }
      } else {
        if (!validVideoURL(movie.watch)) {
          return reply({
            error: "Jaza link sahihi ya video ya movie."
          }, 400);
        }
      }

      if (!String(movie.title || "").trim()) {
        return reply({
          error: "Jaza jina la movie."
        }, 400);
      }

      const movies = await getMovies();

      movies.push({
        id: randomUUID(),
        title: String(movie.title).trim(),
        description: String(movie.description || ""),
        image: String(movie.image || ""),
        watch: kind === "movie" ? String(movie.watch) : "",
        episodes: kind === "season" ? episodes : [],
        kind,
        price: kind === "season" ? 2000 : 1000
      });

      await moviesStore.setJSON("movies", movies);

      return reply({
        success: true,
        episodeCount: episodes.length
      });
    }

    return reply({
      error: "Action haijulikani."
    }, 400);

  } catch (error) {
    return reply({
      error: "Hitilafu ya server."
    }, 500);
  }
};
