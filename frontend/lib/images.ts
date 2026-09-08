const bucketName = "lenscraft-media";
const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();

if (!configuredUrl) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL must be configured for studio media");
}

const parsedUrl = new URL(configuredUrl);
if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL must be an HTTP(S) URL");
}
const supabaseUrl = parsedUrl.toString().replace(/\/+$/, "");

function publicImage(objectPath: string) {
  const encodedPath = objectPath.split("/").map(encodeURIComponent).join("/");
  return `${supabaseUrl}/storage/v1/object/public/${bucketName}/${encodedPath}`;
}

export const images = {
  hero: {
    main: publicImage("hero/campaign-study.webp"),
    assistant: publicImage("hero/studio-line.webp"),
  },
  portfolio: {
    fashion: [
      publicImage("portfolio/fashion/after-hours.webp"),
      publicImage("portfolio/fashion/the-essential-shirt.webp"),
      publicImage("portfolio/fashion/new-classic.webp"),
    ],
    product: [
      publicImage("portfolio/product/form-no-01.webp"),
      publicImage("portfolio/product/soft-geometry.webp"),
      publicImage("portfolio/product/quiet-utility.webp"),
      publicImage("portfolio/product/object-and-shadow.webp"),
    ],
    jewellery: [
      publicImage("portfolio/jewellery/fine-objects.webp"),
      publicImage("portfolio/jewellery/brilliance-study.webp"),
      publicImage("portfolio/jewellery/precious-light.webp"),
    ],
    lifestyle: [
      publicImage("portfolio/lifestyle/sunday-light.webp"),
      publicImage("portfolio/lifestyle/golden-hour.webp"),
    ],
  },
  services: {
    productPhotography: publicImage("services/product-photography.webp"),
    fashionPhotography: publicImage("services/fashion-photography.webp"),
    ghostMannequinPhotography: publicImage("services/ghost-mannequin-photography.webp"),
    flatLayPhotography: publicImage("services/flat-lay-photography.webp"),
    jewelleryPhotography: publicImage("services/jewellery-photography.webp"),
    lifestylePhotography: publicImage("services/lifestyle-photography.webp"),
  },
  booking: {
    consultation: publicImage("booking/studio-consultation.webp"),
  },
} as const;
