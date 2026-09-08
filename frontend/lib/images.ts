const bucketName = "lenscraft-media";
const objectRoot = "lenscraft-media";
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
  const encodedPath = `${objectRoot}/${objectPath}`.split("/").map(encodeURIComponent).join("/");
  return `${supabaseUrl}/storage/v1/object/public/${bucketName}/${encodedPath}`;
}

export const images = {
  hero: {
    main: publicImage("hero/studio-main.jpg"),
    assistant: publicImage("hero/studio-main.jpg"),
  },
  portfolio: {
    fashion: [
      publicImage("portfolio/fashion/fashion-1.jpg"),
      publicImage("portfolio/fashion/fashion-2.jpg"),
      publicImage("portfolio/fashion/fashion-1.jpg"),
    ],
    product: [
      publicImage("portfolio/product/product-1.jpg"),
      publicImage("portfolio/product/product-2.jpg"),
      publicImage("portfolio/product/product-1.jpg"),
      publicImage("portfolio/product/product-2.jpg"),
    ],
    jewellery: [
      publicImage("portfolio/jewellery/jewellery-1.jpg"),
      publicImage("portfolio/jewellery/jewellery-2.jpg"),
      publicImage("portfolio/jewellery/jewellery-1.jpg"),
    ],
    lifestyle: [
      publicImage("portfolio/lifestyle/lifestyle-1.jpg"),
      publicImage("portfolio/lifestyle/lifestyle-2.jpg"),
    ],
  },
  services: {
    productPhotography: publicImage("services/product.jpg"),
    fashionPhotography: publicImage("services/fashion.jpg"),
    ghostMannequinPhotography: publicImage("services/ghost-mannequin.jpg"),
    flatLayPhotography: publicImage("services/flatlay.jpg"),
    jewelleryPhotography: publicImage("services/jewellery.jpg"),
    lifestylePhotography: publicImage("services/lifestyle.jpg"),
  },
  booking: {
    consultation: publicImage("booking/booking.jpg"),
  },
} as const;
