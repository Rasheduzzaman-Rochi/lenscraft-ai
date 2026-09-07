export type Service = {
  number: string;
  slug: string;
  name: string;
  shortDescription: string;
  description: string;
  details: string[];
  tone: "ivory" | "stone" | "bronze" | "moss" | "noir" | "rose";
};

export type PortfolioItem = {
  title: string;
  category: string;
  orientation: "portrait" | "landscape" | "square";
  tone: Service["tone"];
};

export const services: Service[] = [
  {
    number: "01",
    slug: "product-photography",
    name: "Product Photography",
    shortDescription: "Precise, polished imagery designed to make every product feel essential.",
    description: "Clean commercial frames built around material, form, and the details that turn consideration into confidence.",
    details: ["E-commerce collections", "Campaign imagery", "Detail and scale studies"],
    tone: "ivory",
  },
  {
    number: "02",
    slug: "fashion-photography",
    name: "Fashion Photography",
    shortDescription: "Editorial stories with movement, character, and a distinct visual point of view.",
    description: "Concept-led fashion imagery for lookbooks, seasonal campaigns, and brand worlds that need to be remembered.",
    details: ["Campaign direction", "Lookbooks", "Editorial collections"],
    tone: "noir",
  },
  {
    number: "03",
    slug: "ghost-mannequin-photography",
    name: "Ghost Mannequin Photography",
    shortDescription: "Natural garment shape and fit without visual distraction.",
    description: "Consistent, technically exact apparel photography with refined invisible-form compositing for premium storefronts.",
    details: ["Front and back views", "Neck-joint compositing", "Color consistency"],
    tone: "stone",
  },
  {
    number: "04",
    slug: "flat-lay-photography",
    name: "Flat Lay Photography",
    shortDescription: "Considered compositions that make collections feel coherent and tactile.",
    description: "Art-directed overhead imagery balancing product clarity with a strong editorial rhythm for commerce and social.",
    details: ["Styled arrangements", "Collection stories", "Social-first crops"],
    tone: "rose",
  },
  {
    number: "05",
    slug: "jewellery-photography",
    name: "Jewellery Photography",
    shortDescription: "Controlled light, true detail, and a quiet sense of luxury.",
    description: "High-precision still life photography created to reveal finish, craftsmanship, stones, and fine-scale detail.",
    details: ["Macro detail", "Metal and stone control", "Luxury campaign sets"],
    tone: "bronze",
  },
  {
    number: "06",
    slug: "lifestyle-photography",
    name: "Lifestyle Photography",
    shortDescription: "Human, atmospheric scenes that place products inside a believable world.",
    description: "Warm, story-led images for brands that want to communicate feeling, context, and a richer sense of place.",
    details: ["Location production", "Talent direction", "Brand storytelling"],
    tone: "moss",
  },
];

export const portfolioItems: PortfolioItem[] = [
  { title: "Form No. 01", category: "Product", orientation: "portrait", tone: "ivory" },
  { title: "After Hours", category: "Fashion", orientation: "landscape", tone: "noir" },
  { title: "Fine Objects", category: "Jewellery", orientation: "square", tone: "bronze" },
  { title: "Soft Geometry", category: "Product", orientation: "landscape", tone: "rose" },
  { title: "The Essential Shirt", category: "Fashion", orientation: "portrait", tone: "stone" },
  { title: "Sunday Light", category: "Lifestyle", orientation: "square", tone: "moss" },
  { title: "Quiet Utility", category: "Product", orientation: "square", tone: "stone" },
  { title: "New Classic", category: "Fashion", orientation: "portrait", tone: "rose" },
  { title: "Brilliance Study", category: "Jewellery", orientation: "landscape", tone: "noir" },
  { title: "Golden Hour", category: "Lifestyle", orientation: "portrait", tone: "bronze" },
  { title: "Object & Shadow", category: "Product", orientation: "landscape", tone: "moss" },
  { title: "Precious Light", category: "Jewellery", orientation: "portrait", tone: "ivory" },
];

export const processSteps = [
  { number: "01", title: "Discover", text: "We clarify your audience, channels, references, and commercial goals." },
  { number: "02", title: "Shape", text: "We build the visual direction, shot list, styling, and production plan." },
  { number: "03", title: "Create", text: "Our team photographs with exacting attention to light, texture, and consistency." },
  { number: "04", title: "Refine", text: "Every selected frame is finished and delivered ready for its intended platform." },
];
