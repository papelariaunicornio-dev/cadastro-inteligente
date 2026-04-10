import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    // Restrict to known image sources — no wildcard
    remotePatterns: [
      // Brand sites
      { protocol: "https", hostname: "**.pentel.com.br" },
      { protocol: "https", hostname: "**.cis.com.br" },
      { protocol: "https", hostname: "**.molin.com.br" },
      { protocol: "https", hostname: "**.ciceros.com.br" },
      { protocol: "https", hostname: "**.faber-castell.com.br" },
      // E-commerce
      { protocol: "https", hostname: "**.kalunga.com.br" },
      { protocol: "https", hostname: "**.magazineluiza.com.br" },
      { protocol: "https", hostname: "**.americanas.com.br" },
      // Marketplaces
      { protocol: "https", hostname: "**.mercadolivre.com.br" },
      { protocol: "https", hostname: "**.amazon.com.br" },
      { protocol: "https", hostname: "**.shopee.com.br" },
      // CDNs commonly used
      { protocol: "https", hostname: "**.cloudinary.com" },
      { protocol: "https", hostname: "**.imgix.net" },
      { protocol: "https", hostname: "**.shopify.com" },
      { protocol: "https", hostname: "images.tcdn.com.br" },
      { protocol: "https", hostname: "**.vteximg.com.br" },
      { protocol: "https", hostname: "**.vtexassets.com" },
    ],
    // For images not in the allowed list, use raw <img> tags (already doing this)
    unoptimized: false,
  },
  serverExternalPackages: ["bullmq", "ioredis"],
};

export default nextConfig;
