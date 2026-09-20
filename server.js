import Fastify from "fastify";
import multipart from "@fastify/multipart";
import sharp from "sharp";

const app = Fastify({
  logger: false,
});

await app.register(multipart, {
  limits: {
    fileSize: 20 * 1024 * 1024,
    files: 1,
  },
});

const MAX_SIZE = 1024 * 1024;

app.get("/health", async () => {
  return {
    status: "ok",
    service: "image-compressor",
  };
});

app.post("/api/compress", async (request, reply) => {
  console.log(request, reply);
  const file = await request.file();

  if (!file) {
    return reply.code(400).send({
      error: "La imagen es requerida",
    });
  }

  if (!file.mimetype.startsWith("image/")) {
    return reply.code(400).send({
      error: "El archivo no es una imagen",
    });
  }

  const input = await file.toBuffer();

  try {
    const metadata = await sharp(input).metadata();

    let width = metadata.width || 1920;
    let quality = 82;

    for (let attempt = 0; attempt < 8; attempt++) {
      const output = await sharp(input)
        .autoOrient()
        .resize({
          width,
          withoutEnlargement: true,
        })
        .webp({
          quality,
          effort: 3,
        })
        .toBuffer();

      if (output.length <= MAX_SIZE) {
        const newNema = `${file.filename.split(".")[0].replace(/[^a-zA-Z0-9_-]/g, "_")}_${Math.round(Math.random() * 10000)}.webp`;

        return reply
          .header("Content-Type", "image/webp")
          .header("Content-Length", output.length)
          .header("Content-Disposition", `attachment; filename="${newNema}"`)
          .send(output);
      }

      // Primero bajamos calidad
      if (quality > 50) {
        quality -= 10;
      } else {
        // Luego reducimos dimensiones
        width = Math.floor(width * 0.8);
        quality = 75;
      }
    }

    return reply.code(413).send({
      error: "could not compress image below 1MB",
    });
  } catch {
    return reply.code(400).send({
      error: "invalid image",
    });
  }
});

app.listen({
  port: process.env.PORT || 3000,
  host: "0.0.0.0",
});
