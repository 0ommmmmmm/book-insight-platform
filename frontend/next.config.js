/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "covers.openlibrary.org" },
      { protocol: "https", hostname: "books.toscrape.com" },
      { protocol: "https", hostname: "images.gr-assets.com" },
      { protocol: "https", hostname: "i.gr-assets.com" },
      { protocol: "http",  hostname: "books.toscrape.com" },
    ],
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1",
  },
};

module.exports = nextConfig;
