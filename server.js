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

function generateCode() {
  return crypto.randomBytes(4).toString("base64url").slice(0, 6);
}

const MAX_SIZE = 1024 * 1024;

app.post("/compress", async (request, reply) => {
  const file = await request.file();

  if (!file) {
    return reply.code(400).send({
      error: "image is required",
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
        const newNema = `${file.filename.split(".")[0]}_${Math.round(Math.random() * 10000)}.webp`;

        return reply
          .header("Content-Type", "image/webp")
          .header("Content-Length", output.length)
          .header("Content-Disposition", `attachment; filename=${newNema}`)
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
