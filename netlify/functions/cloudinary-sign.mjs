import { createHash } from "node:crypto";

export default async (request) => {
  try {
    if (request.method !== "POST") {
      return Response.json(
        { error: "Method not allowed" },
        { status: 405 }
      );
    }

    const pin = request.headers.get("x-admin-pin");

    if (!process.env.ADMIN_PIN ||
        pin !== process.env.ADMIN_PIN) {
      return Response.json(
        { error: "PIN si sahihi." },
        { status: 401 }
      );
    }

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      return Response.json(
        { error: "Cloudinary settings hazijakamilika." },
        { status: 500 }
      );
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const folder = "obedy-movies";

    const params = `folder=${folder}&timestamp=${timestamp}`;

    const signature = createHash("sha1")
      .update(params + apiSecret)
      .digest("hex");

    return Response.json({
      cloudName,
      apiKey,
      timestamp,
      folder,
      signature
    });

  } catch (error) {
    return Response.json(
      { error: "Hitilafu ya server." },
      { status: 500 }
    );
  }
};
